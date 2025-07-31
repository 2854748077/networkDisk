/**
 * 下载管理器
 * 统一管理文件下载，自动选择分片下载或传统下载方式
 */

import Request from './Request.js';
import ChunkDownloader from './ChunkDownloader.js';
import FileAssembler from './FileAssembler.js';
import DownloadTrigger from './DownloadTrigger.js';

/**
 * 下载方法枚举
 */
const DOWNLOAD_METHOD = {
    TRADITIONAL: 'traditional',  // 传统下载
    CHUNK: 'chunk'              // 分片下载
};

/**
 * 下载管理器类
 */
class DownloadManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        // 配置参数
        this.chunkThreshold = options.chunkThreshold || 1024 * 512; // 512KB，超过此大小使用分片下载
        this.enableChunkDownload = options.enableChunkDownload !== false; // 默认启用分片下载
        this.enableFallback = options.enableFallback !== false; // 默认启用降级机制
        this.maxRetries = options.maxRetries || 3; // 最大重试次数
        
        // API配置
        this.apis = {
            createDownloadUrl: '/file/createDownloadUrl',
            download: '/api/file/download',
            getChunkInfo: '/file/getChunkInfo',
            downloadChunk: '/file/downloadChunk',
            ...options.apis
        };
        
        // 工具实例
        this.downloadTrigger = new DownloadTrigger({
            autoCleanup: true,
            cleanupDelay: 5000
        });
        
        // 状态管理
        this.activeDownloads = new Map(); // 活跃的下载任务
        this.downloadHistory = new Map(); // 下载历史
        
        // 回调函数
        this.onDownloadStart = options.onDownloadStart || null;
        this.onProgress = options.onProgress || null;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;
        this.onMethodSelect = options.onMethodSelect || null;
    }
    
    /**
     * 下载文件（主入口方法）
     * @param {Object} fileInfo - 文件信息对象，包含 fileId, fileName, fileSize, downloadCode 等
     * @param {Object} options - 下载选项
     * @returns {Promise<Object>} 下载结果对象
     */
    async downloadFile(fileInfo, options = {}) {
        // 兼容旧的参数格式
        let fileId, fileName, fileSize, downloadCode;
        
        if (typeof fileInfo === 'string') {
            // 旧格式：downloadFile(fileId, fileName, options)
            fileId = fileInfo;
            fileName = fileName || arguments[1];
            options = arguments[2] || {};
        } else {
            // 新格式：downloadFile(fileInfo, options)
            fileId = fileInfo.fileId;
            fileName = fileInfo.fileName;
            fileSize = fileInfo.fileSize;
            downloadCode = fileInfo.downloadCode;
        }
        const downloadId = this._generateDownloadId(fileId, fileName);
        
        try {
            // 检查浏览器兼容性
            const compatibilityResult = this._checkBrowserCompatibility();
            if (!compatibilityResult.isCompatible && !this.enableFallback) {
                throw new Error(`Browser not compatible: ${compatibilityResult.reason}`);
            }
            
            // 记录下载开始
            this._recordDownloadStart(downloadId, fileId, fileName);
            
            // 触发下载开始回调
            if (this.onDownloadStart) {
                this.onDownloadStart({
                    downloadId,
                    fileId,
                    fileName,
                    method: 'detecting'
                });
            }
            
            // 创建下载码（如果没有提供）
            if (!downloadCode) {
                downloadCode = await this._createDownloadCode(fileId);
                if (!downloadCode) {
                    throw new Error('Failed to create download code');
                }
            }
            
            // 检测文件大小并选择下载方法
            const downloadMethod = await this._selectDownloadMethod(downloadCode, fileName, {
                ...options,
                fileSize,
                compatibilityResult
            });
            
            // 触发方法选择回调
            if (this.onMethodSelect) {
                this.onMethodSelect({
                    downloadId,
                    fileId,
                    fileName,
                    method: downloadMethod.method,
                    fileSize: downloadMethod.fileSize,
                    reason: downloadMethod.reason
                });
            }
            
            let success = false;
            let actualMethod = downloadMethod.method;
            
            // 根据选择的方法执行下载
            if (downloadMethod.method === DOWNLOAD_METHOD.CHUNK) {
                success = await this._downloadWithChunks(
                    downloadCode, 
                    fileName, 
                    downloadMethod.fileSize,
                    downloadId,
                    options
                );
            } else {
                success = await this._downloadTraditional(
                    downloadCode, 
                    fileName,
                    downloadId,
                    options
                );
                actualMethod = DOWNLOAD_METHOD.TRADITIONAL;
            }
            
            if (success) {
                // 记录下载成功
                this._recordDownloadComplete(downloadId);
                
                // 触发完成回调
                if (this.onComplete) {
                    this.onComplete({
                        downloadId,
                        fileId,
                        fileName,
                        method: actualMethod
                    });
                }
                
                return {
                    success: true,
                    method: actualMethod === DOWNLOAD_METHOD.CHUNK ? 'chunked' : 'traditional',
                    downloadId,
                    fileSize: downloadMethod.fileSize
                };
            } else {
                throw new Error('Download failed');
            }
            
        } catch (error) {
            console.error('Download failed:', error);
            
            // 记录下载失败
            this._recordDownloadError(downloadId, error);
            
            // 尝试降级处理
            if (this.enableFallback && !options._isFallback) {
                console.log('Attempting fallback download method...');
                return await this._fallbackDownload(fileId, fileName, downloadId, error, options);
            }
            
            // 触发错误回调
            if (this.onError) {
                this.onError({
                    downloadId,
                    fileId,
                    fileName,
                    error
                });
            }
            
            throw error;
        } finally {
            // 清理活跃下载记录
            this.activeDownloads.delete(downloadId);
        }
    }
    
    /**
     * 创建下载码
     * @param {string} fileId - 文件ID
     * @returns {Promise<string>} 下载码
     * @private
     */
    async _createDownloadCode(fileId) {
        try {
            const result = await Request({
                url: `${this.apis.createDownloadUrl}/${fileId}`,
                showLoading: false,
                showError: false
            });
            
            return result?.data;
        } catch (error) {
            console.error('Failed to create download code:', error);
            throw new Error('Failed to create download code: ' + error.message);
        }
    }
    
    /**
     * 检查浏览器兼容性
     * @returns {Object} 兼容性检查结果
     * @private
     */
    _checkBrowserCompatibility() {
        const userAgent = navigator.userAgent.toLowerCase();
        const issues = [];
        let isCompatible = true;
        
        // 检查基本 API 支持
        if (typeof fetch === 'undefined') {
            issues.push('fetch API not supported');
            isCompatible = false;
        }
        
        if (typeof ArrayBuffer === 'undefined') {
            issues.push('ArrayBuffer not supported');
            isCompatible = false;
        }
        
        if (typeof Blob === 'undefined') {
            issues.push('Blob API not supported');
            isCompatible = false;
        }
        
        if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
            issues.push('URL.createObjectURL not supported');
            isCompatible = false;
        }
        
        // 检查特定浏览器版本
        if (userAgent.includes('msie') || userAgent.includes('trident')) {
            // Internet Explorer
            const ieVersion = this._getIEVersion(userAgent);
            if (ieVersion && ieVersion < 11) {
                issues.push(`IE ${ieVersion} not supported (requires IE 11+)`);
                isCompatible = false;
            }
        }
        
        // 检查 Chrome 版本
        const chromeMatch = userAgent.match(/chrome\/(\d+)/);
        if (chromeMatch) {
            const chromeVersion = parseInt(chromeMatch[1]);
            if (chromeVersion < 49) {
                issues.push(`Chrome ${chromeVersion} not fully supported (requires Chrome 49+)`);
                // 不完全阻止，但会影响功能
            }
        }
        
        // 检查 Firefox 版本
        const firefoxMatch = userAgent.match(/firefox\/(\d+)/);
        if (firefoxMatch) {
            const firefoxVersion = parseInt(firefoxMatch[1]);
            if (firefoxVersion < 45) {
                issues.push(`Firefox ${firefoxVersion} not fully supported (requires Firefox 45+)`);
            }
        }
        
        // 检查 Safari 版本
        const safariMatch = userAgent.match(/version\/(\d+).*safari/);
        if (safariMatch) {
            const safariVersion = parseInt(safariMatch[1]);
            if (safariVersion < 10) {
                issues.push(`Safari ${safariVersion} not fully supported (requires Safari 10+)`);
            }
        }
        
        return {
            isCompatible,
            issues,
            reason: issues.join(', '),
            browserInfo: this._getBrowserInfo(userAgent)
        };
    }
    
    /**
     * 获取 IE 版本
     * @param {string} userAgent - 用户代理字符串
     * @returns {number|null} IE 版本号
     * @private
     */
    _getIEVersion(userAgent) {
        const msieMatch = userAgent.match(/msie (\d+)/);
        if (msieMatch) {
            return parseInt(msieMatch[1]);
        }
        
        const tridentMatch = userAgent.match(/trident.*rv:(\d+)/);
        if (tridentMatch) {
            return parseInt(tridentMatch[1]);
        }
        
        return null;
    }
    
    /**
     * 获取浏览器信息
     * @param {string} userAgent - 用户代理字符串
     * @returns {Object} 浏览器信息
     * @private
     */
    _getBrowserInfo(userAgent) {
        const info = {
            name: 'unknown',
            version: 'unknown',
            isMobile: /mobile|android|iphone|ipad/.test(userAgent)
        };
        
        if (userAgent.includes('chrome')) {
            info.name = 'Chrome';
            const match = userAgent.match(/chrome\/(\d+)/);
            if (match) info.version = match[1];
        } else if (userAgent.includes('firefox')) {
            info.name = 'Firefox';
            const match = userAgent.match(/firefox\/(\d+)/);
            if (match) info.version = match[1];
        } else if (userAgent.includes('safari')) {
            info.name = 'Safari';
            const match = userAgent.match(/version\/(\d+)/);
            if (match) info.version = match[1];
        } else if (userAgent.includes('edge')) {
            info.name = 'Edge';
            const match = userAgent.match(/edge\/(\d+)/);
            if (match) info.version = match[1];
        } else if (userAgent.includes('msie') || userAgent.includes('trident')) {
            info.name = 'Internet Explorer';
            info.version = this._getIEVersion(userAgent)?.toString() || 'unknown';
        }
        
        return info;
    }

    /**
     * 选择下载方法
     * @param {string} downloadCode - 下载码
     * @param {string} fileName - 文件名
     * @param {Object} options - 选项
     * @returns {Promise<Object>} 下载方法信息
     * @private
     */
    async _selectDownloadMethod(downloadCode, fileName, options = {}) {
        // 如果强制指定方法，直接返回
        if (options.forceMethod) {
            return {
                method: options.forceMethod,
                fileSize: options.fileSize || 0,
                reason: 'forced by options'
            };
        }
        
        // 如果禁用分片下载，使用传统方法
        if (!this.enableChunkDownload) {
            return {
                method: DOWNLOAD_METHOD.TRADITIONAL,
                fileSize: options.fileSize || 0,
                reason: 'chunk download disabled'
            };
        }
        
        // 检查浏览器兼容性
        const compatibilityResult = options.compatibilityResult || this._checkBrowserCompatibility();
        if (!compatibilityResult.isCompatible) {
            return {
                method: DOWNLOAD_METHOD.TRADITIONAL,
                fileSize: options.fileSize || 0,
                reason: `browser compatibility: ${compatibilityResult.reason}`
            };
        }
        
        try {
            // 尝试获取分片信息来判断文件大小
            const chunkInfo = await this._getChunkInfo(downloadCode);
            
            if (chunkInfo && chunkInfo.fileSize > this.chunkThreshold) {
                return {
                    method: DOWNLOAD_METHOD.CHUNK,
                    fileSize: chunkInfo.fileSize,
                    totalChunks: chunkInfo.totalChunks,
                    chunkSize: chunkInfo.chunkSize,
                    reason: `file size (${chunkInfo.fileSize} bytes) exceeds threshold (${this.chunkThreshold} bytes)`
                };
            } else {
                return {
                    method: DOWNLOAD_METHOD.TRADITIONAL,
                    fileSize: chunkInfo?.fileSize || 0,
                    reason: chunkInfo ? 
                        `file size (${chunkInfo.fileSize} bytes) below threshold (${this.chunkThreshold} bytes)` :
                        'chunk info not available'
                };
            }
        } catch (error) {
            console.warn('Failed to get chunk info, falling back to traditional download:', error);
            return {
                method: DOWNLOAD_METHOD.TRADITIONAL,
                fileSize: 0,
                reason: 'chunk info unavailable: ' + error.message
            };
        }
    }
    
    /**
     * 获取分片信息
     * @param {string} downloadCode - 下载码
     * @returns {Promise<Object>} 分片信息
     * @private
     */
    async _getChunkInfo(downloadCode) {
        try {
            const result = await Request({
                url: `${this.apis.getChunkInfo}/${downloadCode}`,
                showLoading: false,
                showError: false,
                timeout: 10000 // 10秒超时
            });
            
            return result?.data;
        } catch (error) {
            console.warn('Failed to get chunk info:', error);
            return null;
        }
    }
    
    /**
     * 使用分片方式下载文件
     * @param {string} downloadCode - 下载码
     * @param {string} fileName - 文件名
     * @param {number} fileSize - 文件大小
     * @param {string} downloadId - 下载ID
     * @param {Object} options - 选项
     * @returns {Promise<boolean>} 是否成功
     * @private
     */
    async _downloadWithChunks(downloadCode, fileName, fileSize, downloadId, options = {}) {
        console.log(`Starting chunk download: ${fileName} (${fileSize} bytes)`);
        
        try {
            // 创建分片下载器
            const chunkDownloader = new ChunkDownloader(downloadCode, fileName, fileSize, {
                chunkSize: options.chunkSize || 1024 * 512,
                concurrentLimit: options.concurrentLimit || 3,
                maxRetries: options.maxRetries || this.maxRetries,
                
                // 进度回调
                onProgress: (progressInfo) => {
                    if (this.onProgress) {
                        this.onProgress({
                            downloadId,
                            method: DOWNLOAD_METHOD.CHUNK,
                            ...progressInfo
                        });
                    }
                },
                
                // 错误回调
                onError: (error) => {
                    console.error('Chunk download error:', error);
                }
            });
            
            // 记录活跃下载
            this.activeDownloads.set(downloadId, {
                type: 'chunk',
                downloader: chunkDownloader,
                startTime: Date.now()
            });
            
            // 开始下载
            const fileBlob = await chunkDownloader.start();
            
            // 验证文件完整性
            if (options.enableIntegrityCheck !== false) {
                const isValid = await this._verifyFileIntegrity(fileBlob, fileName, fileSize, options);
                if (!isValid) {
                    throw new Error('File integrity check failed');
                }
            }
            
            // 触发浏览器下载
            await this.downloadTrigger.triggerDownload(fileBlob, fileName);
            
            console.log(`Chunk download completed: ${fileName}`);
            return true;
            
        } catch (error) {
            console.error('Chunk download failed:', error);
            throw new Error('Chunk download failed: ' + error.message);
        }
    }
    
    /**
     * 使用传统方式下载文件
     * @param {string} downloadCode - 下载码
     * @param {string} fileName - 文件名
     * @param {string} downloadId - 下载ID
     * @param {Object} options - 选项
     * @returns {Promise<boolean>} 是否成功
     * @private
     */
    async _downloadTraditional(downloadCode, fileName, downloadId, options = {}) {
        console.log(`Starting traditional download: ${fileName}`);
        
        try {
            // 记录活跃下载
            this.activeDownloads.set(downloadId, {
                type: 'traditional',
                startTime: Date.now()
            });
            
            // 触发传统下载
            const downloadUrl = `${this.apis.download}/${downloadCode}`;
            window.location.href = downloadUrl;
            
            // 传统下载无法直接检测完成状态，延迟一段时间后认为成功
            await this._delay(1000);
            
            console.log(`Traditional download initiated: ${fileName}`);
            return true;
            
        } catch (error) {
            console.error('Traditional download failed:', error);
            throw new Error('Traditional download failed: ' + error.message);
        }
    }
    
    /**
     * 验证文件完整性
     * @param {Blob} fileBlob - 文件Blob
     * @param {string} fileName - 文件名
     * @param {number} expectedSize - 预期大小
     * @param {Object} options - 验证选项
     * @returns {Promise<boolean>} 是否通过验证
     * @private
     */
    async _verifyFileIntegrity(fileBlob, fileName, expectedSize, options = {}) {
        try {
            const assembler = new FileAssembler(fileName, expectedSize, {
                enableIntegrityCheck: true
            });
            
            const verificationOptions = {
                expectedSize: expectedSize,
                validateFileHeader: options.validateFileHeader !== false,
                validateContent: options.validateContent === true,
                expectedChecksum: options.expectedChecksum,
                ...options.verificationOptions
            };
            
            const result = await assembler.performIntegrityCheck(fileBlob, verificationOptions);
            
            if (!result.isValid) {
                console.error('File integrity check failed:', result.errors);
                return false;
            }
            
            if (result.warnings && result.warnings.length > 0) {
                console.warn('File integrity warnings:', result.warnings);
            }
            
            console.log('File integrity check passed');
            return true;
            
        } catch (error) {
            console.error('File integrity verification failed:', error);
            return false;
        }
    }
    
    /**
     * 降级下载处理
     * @param {string} fileId - 文件ID
     * @param {string} fileName - 文件名
     * @param {string} downloadId - 下载ID
     * @param {Error} originalError - 原始错误
     * @param {Object} options - 选项
     * @returns {Promise<boolean>} 是否成功
     * @private
     */
    async _fallbackDownload(fileId, fileName, downloadId, originalError, options = {}) {
        console.log('Attempting fallback download...');
        
        try {
            // 标记为降级下载，避免无限递归
            const fallbackOptions = {
                ...options,
                _isFallback: true,
                forceMethod: DOWNLOAD_METHOD.TRADITIONAL,
                enableIntegrityCheck: false // 降级时禁用完整性检查
            };
            
            // 记录降级原因
            this._recordFallback(downloadId, originalError);
            
            // 使用传统方法重试
            return await this.downloadFile(fileId, fileName, fallbackOptions);
            
        } catch (fallbackError) {
            console.error('Fallback download also failed:', fallbackError);
            
            // 记录降级失败
            this._recordFallbackFailure(downloadId, fallbackError);
            
            // 抛出原始错误和降级错误的组合信息
            throw new Error(
                `Both primary and fallback downloads failed. ` +
                `Primary: ${originalError.message}. ` +
                `Fallback: ${fallbackError.message}`
            );
        }
    }
    
    /**
     * 生成下载ID
     * @param {string} fileId - 文件ID
     * @param {string} fileName - 文件名
     * @returns {string} 下载ID
     * @private
     */
    _generateDownloadId(fileId, fileName) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `dl_${timestamp}_${random}_${fileId}`;
    }
    
    /**
     * 记录下载开始
     * @param {string} downloadId - 下载ID
     * @param {string} fileId - 文件ID
     * @param {string} fileName - 文件名
     * @private
     */
    _recordDownloadStart(downloadId, fileId, fileName) {
        this.downloadHistory.set(downloadId, {
            id: downloadId,
            fileId: fileId,
            fileName: fileName,
            startTime: Date.now(),
            status: 'started',
            method: null,
            attempts: []
        });
    }
    
    /**
     * 记录下载完成
     * @param {string} downloadId - 下载ID
     * @private
     */
    _recordDownloadComplete(downloadId) {
        const record = this.downloadHistory.get(downloadId);
        if (record) {
            record.status = 'completed';
            record.endTime = Date.now();
            record.duration = record.endTime - record.startTime;
        }
    }
    
    /**
     * 记录下载错误
     * @param {string} downloadId - 下载ID
     * @param {Error} error - 错误对象
     * @private
     */
    _recordDownloadError(downloadId, error) {
        const record = this.downloadHistory.get(downloadId);
        if (record) {
            record.status = 'failed';
            record.endTime = Date.now();
            record.error = error.message;
        }
    }
    
    /**
     * 记录降级处理
     * @param {string} downloadId - 下载ID
     * @param {Error} originalError - 原始错误
     * @private
     */
    _recordFallback(downloadId, originalError) {
        const record = this.downloadHistory.get(downloadId);
        if (record) {
            record.fallback = {
                reason: originalError.message,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * 记录降级失败
     * @param {string} downloadId - 下载ID
     * @param {Error} fallbackError - 降级错误
     * @private
     */
    _recordFallbackFailure(downloadId, fallbackError) {
        const record = this.downloadHistory.get(downloadId);
        if (record && record.fallback) {
            record.fallback.failed = true;
            record.fallback.error = fallbackError.message;
        }
    }
    
    /**
     * 获取下载历史
     * @param {number} limit - 限制数量
     * @returns {Array} 下载历史
     */
    getDownloadHistory(limit = 50) {
        const records = Array.from(this.downloadHistory.values());
        records.sort((a, b) => b.startTime - a.startTime);
        return records.slice(0, limit);
    }
    
    /**
     * 获取活跃下载
     * @returns {Array} 活跃下载列表
     */
    getActiveDownloads() {
        return Array.from(this.activeDownloads.entries()).map(([id, info]) => ({
            id,
            ...info
        }));
    }
    
    /**
     * 取消下载
     * @param {string} downloadId - 下载ID
     * @returns {boolean} 是否成功取消
     */
    cancelDownload(downloadId) {
        const activeDownload = this.activeDownloads.get(downloadId);
        if (activeDownload && activeDownload.type === 'chunk' && activeDownload.downloader) {
            activeDownload.downloader.cancel();
            this.activeDownloads.delete(downloadId);
            
            // 记录取消状态
            const record = this.downloadHistory.get(downloadId);
            if (record) {
                record.status = 'cancelled';
                record.endTime = Date.now();
            }
            
            return true;
        }
        return false;
    }
    
    /**
     * 清理资源
     */
    cleanup() {
        // 取消所有活跃下载
        for (const downloadId of this.activeDownloads.keys()) {
            this.cancelDownload(downloadId);
        }
        
        // 清理下载触发器
        if (this.downloadTrigger) {
            this.downloadTrigger.destroy();
        }
        
        console.log('DownloadManager cleaned up');
    }
    
    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise}
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 创建全局下载管理器实例
const globalDownloadManager = new DownloadManager({
    chunkThreshold: 1024 * 512, // 512KB
    enableChunkDownload: true,
    enableFallback: true,
    maxRetries: 3
});

// 导出
export { DownloadManager, DOWNLOAD_METHOD, globalDownloadManager };
export default DownloadManager;