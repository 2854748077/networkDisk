/**
 * 分片下载管理器
 * 处理大文件的分片下载、并发控制、断点续传和错误重试
 */

import Request from './Request.js';
import { globalRetryManager } from './RetryManager.js';

/**
 * 分片下载状态枚举
 */
const DOWNLOAD_STATUS = {
    PENDING: 'pending',           // 等待中
    DOWNLOADING: 'downloading',   // 下载中
    PAUSED: 'paused',            // 已暂停
    COMPLETED: 'completed',       // 已完成
    FAILED: 'failed',            // 失败
    CANCELLED: 'cancelled'        // 已取消
};

/**
 * 分片状态枚举
 */
const CHUNK_STATUS = {
    PENDING: 'pending',           // 等待下载
    DOWNLOADING: 'downloading',   // 下载中
    COMPLETED: 'completed',       // 已完成
    FAILED: 'failed'             // 失败
};

/**
 * 分片下载管理器类
 */
class ChunkDownloader {
    /**
     * 构造函数
     * @param {string} downloadCode - 下载码
     * @param {string} fileName - 文件名
     * @param {number} fileSize - 文件大小（字节）
     * @param {Object} options - 配置选项
     */
    constructor(downloadCode, fileName, fileSize, options = {}) {
        // 基本信息
        this.downloadCode = downloadCode;
        this.fileName = fileName;
        this.fileSize = fileSize;
        
        // 配置参数
        this.chunkSize = options.chunkSize || 1024 * 512; // 512KB，与上传保持一致
        this.concurrentLimit = options.concurrentLimit || 3; // 最大并发数
        this.maxRetries = options.maxRetries || 3; // 最大重试次数
        this.retryDelay = options.retryDelay || 1000; // 重试延迟（毫秒）
        
        // 计算分片信息
        this.totalChunks = Math.ceil(this.fileSize / this.chunkSize);
        
        // 状态管理
        this.status = DOWNLOAD_STATUS.PENDING;
        this.downloadedChunks = new Map(); // 已下载的分片数据 Map<chunkIndex, Blob>
        this.chunkStatus = new Map(); // 分片状态 Map<chunkIndex, status>
        this.retryCount = new Map(); // 重试次数 Map<chunkIndex, count>
        this.failedChunks = new Set(); // 失败的分片索引
        
        // 进度信息
        this.downloadedSize = 0;
        this.downloadProgress = 0;
        this.downloadSpeed = 0;
        this.startTime = null;
        this.lastProgressTime = null;
        this.lastDownloadedSize = 0;
        
        // 控制变量
        this.isPaused = false;
        this.isCancelled = false;
        this.activeDownloads = new Set(); // 当前活跃的下载任务
        
        // 网络状态监控
        this.isOnline = navigator.onLine;
        this.networkErrorCount = 0;
        this.lastNetworkCheck = Date.now();
        
        // 回调函数
        this.onProgress = options.onProgress || null;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;
        this.onChunkComplete = options.onChunkComplete || null;
        
        // 监听网络状态变化
        this._setupNetworkListeners();
        
        // 初始化分片状态
        this._initializeChunkStatus();
        
        // 尝试从localStorage恢复下载状态
        this._loadDownloadState();
    }
    
    /**
     * 初始化分片状态
     * @private
     */
    _initializeChunkStatus() {
        for (let i = 0; i < this.totalChunks; i++) {
            this.chunkStatus.set(i, CHUNK_STATUS.PENDING);
            this.retryCount.set(i, 0);
        }
    }
    
