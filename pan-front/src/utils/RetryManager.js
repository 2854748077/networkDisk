/**
 * 重试管理器
 * 实现智能重试策略、错误处理和状态监控
 */

/**
 * 重试策略枚举
 */
const RETRY_STRATEGY = {
    FIXED: 'fixed',           // 固定间隔
    EXPONENTIAL: 'exponential', // 指数退避
    LINEAR: 'linear',         // 线性增长
    CUSTOM: 'custom'          // 自定义策略
};

/**
 * 错误类型枚举
 */
const ERROR_TYPE = {
    NETWORK: 'network',       // 网络错误
    TIMEOUT: 'timeout',       // 超时错误
    SERVER: 'server',         // 服务器错误
    CLIENT: 'client',         // 客户端错误
    UNKNOWN: 'unknown'        // 未知错误
};

/**
 * 重试管理器类
 */
class RetryManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        // 基本配置
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000; // 基础延迟（毫秒）
        this.maxDelay = options.maxDelay || 30000; // 最大延迟（毫秒）
        this.strategy = options.strategy || RETRY_STRATEGY.EXPONENTIAL;
        this.jitter = options.jitter !== false; // 是否添加随机抖动
        
        // 错误处理配置
        this.retryableErrors = options.retryableErrors || [
            ERROR_TYPE.NETWORK,
            ERROR_TYPE.TIMEOUT,
            ERROR_TYPE.SERVER
        ];
        this.nonRetryableErrors = options.nonRetryableErrors || [
            ERROR_TYPE.CLIENT
        ];
        
        // 状态监控
        this.retryHistory = new Map(); // 重试历史记录
        this.activeRetries = new Map(); // 活跃的重试任务
        this.errorStats = new Map(); // 错误统计
        
        // 回调函数
        this.onRetry = options.onRetry || null;
        this.onRetryFailed = options.onRetryFailed || null;
        this.onRetrySuccess = options.onRetrySuccess || null;
        this.onError = options.onError || null;
        
        // 自定义重试策略函数
        this.customRetryStrategy = options.customRetryStrategy || null;
        
        // 网络状态监控
        this.isOnline = navigator.onLine;
        this._setupNetworkMonitoring();
    }
    
    /**
     * 执行带重试的异步操作
     * @param {Function} operation - 要执行的异步操作
     * @param {Object} options - 重试选项
     * @returns {Promise} 操作结果
     */
    async executeWithRetry(operation, options = {}) {
        const retryId = this._generateRetryId();
        const config = this._mergeConfig(options);
        
        // 记录重试开始
        this._recordRetryStart(retryId, config);
        
        let lastError = null;
        let attempt = 0;
        
        while (attempt <= config.maxRetries) {
            try {
                // 记录当前尝试
                this._recordAttempt(retryId, attempt);
                
                // 执行操作
                const result = await operation(attempt, retryId);
                
                // 操作成功
                this._recordRetrySuccess(retryId, attempt);
                
                if (this.onRetrySuccess && attempt > 0) {
                    this.onRetrySuccess({
                        retryId,
                        attempt,
                        totalAttempts: attempt + 1,
                        result
                    });
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                attempt++;
                
                // 分析错误类型
                const errorType = this._analyzeError(error);
                this._recordError(retryId, attempt - 1, error, errorType);
                
                // 检查是否应该重试
                const shouldRetry = this._shouldRetry(error, errorType, attempt, config);
                
                if (!shouldRetry || attempt > config.maxRetries) {
                    // 不再重试，记录最终失败
                    this._recordRetryFailed(retryId, attempt - 1, lastError);
                    
                    if (this.onRetryFailed) {
                        this.onRetryFailed({
                            retryId,
                            totalAttempts: attempt,
                            finalError: lastError,
                            errorType
                        });
                    }
                    
                    throw lastError;
                }
                
                // 计算重试延迟
                const delay = this._calculateDelay(attempt - 1, config, errorType);
                
                // 触发重试回调
                if (this.onRetry) {
                    this.onRetry({
                        retryId,
                        attempt: attempt - 1,
                        nextAttempt: attempt,
                        error: lastError,
                        errorType,
                        delay,
                        maxRetries: config.maxRetries
                    });
                }
                
                // 等待重试延迟
                await this._waitForRetry(delay, retryId);
                
                // 检查网络状态
                if (!this.isOnline) {
                    await this._waitForNetworkRecovery(config.networkRecoveryTimeout || 30000);
                }
            }
        }
        
        // 理论上不应该到达这里
        throw lastError;
    }
    
    /**
     * 合并配置选项
     * @param {Object} options - 选项
     * @returns {Object} 合并后的配置
     * @private
     */
    _mergeConfig(options) {
        return {
            maxRetries: options.maxRetries ?? this.maxRetries,
            baseDelay: options.baseDelay ?? this.baseDelay,
            maxDelay: options.maxDelay ?? this.maxDelay,
            strategy: options.strategy ?? this.strategy,
            jitter: options.jitter ?? this.jitter,
            retryableErrors: options.retryableErrors ?? this.retryableErrors,
            nonRetryableErrors: options.nonRetryableErrors ?? this.nonRetryableErrors,
            customRetryStrategy: options.customRetryStrategy ?? this.customRetryStrategy,
            networkRecoveryTimeout: options.networkRecoveryTimeout ?? 30000
        };
    }
    
    /**
     * 分析错误类型
     * @param {Error} error - 错误对象
     * @returns {string} 错误类型
     * @private
     */
    _analyzeError(error) {
        if (!error) return ERROR_TYPE.UNKNOWN;
        
        const errorMessage = (error.message || '').toLowerCase();
        const errorName = (error.name || '').toLowerCase();
        const errorCode = error.code;
        const errorStatus = error.status;
        
        // 网络错误检测
        const networkKeywords = [
            'network', 'fetch', 'connection', 'unreachable', 
            'dns', 'socket', 'refused', 'reset', 'disconnected'
        ];
        
        if (networkKeywords.some(keyword => errorMessage.includes(keyword)) ||
            errorName === 'networkerror' ||
            errorCode === 'NETWORK_ERROR' ||
            errorStatus === 0) {
            return ERROR_TYPE.NETWORK;
        }
        
        // 超时错误检测
        const timeoutKeywords = ['timeout', 'abort'];
        if (timeoutKeywords.some(keyword => errorMessage.includes(keyword)) ||
            errorName === 'timeouterror' ||
            errorCode === 'TIMEOUT' ||
            errorStatus === 408) {
            return ERROR_TYPE.TIMEOUT;
        }
        
        // 服务器错误检测
        if (errorStatus >= 500 && errorStatus < 600) {
            return ERROR_TYPE.SERVER;
        }
        
        // 客户端错误检测
        if (errorStatus >= 400 && errorStatus < 500) {
            return ERROR_TYPE.CLIENT;
        }
        
        return ERROR_TYPE.UNKNOWN;
    }
    
    /**
     * 判断是否应该重试
     * @param {Error} error - 错误对象
     * @param {string} errorType - 错误类型
     * @param {number} attempt - 当前尝试次数
     * @param {Object} config - 配置
     * @returns {boolean} 是否应该重试
     * @private
     */
    _shouldRetry(error, errorType, attempt, config) {
        // 检查是否超过最大重试次数
        if (attempt > config.maxRetries) {
            return false;
        }
        
        // 检查是否为不可重试的错误类型
        if (config.nonRetryableErrors.includes(errorType)) {
            return false;
        }
        
        // 检查是否为可重试的错误类型
        if (!config.retryableErrors.includes(errorType)) {
            return false;
        }
        
        // 特殊情况：如果是网络错误且当前离线，等待网络恢复
        if (errorType === ERROR_TYPE.NETWORK && !this.isOnline) {
            return true;
        }
        
        return true;
    }
    
    /**
     * 计算重试延迟
     * @param {number} attempt - 尝试次数（从0开始）
     * @param {Object} config - 配置
     * @param {string} errorType - 错误类型
     * @returns {number} 延迟时间（毫秒）
     * @private
     */
    _calculateDelay(attempt, config, errorType) {
        let delay;
        
        switch (config.strategy) {
            case RETRY_STRATEGY.FIXED:
                delay = config.baseDelay;
                break;
                
            case RETRY_STRATEGY.LINEAR:
                delay = config.baseDelay * (attempt + 1);
                break;
                
            case RETRY_STRATEGY.EXPONENTIAL:
                delay = config.baseDelay * Math.pow(2, attempt);
                break;
                
            case RETRY_STRATEGY.CUSTOM:
                if (config.customRetryStrategy) {
                    delay = config.customRetryStrategy(attempt, errorType, config);
                } else {
                    delay = config.baseDelay * Math.pow(2, attempt);
                }
                break;
                
            default:
                delay = config.baseDelay * Math.pow(2, attempt);
        }
        
        // 限制最大延迟
        delay = Math.min(delay, config.maxDelay);
        
        // 添加随机抖动以避免雷群效应
        if (config.jitter) {
            const jitterAmount = delay * 0.1; // 10%的抖动
            delay += (Math.random() - 0.5) * 2 * jitterAmount;
        }
        
        // 确保延迟为正数
        return Math.max(delay, 0);
    }
    
    /**
     * 等待重试延迟
     * @param {number} delay - 延迟时间
     * @param {string} retryId - 重试ID
     * @returns {Promise}
     * @private
     */
    async _waitForRetry(delay, retryId) {
        return new Promise((resolve, reject) => {
            const timerId = setTimeout(() => {
                this.activeRetries.delete(retryId);
                resolve();
            }, delay);
            
            // 记录活跃的重试任务
            this.activeRetries.set(retryId, {
                timerId,
                startTime: Date.now(),
                delay
            });
        });
    }
    
    /**
     * 等待网络恢复
     * @param {number} timeout - 超时时间
     * @returns {Promise<boolean>} 是否恢复
     * @private
     */
    async _waitForNetworkRecovery(timeout = 30000) {
        if (this.isOnline) {
            return true;
        }
        
        console.log('Network is offline, waiting for recovery...');
        
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkNetwork = () => {
                if (this.isOnline) {
                    console.log('Network recovered');
                    resolve(true);
                    return;
                }
                
                if (Date.now() - startTime >= timeout) {
                    console.warn('Network recovery timeout');
                    resolve(false);
                    return;
                }
                
                // 每2秒检查一次
                setTimeout(checkNetwork, 2000);
            };
            
            checkNetwork();
        });
    }
    
    /**
     * 生成重试ID
     * @returns {string} 重试ID
     * @private
     */
    _generateRetryId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `retry_${timestamp}_${random}`;
    }
    
    /**
     * 记录重试开始
     * @param {string} retryId - 重试ID
     * @param {Object} config - 配置
     * @private
     */
    _recordRetryStart(retryId, config) {
        this.retryHistory.set(retryId, {
            id: retryId,
            startTime: Date.now(),
            config: { ...config },
            attempts: [],
            status: 'running'
        });
    }
    
    /**
     * 记录尝试
     * @param {string} retryId - 重试ID
     * @param {number} attempt - 尝试次数
     * @private
     */
    _recordAttempt(retryId, attempt) {
        const record = this.retryHistory.get(retryId);
        if (record) {
            record.attempts.push({
                attempt,
                startTime: Date.now(),
                status: 'running'
            });
        }
    }
    
    /**
     * 记录错误
     * @param {string} retryId - 重试ID
     * @param {number} attempt - 尝试次数
     * @param {Error} error - 错误对象
     * @param {string} errorType - 错误类型
     * @private
     */
    _recordError(retryId, attempt, error, errorType) {
        const record = this.retryHistory.get(retryId);
        if (record && record.attempts[attempt]) {
            record.attempts[attempt].status = 'failed';
            record.attempts[attempt].error = error.message;
            record.attempts[attempt].errorType = errorType;
            record.attempts[attempt].endTime = Date.now();
        }
        
        // 更新错误统计
        this._updateErrorStats(errorType);
    }
    
    /**
     * 记录重试成功
     * @param {string} retryId - 重试ID
     * @param {number} attempt - 尝试次数
     * @private
     */
    _recordRetrySuccess(retryId, attempt) {
        const record = this.retryHistory.get(retryId);
        if (record) {
            record.status = 'success';
            record.endTime = Date.now();
            record.totalAttempts = attempt + 1;
            
            if (record.attempts[attempt]) {
                record.attempts[attempt].status = 'success';
                record.attempts[attempt].endTime = Date.now();
            }
        }
    }
    
    /**
     * 记录重试失败
     * @param {string} retryId - 重试ID
     * @param {number} attempt - 尝试次数
     * @param {Error} error - 最终错误
     * @private
     */
    _recordRetryFailed(retryId, attempt, error) {
        const record = this.retryHistory.get(retryId);
        if (record) {
            record.status = 'failed';
            record.endTime = Date.now();
            record.totalAttempts = attempt + 1;
            record.finalError = error.message;
        }
    }
    
    /**
     * 更新错误统计
     * @param {string} errorType - 错误类型
     * @private
     */
    _updateErrorStats(errorType) {
        const stats = this.errorStats.get(errorType) || {
            count: 0,
            firstOccurrence: Date.now(),
            lastOccurrence: Date.now()
        };
        
        stats.count++;
        stats.lastOccurrence = Date.now();
        
        this.errorStats.set(errorType, stats);
    }
    
    /**
     * 设置网络状态监控
     * @private
     */
    _setupNetworkMonitoring() {
        // 监听网络状态变化
        window.addEventListener('online', () => {
            console.log('Network connection restored');
            this.isOnline = true;
        });
        
        window.addEventListener('offline', () => {
            console.log('Network connection lost');
            this.isOnline = false;
        });
        
        // 定期检查网络连通性
        this._startNetworkHealthCheck();
    }
    
    /**
     * 开始网络健康检查
     * @private
     */
    _startNetworkHealthCheck() {
        setInterval(async () => {
            try {
                // 尝试发送一个轻量级的网络请求
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch('/api/ping', {
                    method: 'HEAD',
                    signal: controller.signal,
                    cache: 'no-cache'
                });
                
                clearTimeout(timeoutId);
                
                const wasOnline = this.isOnline;
                this.isOnline = response.ok;
                
                // 如果网络状态发生变化，触发相应事件
                if (!wasOnline && this.isOnline) {
                    window.dispatchEvent(new Event('online'));
                } else if (wasOnline && !this.isOnline) {
                    window.dispatchEvent(new Event('offline'));
                }
                
            } catch (error) {
                const wasOnline = this.isOnline;
                this.isOnline = false;
                
                if (wasOnline) {
                    window.dispatchEvent(new Event('offline'));
                }
            }
        }, 30000); // 每30秒检查一次
    }
    
    /**
     * 取消重试任务
     * @param {string} retryId - 重试ID
     * @returns {boolean} 是否成功取消
     */
    cancelRetry(retryId) {
        const activeRetry = this.activeRetries.get(retryId);
        if (activeRetry) {
            clearTimeout(activeRetry.timerId);
            this.activeRetries.delete(retryId);
            
            // 更新记录状态
            const record = this.retryHistory.get(retryId);
            if (record) {
                record.status = 'cancelled';
                record.endTime = Date.now();
            }
            
            return true;
        }
        return false;
    }
    
    /**
     * 获取重试历史
     * @param {number} limit - 限制数量
     * @returns {Array} 重试历史
     */
    getRetryHistory(limit = 50) {
        const records = Array.from(this.retryHistory.values());
        records.sort((a, b) => b.startTime - a.startTime);
        return records.slice(0, limit);
    }
    
    /**
     * 获取错误统计
     * @returns {Object} 错误统计
     */
    getErrorStats() {
        const stats = {};
        for (const [errorType, data] of this.errorStats.entries()) {
            stats[errorType] = { ...data };
        }
        return stats;
    }
    
    /**
     * 获取活跃重试任务
     * @returns {Array} 活跃重试任务
     */
    getActiveRetries() {
        return Array.from(this.activeRetries.entries()).map(([id, info]) => ({
            id,
            ...info
        }));
    }
    
    /**
     * 清理历史记录
     * @param {number} maxAge - 最大保留时间（毫秒）
     */
    cleanupHistory(maxAge = 24 * 60 * 60 * 1000) { // 默认24小时
        const cutoffTime = Date.now() - maxAge;
        const toDelete = [];
        
        for (const [retryId, record] of this.retryHistory.entries()) {
            if (record.startTime < cutoffTime) {
                toDelete.push(retryId);
            }
        }
        
        toDelete.forEach(retryId => {
            this.retryHistory.delete(retryId);
        });
        
        if (toDelete.length > 0) {
            console.log(`Cleaned up ${toDelete.length} old retry records`);
        }
    }
    
    /**
     * 重置错误统计
     */
    resetErrorStats() {
        this.errorStats.clear();
        console.log('Error statistics reset');
    }
    
    /**
     * 销毁重试管理器
     */
    destroy() {
        // 取消所有活跃的重试任务
        for (const retryId of this.activeRetries.keys()) {
            this.cancelRetry(retryId);
        }
        
        // 清空历史记录
        this.retryHistory.clear();
        this.errorStats.clear();
        
        console.log('RetryManager destroyed');
    }
}

// 创建全局重试管理器实例
const globalRetryManager = new RetryManager({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    strategy: RETRY_STRATEGY.EXPONENTIAL,
    jitter: true
});

// 导出
export { 
    RetryManager, 
    RETRY_STRATEGY, 
    ERROR_TYPE, 
    globalRetryManager 
};
export default RetryManager;