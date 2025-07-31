/**
 * 下载触发器
 * 处理浏览器下载触发、URL管理和内存清理
 */

/**
 * 下载触发器类
 */
class DownloadTrigger {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        // 配置参数
        this.autoCleanup = options.autoCleanup !== false; // 默认启用自动清理
        this.cleanupDelay = options.cleanupDelay || 5000; // 清理延迟（毫秒）
        this.maxRetries = options.maxRetries || 3; // 最大重试次数
        
        // 状态管理
        this.activeUrls = new Set(); // 活跃的URL对象
        this.downloadHistory = new Map(); // 下载历史记录
        this.cleanupTimers = new Map(); // 清理定时器
        
        // 回调函数
        this.onDownloadStart = options.onDownloadStart || null;
        this.onDownloadComplete = options.onDownloadComplete || null;
        this.onDownloadError = options.onDownloadError || null;
        this.onCleanup = options.onCleanup || null;
    }
    
    /**
     * 触发文件下载
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {string} fileName - 文件名
     * @param {Object} options - 下载选项
     * @returns {Promise<boolean>} 下载是否成功触发
     */
    async triggerDownload(fileBlob, fileName, options = {}) {
        if (!fileBlob || !(fileBlob instanceof Blob)) {
            throw new Error('Invalid file blob provided');
        }
        
        if (!fileName || typeof fileName !== 'string') {
            throw new Error('Invalid file name provided');
        }
        
        const downloadId = this._generateDownloadId(fileName);
        
        try {
            // 记录下载开始
            this._recordDownloadStart(downloadId, fileName, fileBlob.size);
            
            // 触发下载开始回调
            if (this.onDownloadStart) {
                this.onDownloadStart({
                    downloadId,
                    fileName,
                    fileSize: fileBlob.size
                });
            }
            
            // 尝试使用不同的下载方法
            let success = false;
            let lastError = null;
            
            for (let attempt = 0; attempt < this.maxRetries && !success; attempt++) {
                try {
                    if (attempt === 0) {
                        // 首先尝试使用URL.createObjectURL方法
                        success = await this._downloadWithObjectURL(fileBlob, fileName, downloadId);
                    } else if (attempt === 1) {
                        // 如果失败，尝试使用Data URL方法（适用于小文件）
                        if (fileBlob.size <= 10 * 1024 * 1024) { // 10MB以下
                            success = await this._downloadWithDataURL(fileBlob, fileName, downloadId);
                        }
                    } else {
                        // 最后尝试使用FileSaver.js兼容方法
                        success = await this._downloadWithFileSaver(fileBlob, fileName, downloadId);
                    }
                } catch (error) {
                    lastError = error;
                    console.warn(`Download attempt ${attempt + 1} failed:`, error.message);
                    
                    // 短暂延迟后重试
                    if (attempt < this.maxRetries - 1) {
                        await this._delay(1000 * (attempt + 1));
                    }
                }
            }
            
            if (success) {
                // 记录下载成功
                this._recordDownloadComplete(downloadId);
                
                // 触发下载完成回调
                if (this.onDownloadComplete) {
                    this.onDownloadComplete({
                        downloadId,
                        fileName,
                        fileSize: fileBlob.size
                    });
                }
                
                return true;
            } else {
                // 所有方法都失败了
                const error = lastError || new Error('All download methods failed');
                this._recordDownloadError(downloadId, error);
                
                if (this.onDownloadError) {
                    this.onDownloadError({
                        downloadId,
                        fileName,
                        error
                    });
                }
                
                throw error;
            }
            
        } catch (error) {
            console.error('Download trigger failed:', error);
            throw error;
        }
    }
    
    /**
     * 使用Object URL方法下载文件
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {string} fileName - 文件名
     * @param {string} downloadId - 下载ID
     * @returns {Promise<boolean>} 是否成功
     * @private
     */
    async _downloadWithObjectURL(fileBlob, fileName, downloadId) {
        try {
            // 创建Object URL
            const objectUrl = URL.createObjectURL(fileBlob);
            this.activeUrls.add(objectUrl);
            
            // 创建下载链接
            const downloadLink = document.createElement('a');
            downloadLink.href = objectUrl;
            downloadLink.download = fileName;
            downloadLink.style.display = 'none';
            
            // 添加到DOM并触发点击
            document.body.appendChild(downloadLink);
            downloadLink.click();
            
            // 立即从DOM中移除链接
            document.body.removeChild(downloadLink);
            
            // 设置自动清理
            if (this.autoCleanup) {
                this._scheduleCleanup(objectUrl, downloadId);
            }
            
            console.log(`Download triggered using Object URL: ${fileName}`);
            return true;
            
        } catch (error) {
            console.error('Object URL download failed:', error);
            throw new Error('Object URL download method failed: ' + error.message);
        }
    }
    
    /**
     * 使用Data URL方法下载文件（适用于小文件）
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {string} fileName - 文件名
     * @param {string} downloadId - 下载ID
     * @returns {Promise<boolean>} 是否成功
     * @private
     */
    async _downloadWithDataURL(fileBlob, fileName, downloadId) {
        try {
            // 将Blob转换为Data URL
            const dataUrl = await this._blobToDataURL(fileBlob);
            
            // 创建下载链接
            const downloadLink = document.createElement('a');
            downloadLink.href = dataUrl;
            downloadLink.download = fileName;
            downloadLink.style.display = 'none';
            
            // 添加到DOM并触发点击
            document.body.appendChild(downloadLink);
            downloadLink.click();
            
            // 立即从DOM中移除链接
            document.body.removeChild(downloadLink);
            
            console.log(`Download triggered using Data URL: ${fileName}`);
            return true;
            
        } catch (error) {
            console.error('Data URL download failed:', error);
            throw new Error('Data URL download method failed: ' + error.message);
        }
    }
    
    /**
     * 使用FileSaver.js兼容方法下载文件
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {string} fileName - 文件名
     * @param {string} downloadId - 下载ID
     * @returns {Promise<boolean>} 是否成功
     * @private
     */
    async _downloadWithFileSaver(fileBlob, fileName, downloadId) {
        try {
            // 检查是否支持msSaveOrOpenBlob（IE/Edge）
            if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(fileBlob, fileName);
                console.log(`Download triggered using msSaveOrOpenBlob: ${fileName}`);
                return true;
            }
            
            // 检查是否支持webkitURL（Safari）
            if (window.webkitURL) {
                const objectUrl = window.webkitURL.createObjectURL(fileBlob);
                this.activeUrls.add(objectUrl);
                
                const downloadLink = document.createElement('a');
                downloadLink.href = objectUrl;
                downloadLink.download = fileName;
                downloadLink.style.display = 'none';
                
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                // 设置自动清理
                if (this.autoCleanup) {
                    this._scheduleCleanup(objectUrl, downloadId);
                }
                
                console.log(`Download triggered using webkitURL: ${fileName}`);
                return true;
            }
            
            // 如果都不支持，抛出错误
            throw new Error('No compatible download method available');
            
        } catch (error) {
            console.error('FileSaver compatible download failed:', error);
            throw new Error('FileSaver compatible download method failed: ' + error.message);
        }
    }
    
    /**
     * 将Blob转换为Data URL
     * @param {Blob} blob - Blob对象
     * @returns {Promise<string>} Data URL字符串
     * @private
     */
    _blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(event) {
                resolve(event.target.result);
            };
            
            reader.onerror = function(error) {
                reject(new Error('Failed to convert blob to data URL: ' + error.message));
            };
            
            reader.readAsDataURL(blob);
        });
    }
    
    /**
     * 生成下载ID
     * @param {string} fileName - 文件名
     * @returns {string} 下载ID
     * @private
     */
    _generateDownloadId(fileName) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `download_${timestamp}_${random}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    
    /**
     * 记录下载开始
     * @param {string} downloadId - 下载ID
     * @param {string} fileName - 文件名
     * @param {number} fileSize - 文件大小
     * @private
     */
    _recordDownloadStart(downloadId, fileName, fileSize) {
        this.downloadHistory.set(downloadId, {
            id: downloadId,
            fileName: fileName,
            fileSize: fileSize,
            startTime: Date.now(),
            status: 'started'
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
     * 安排URL清理
     * @param {string} objectUrl - Object URL
     * @param {string} downloadId - 下载ID
     * @private
     */
    _scheduleCleanup(objectUrl, downloadId) {
        // 清除之前的定时器（如果存在）
        if (this.cleanupTimers.has(downloadId)) {
            clearTimeout(this.cleanupTimers.get(downloadId));
        }
        
        // 设置新的清理定时器
        const timerId = setTimeout(() => {
            this._cleanupUrl(objectUrl, downloadId);
        }, this.cleanupDelay);
        
        this.cleanupTimers.set(downloadId, timerId);
    }
    
    /**
     * 清理URL对象
     * @param {string} objectUrl - Object URL
     * @param {string} downloadId - 下载ID
     * @private
     */
    _cleanupUrl(objectUrl, downloadId) {
        try {
            if (this.activeUrls.has(objectUrl)) {
                URL.revokeObjectURL(objectUrl);
                this.activeUrls.delete(objectUrl);
                
                console.log(`Cleaned up Object URL for download: ${downloadId}`);
                
                // 触发清理回调
                if (this.onCleanup) {
                    this.onCleanup({
                        downloadId,
                        objectUrl,
                        cleanupTime: Date.now()
                    });
                }
            }
        } catch (error) {
            console.warn(`Failed to cleanup Object URL for download ${downloadId}:`, error);
        } finally {
            // 清除定时器记录
            this.cleanupTimers.delete(downloadId);
        }
    }
    
    /**
     * 手动清理所有活跃的URL
     */
    cleanupAllUrls() {
        console.log(`Cleaning up ${this.activeUrls.size} active URLs`);
        
        for (const objectUrl of this.activeUrls) {
            try {
                URL.revokeObjectURL(objectUrl);
            } catch (error) {
                console.warn('Failed to revoke Object URL:', error);
            }
        }
        
        this.activeUrls.clear();
        
        // 清除所有定时器
        for (const timerId of this.cleanupTimers.values()) {
            clearTimeout(timerId);
        }
        this.cleanupTimers.clear();
    }
    
    /**
     * 获取下载历史
     * @param {number} limit - 返回记录数限制
     * @returns {Array} 下载历史记录
     */
    getDownloadHistory(limit = 50) {
        const records = Array.from(this.downloadHistory.values());
        
        // 按开始时间倒序排列
        records.sort((a, b) => b.startTime - a.startTime);
        
        // 限制返回数量
        return records.slice(0, limit);
    }
    
    /**
     * 清理下载历史
     * @param {number} maxAge - 最大保留时间（毫秒）
     */
    cleanupHistory(maxAge = 24 * 60 * 60 * 1000) { // 默认24小时
        const cutoffTime = Date.now() - maxAge;
        const toDelete = [];
        
        for (const [downloadId, record] of this.downloadHistory.entries()) {
            if (record.startTime < cutoffTime) {
                toDelete.push(downloadId);
            }
        }
        
        toDelete.forEach(downloadId => {
            this.downloadHistory.delete(downloadId);
        });
        
        if (toDelete.length > 0) {
            console.log(`Cleaned up ${toDelete.length} old download records`);
        }
    }
    
    /**
     * 获取当前状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            activeUrls: this.activeUrls.size,
            downloadHistory: this.downloadHistory.size,
            cleanupTimers: this.cleanupTimers.size,
            recentDownloads: this.getDownloadHistory(10)
        };
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
     * 销毁下载触发器，清理所有资源
     */
    destroy() {
        // 清理所有URL
        this.cleanupAllUrls();
        
        // 清空历史记录
        this.downloadHistory.clear();
        
        console.log('DownloadTrigger destroyed and all resources cleaned up');
    }
}

export default DownloadTrigger;