    /**
     * 从localStorage加载下载状态
     * @private
     */
    _loadDownloadState() {
        try {
            const storageKey = `chunk_download_${this.downloadCode}`;
            const savedState = localStorage.getItem(storageKey);
            
            if (savedState) {
                const state = JSON.parse(savedState);
                
                // 验证状态有效性
                if (state.fileName === this.fileName && 
                    state.fileSize === this.fileSize &&
                    state.totalChunks === this.totalChunks) {
                    
                    // 恢复已完成的分片状态
                    if (state.completedChunks && Array.isArray(state.completedChunks)) {
                        state.completedChunks.forEach(chunkIndex => {
                            this.chunkStatus.set(chunkIndex, CHUNK_STATUS.COMPLETED);
                        });
                        
                        // 更新下载进度
                        this._updateProgress();
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to load download state from localStorage:', error);
        }
    }
    
    /**
     * 保存下载状态到localStorage
     * @private
     */
    _saveDownloadState() {
        try {
            const storageKey = `chunk_download_${this.downloadCode}`;
            const completedChunks = [];
            
            // 收集已完成的分片索引
            for (let [chunkIndex, status] of this.chunkStatus.entries()) {
                if (status === CHUNK_STATUS.COMPLETED) {
                    completedChunks.push(chunkIndex);
                }
            }
            
            const state = {
                downloadCode: this.downloadCode,
                fileName: this.fileName,
                fileSize: this.fileSize,
                totalChunks: this.totalChunks,
                completedChunks: completedChunks,
                timestamp: Date.now()
            };
            
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save download state to localStorage:', error);
        }
    }
    
    /**
     * 开始下载
     * @returns {Promise<Blob>} 下载完成后返回完整文件的Blob对象
     */
    async start() {
        if (this.status === DOWNLOAD_STATUS.DOWNLOADING) {
            console.warn('Download is already in progress');
            return;
        }
        
        if (this.status === DOWNLOAD_STATUS.COMPLETED) {
            console.warn('Download is already completed');
            return this._assembleFile();
        }
        
        this.status = DOWNLOAD_STATUS.DOWNLOADING;
        this.isPaused = false;
        this.isCancelled = false;
        this.startTime = Date.now();
        this.lastProgressTime = this.startTime;
        this.lastDownloadedSize = this.downloadedSize;
        
        try {
            // 开始并发下载
            await this._startConcurrentDownload();
            
            if (this.isCancelled) {
                this.status = DOWNLOAD_STATUS.CANCELLED;
                throw new Error('Download was cancelled');
            }
            
            if (this.isPaused) {
                this.status = DOWNLOAD_STATUS.PAUSED;
                return;
            }
            
            // 检查是否所有分片都下载完成
            if (this._isDownloadComplete()) {
                this.status = DOWNLOAD_STATUS.COMPLETED;
                const fileBlob = await this._assembleFile();
                
                // 清理localStorage中的状态
                this._clearDownloadState();
                
                // 触发完成回调
                if (this.onComplete) {
                    this.onComplete(fileBlob);
                }
                
                return fileBlob;
            } else {
                throw new Error('Download incomplete: some chunks failed');
            }
            
        } catch (error) {
            this.status = DOWNLOAD_STATUS.FAILED;
            
            if (this.onError) {
                this.onError(error);
            }
            
            throw error;
        }
    }
    
    /**
     * 开始并发下载
     * @private
     */
    async _startConcurrentDownload() {
        const pendingChunks = [];
        
        // 收集需要下载的分片
        for (let i = 0; i < this.totalChunks; i++) {
            if (this.chunkStatus.get(i) === CHUNK_STATUS.PENDING) {
                pendingChunks.push(i);
            }
        }
        
        // 使用并发池管理下载任务
        await this._downloadWithConcurrencyPool(pendingChunks);
    }
    
    /**
     * 使用并发池管理分片下载
     * @param {Array<number>} chunkIndexes - 需要下载的分片索引数组
     * @private
     */
    async _downloadWithConcurrencyPool(chunkIndexes) {
        const downloadQueue = [...chunkIndexes];
        
        while (downloadQueue.length > 0) {
            // 检查是否暂停或取消
            if (this.isPaused || this.isCancelled) {
                break;
            }
            
            // 获取当前批次的分片（最多concurrentLimit个）
            const currentBatch = [];
            for (let i = 0; i < this.concurrentLimit && downloadQueue.length > 0; i++) {
                const chunkIndex = downloadQueue.shift();
                
                // 跳过已完成的分片
                if (this.chunkStatus.get(chunkIndex) === CHUNK_STATUS.COMPLETED) {
                    i--; // 不计入当前批次计数
                    continue;
                }
                
                currentBatch.push(chunkIndex);
            }
            
            // 如果当前批次为空，退出循环
            if (currentBatch.length === 0) {
                break;
            }
            
            // 使用Promise.all并发下载当前批次的分片
            const batchPromises = currentBatch.map(chunkIndex => 
                this._downloadChunkWithRetry(chunkIndex)
                    .catch(error => {
                        // 捕获单个分片的错误，但不中断整个批次
                        console.warn(`Chunk ${chunkIndex} failed in batch:`, error);
                        return { chunkIndex, error };
                    })
            );
            
            try {
                // 等待当前批次的所有分片下载完成
                const batchResults = await Promise.all(batchPromises);
                
                // 处理批次结果，收集需要重试的失败分片
                const failedChunks = [];
                batchResults.forEach(result => {
                    if (result && result.error && result.chunkIndex !== undefined) {
                        const chunkIndex = result.chunkIndex;
                        const retryCount = this.retryCount.get(chunkIndex) || 0;
                        
                        // 如果还有重试机会且是网络错误，加入重试队列
                        if (retryCount < this.maxRetries && this._isNetworkError(result.error)) {
                            failedChunks.push(chunkIndex);
                            console.log(`Chunk ${chunkIndex} will be retried (attempt ${retryCount + 1}/${this.maxRetries})`);
                        } else {
                            // 标记为最终失败
                            this.chunkStatus.set(chunkIndex, CHUNK_STATUS.FAILED);
                            this.failedChunks.add(chunkIndex);
                            console.error(`Chunk ${chunkIndex} failed permanently after ${retryCount} retries`);
                        }
                    }
                });
                
                // 将失败的分片重新加入下载队列的开头（优先重试）
                if (failedChunks.length > 0) {
                    downloadQueue.unshift(...failedChunks);
                    
                    // 如果有网络错误，等待一段时间再重试
                    const hasNetworkErrors = failedChunks.some(chunkIndex => {
                        const status = this.chunkStatus.get(chunkIndex);
                        return status === CHUNK_STATUS.FAILED;
                    });
                    
                    if (hasNetworkErrors && !this.isOnline) {
                        console.log('Network issues detected, waiting for recovery...');
                        const networkRecovered = await this._waitForNetworkRecovery(10000); // 等待10秒
                        if (!networkRecovered && !this.isCancelled) {
                            console.warn('Network recovery timeout, continuing with remaining chunks...');
                        }
                    } else if (failedChunks.length > 0) {
                        // 非网络错误的重试延迟
                        await this._delay(this.retryDelay);
                    }
                }
                
            } catch (error) {
                // Promise.all 不应该抛出错误，因为我们已经捕获了单个分片的错误
                console.error('Unexpected error in batch download:', error);
                
                // 将当前批次的分片重新加入队列
                downloadQueue.unshift(...currentBatch);
                
                // 等待一段时间再重试
                await this._delay(this.retryDelay * 2);
            }
        }
        
        // 检查是否还有未完成的分片
        const remainingChunks = [];
        for (let i = 0; i < this.totalChunks; i++) {
            const status = this.chunkStatus.get(i);
            if (status !== CHUNK_STATUS.COMPLETED) {
                remainingChunks.push(i);
            }
        }
        
        if (remainingChunks.length > 0) {
            console.warn(`Download completed with ${remainingChunks.length} failed chunks:`, remainingChunks);
        }
    }
    
    /**
     * 下载单个分片（带重试机制）
     * @param {number} chunkIndex - 分片索引
     * @private
     */
    async _downloadChunkWithRetry(chunkIndex) {
        try {
            // 使用全局重试管理器执行下载
            await globalRetryManager.executeWithRetry(
                async (attempt, retryId) => {
                    // 检查是否暂停或取消
                    if (this.isPaused || this.isCancelled) {
                        throw new Error('Download cancelled or paused');
                    }
                    
                    // 检查分片是否已经完成
                    if (this.chunkStatus.get(chunkIndex) === CHUNK_STATUS.COMPLETED) {
                        return; // 已完成，直接返回
                    }
                    
                    // 执行分片下载
                    await this._downloadChunk(chunkIndex);
                    
                    // 验证下载是否成功
                    if (this.chunkStatus.get(chunkIndex) !== CHUNK_STATUS.COMPLETED) {
                        throw new Error(`Chunk ${chunkIndex} download incomplete`);
                    }
                },
                {
                    maxRetries: this.maxRetries,
                    baseDelay: this.retryDelay,
                    strategy: 'exponential',
                    jitter: true,
                    onRetry: (info) => {
                        console.log(`Retrying chunk ${chunkIndex} (attempt ${info.nextAttempt}/${info.maxRetries + 1}): ${info.error.message}`);
                    },
                    onRetryFailed: (info) => {
                        console.error(`Chunk ${chunkIndex} failed after ${info.totalAttempts} attempts:`, info.finalError.message);
                        this.chunkStatus.set(chunkIndex, CHUNK_STATUS.FAILED);
                        this.failedChunks.add(chunkIndex);
                    }
                }
            );
        } catch (error) {
            // 如果重试管理器最终失败，确保分片状态正确
            if (this.chunkStatus.get(chunkIndex) !== CHUNK_STATUS.COMPLETED) {
                this.chunkStatus.set(chunkIndex, CHUNK_STATUS.FAILED);
                this.failedChunks.add(chunkIndex);
            }
            throw error;
        }
    }
    
    /**
     * 下载单个分片
     * @param {number} chunkIndex - 分片索引
     * @private
     */
    async _downloadChunk(chunkIndex) {
        if (this.isPaused || this.isCancelled) {
            return;
        }
        
        // 检查分片是否已经完成
        if (this.chunkStatus.get(chunkIndex) === CHUNK_STATUS.COMPLETED) {
            return;
        }
        
        this.chunkStatus.set(chunkIndex, CHUNK_STATUS.DOWNLOADING);
        this.activeDownloads.add(chunkIndex);
        
        try {
            const chunkData = await this._requestChunk(chunkIndex);
            
            if (this.isPaused || this.isCancelled) {
                return;
            }
            
            // 验证分片数据
            if (!chunkData || chunkData.size === 0) {
                throw new Error(`Invalid chunk data received for chunk ${chunkIndex}`);
            }
            
            // 保存分片数据
            this.downloadedChunks.set(chunkIndex, chunkData);
            this.chunkStatus.set(chunkIndex, CHUNK_STATUS.COMPLETED);
            
            // 更新进度
            this._updateProgress();
            
            // 保存状态到localStorage
            this._saveDownloadState();
            
            // 触发分片完成回调
            if (this.onChunkComplete) {
                this.onChunkComplete(chunkIndex, chunkData);
            }
            
        } catch (error) {
            // 设置分片状态为失败
            this.chunkStatus.set(chunkIndex, CHUNK_STATUS.FAILED);
            throw error;
        } finally {
            this.activeDownloads.delete(chunkIndex);
        }
    }
    
    /**
     * 请求单个分片数据
     * @param {number} chunkIndex - 分片索引
     * @returns {Promise<Blob>} 分片数据
     * @private
     */
    async _requestChunk(chunkIndex) {
        try {
            const response = await Request({
                url: `/file/downloadChunk/${this.downloadCode}`,
                params: {
                    chunkIndex: chunkIndex,
                    chunkSize: this.chunkSize
                },
                responseType: 'blob',
                showLoading: false,
                showError: false,
                timeout: 30000 // 30秒超时
            });
            
            if (!response) {
                throw new Error(`No response received for chunk ${chunkIndex}`);
            }
            
            // 验证响应数据
            if (!(response instanceof Blob)) {
                throw new Error(`Invalid response type for chunk ${chunkIndex}: expected Blob`);
            }
            
            return response;
            
        } catch (error) {
            // 增强错误信息
            const enhancedError = new Error(`Failed to download chunk ${chunkIndex}: ${error.message}`);
            enhancedError.originalError = error;
            enhancedError.chunkIndex = chunkIndex;
            enhancedError.isNetworkError = this._isNetworkError(error);
            
            throw enhancedError;
        }
    }
    
    /**
     * 检测是否为网络错误
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否为网络错误
     * @private
     */
    _isNetworkError(error) {
        if (!error) return false;
        
        // 检查错误消息中的网络相关关键词
        const networkErrorKeywords = [
            'network',
            'timeout',
            'connection',
            'fetch',
            'abort',
            'offline',
            'unreachable',
            'dns',
            'socket',
            'refused',
            'reset',
            'disconnected'
        ];
        
        const errorMessage = (error.message || '').toLowerCase();
        const hasNetworkKeyword = networkErrorKeywords.some(keyword => 
            errorMessage.includes(keyword)
        );
        
        // 检查HTTP状态码
        const isHttpError = error.status && (
            error.status === 0 ||           // 网络错误
            error.status === 408 ||         // 请求超时
            error.status === 429 ||         // 请求过多
            error.status >= 500             // 服务器错误
        );
        
        // 检查错误类型
        const isNetworkErrorType = 
            error.name === 'NetworkError' ||
            error.name === 'TimeoutError' ||
            error.name === 'AbortError' ||
            error.code === 'NETWORK_ERROR' ||
            error.code === 'TIMEOUT';
        
        // 检查是否为连接相关错误
        const isConnectionError = 
            error.type === 'error' ||
            error.type === 'timeout' ||
            !navigator.onLine; // 检查网络连接状态
        
        return hasNetworkKeyword || isHttpError || isNetworkErrorType || isConnectionError;
    }
    
    /**
     * 更新下载进度
     * @private
     */
    _updateProgress() {
        const completedChunks = Array.from(this.chunkStatus.values())
            .filter(status => status === CHUNK_STATUS.COMPLETED).length;
        
        this.downloadProgress = Math.floor((completedChunks / this.totalChunks) * 100);
        
        // 计算已下载大小
        let downloadedSize = 0;
        for (let i = 0; i < this.totalChunks; i++) {
            if (this.chunkStatus.get(i) === CHUNK_STATUS.COMPLETED) {
                if (i === this.totalChunks - 1) {
                    // 最后一个分片可能小于标准分片大小
                    downloadedSize += this.fileSize - (i * this.chunkSize);
                } else {
                    downloadedSize += this.chunkSize;
                }
            }
        }
        
        this.downloadedSize = downloadedSize;
        
        // 计算下载速度
        const currentTime = Date.now();
        if (this.lastProgressTime && currentTime > this.lastProgressTime) {
            const timeDiff = (currentTime - this.lastProgressTime) / 1000; // 秒
            const sizeDiff = this.downloadedSize - this.lastDownloadedSize;
            this.downloadSpeed = sizeDiff / timeDiff; // 字节/秒
            
            this.lastProgressTime = currentTime;
            this.lastDownloadedSize = this.downloadedSize;
        }
        
        // 触发进度回调
        if (this.onProgress) {
            this.onProgress({
                progress: this.downloadProgress,
                downloadedSize: this.downloadedSize,
                totalSize: this.fileSize,
                speed: this.downloadSpeed,
                completedChunks: completedChunks,
                totalChunks: this.totalChunks
            });
        }
    }
    
    /**
     * 检查下载是否完成
     * @returns {boolean}
     * @private
     */
    _isDownloadComplete() {
        for (let i = 0; i < this.totalChunks; i++) {
            if (this.chunkStatus.get(i) !== CHUNK_STATUS.COMPLETED) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * 组装文件
     * @returns {Promise<Blob>} 完整文件的Blob对象
     * @private
     */
    async _assembleFile() {
        const chunks = [];
        
        // 按顺序收集所有分片
        for (let i = 0; i < this.totalChunks; i++) {
            const chunkData = this.downloadedChunks.get(i);
            if (!chunkData) {
                throw new Error(`Missing chunk ${i}`);
            }
            chunks.push(chunkData);
        }
        
        // 创建完整文件的Blob
        return new Blob(chunks);
    }
    
    /**
     * 暂停下载
     */
    pause() {
        if (this.status === DOWNLOAD_STATUS.DOWNLOADING) {
            this.isPaused = true;
            this.status = DOWNLOAD_STATUS.PAUSED;
        }
    }
    
    /**
     * 恢复下载
     */
    resume() {
        if (this.status === DOWNLOAD_STATUS.PAUSED) {
            this.isPaused = false;
            return this.start();
        }
    }
    
    /**
     * 取消下载
     */
    cancel() {
        this.isCancelled = true;
        this.status = DOWNLOAD_STATUS.CANCELLED;
        
        // 清理localStorage中的状态
        this._clearDownloadState();
    }
    
    /**
     * 获取下载状态信息
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            status: this.status,
            progress: this.downloadProgress,
            downloadedSize: this.downloadedSize,
            totalSize: this.fileSize,
            speed: this.downloadSpeed,
            completedChunks: Array.from(this.chunkStatus.values())
                .filter(status => status === CHUNK_STATUS.COMPLETED).length,
            totalChunks: this.totalChunks,
            failedChunks: Array.from(this.failedChunks),
            activeDownloads: Array.from(this.activeDownloads)
        };
    }
    
    /**
     * 清理localStorage中的下载状态
     * @private
     */
    _clearDownloadState() {
        try {
            const storageKey = `chunk_download_${this.downloadCode}`;
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.warn('Failed to clear download state from localStorage:', error);
        }
    }
    
    /**
     * 设置网络状态监听器
     * @private
     */
    _setupNetworkListeners() {
        // 监听网络连接状态变化
        window.addEventListener('online', () => {
            console.log('Network connection restored');
            this.isOnline = true;
            this.networkErrorCount = 0;
            
            // 如果下载因网络问题暂停，自动恢复
            if (this.status === DOWNLOAD_STATUS.PAUSED && !this.isPaused) {
                console.log('Auto-resuming download after network restoration');
                this.resume();
            }
        });
        
        window.addEventListener('offline', () => {
            console.log('Network connection lost');
            this.isOnline = false;
            
            // 网络断开时暂停下载
            if (this.status === DOWNLOAD_STATUS.DOWNLOADING) {
                console.log('Pausing download due to network disconnection');
                this.pause();
            }
        });
    }
    
    /**
     * 检查网络连接状态
     * @returns {Promise<boolean>} 网络是否可用
     * @private
     */
    async _checkNetworkStatus() {
        // 更新基本的在线状态
        this.isOnline = navigator.onLine;
        
        // 如果基本检查显示离线，直接返回
        if (!this.isOnline) {
            return false;
        }
        
        // 进行更详细的网络连通性检查
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
            
            const response = await fetch('/api/ping', {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            
            const isConnected = response.ok;
            this.isOnline = isConnected;
            this.lastNetworkCheck = Date.now();
            
            return isConnected;
            
        } catch (error) {
            console.warn('Network connectivity check failed:', error);
            this.isOnline = false;
            this.networkErrorCount++;
            return false;
        }
    }
    
    /**
     * 等待网络恢复
     * @param {number} maxWaitTime - 最大等待时间（毫秒）
     * @returns {Promise<boolean>} 网络是否恢复
     * @private
     */
    async _waitForNetworkRecovery(maxWaitTime = 30000) {
        const startTime = Date.now();
        const checkInterval = 2000; // 每2秒检查一次
        
        while (Date.now() - startTime < maxWaitTime) {
            if (this.isCancelled) {
                return false;
            }
            
            const isOnline = await this._checkNetworkStatus();
            if (isOnline) {
                console.log('Network connection recovered');
                return true;
            }
            
            console.log('Waiting for network recovery...');
            await this._delay(checkInterval);
        }
        
        console.warn('Network recovery timeout');
        return false;
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

    /**
     * 检测 ArrayBuffer 支持
     * @returns {boolean} 是否支持 ArrayBuffer
     */
    isArrayBufferSupported() {
        return typeof ArrayBuffer !== 'undefined';
    }

    /**
     * 检测 Blob 支持
     * @returns {boolean} 是否支持 Blob
     */
    isBlobSupported() {
        return typeof Blob !== 'undefined';
    }

    /**
     * 检测 URL.createObjectURL 支持
     * @returns {boolean} 是否支持 URL.createObjectURL
     */
    isCreateObjectURLSupported() {
        return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    }

    /**
     * 检测 localStorage 支持
     * @returns {boolean} 是否支持 localStorage
     */
    isLocalStorageSupported() {
        try {
            return typeof localStorage !== 'undefined' && localStorage !== null;
        } catch (e) {
            return false;
        }
    }

    /**
     * 检测是否可以保存进度
     * @returns {boolean} 是否可以保存进度
     */
    canSaveProgress() {
        if (!this.isLocalStorageSupported()) {
            return false;
        }
        
        try {
            const testKey = '__test_storage__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 获取最优分片大小
     * @returns {number} 最优分片大小
     */
    getOptimalChunkSize() {
        const connection = navigator.connection;
        let chunkSize = 512 * 1024; // 默认 512KB
        
        if (connection) {
            const downlink = connection.downlink || 1;
            const effectiveType = connection.effectiveType;
            
            if (effectiveType === 'slow-2g' || effectiveType === '2g') {
                chunkSize = 128 * 1024; // 128KB for slow networks
            } else if (effectiveType === '3g') {
                chunkSize = 256 * 1024; // 256KB for 3G
            } else if (downlink > 10) {
                chunkSize = 1024 * 1024; // 1MB for fast networks
            }
        }
        
        // 根据设备内存调整
        const memory = navigator.deviceMemory || 4;
        if (memory < 2) {
            chunkSize = Math.min(chunkSize, 256 * 1024);
        }
        
        return chunkSize;
    }

    /**
     * 获取最优并发数
     * @returns {number} 最优并发数
     */
    getOptimalConcurrency() {
        // 根据设备性能和网络状况动态调整
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory || 4;
        const connection = navigator.connection;
        
        let concurrency = Math.min(cores, this.concurrentLimit);
        
        // 根据内存调整
        if (memory < 2) {
            concurrency = Math.min(concurrency, 2);
        }
        
        // 根据网络状况调整
        if (connection) {
            const effectiveType = connection.effectiveType;
            if (effectiveType === 'slow-2g' || effectiveType === '2g') {
                concurrency = Math.min(concurrency, 1);
            } else if (effectiveType === '3g') {
                concurrency = Math.min(concurrency, 2);
            }
        }
        
        return Math.max(1, concurrency);
    }nection) {
            const effectiveType = connection.effectiveType;
            if (effectiveType === 'slow-2g' || effectiveType === '2g') {
                concurrency = 1;
            } else if (effectiveType === '3g') {
                concurrency = Math.min(concurrency, 2);
            }
        }
        
        return Math.max(1, concurrency);
    }

    /**
     * 检测是否支持分片下载
     * @returns {boolean} 是否支持分片下载
     */
    isChunkedDownloadSupported() {
        return this.isArrayBufferSupported() && 
               this.isBlobSupported() && 
               this.isCreateObjectURLSupported() &&
               typeof fetch !== 'undefined';
    }
}

// 导出类和常量
export { ChunkDownloader, DOWNLOAD_STATUS, CHUNK_STATUS };
export default ChunkDownloader;