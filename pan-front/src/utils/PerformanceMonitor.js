/**
 * 性能监控器
 * 监控下载性能、内存使用和系统资源
 */

/**
 * 性能指标类型枚举
 */
const METRIC_TYPE = {
    DOWNLOAD_SPEED: 'download_speed',
    MEMORY_USAGE: 'memory_usage',
    CPU_USAGE: 'cpu_usage',
    NETWORK_LATENCY: 'network_latency',
    CHUNK_PROCESSING_TIME: 'chunk_processing_time',
    FILE_ASSEMBLY_TIME: 'file_assembly_time',
    BROWSER_PERFORMANCE: 'browser_performance'
};

/**
 * 性能监控器类
 */
class PerformanceMonitor {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        // 配置参数
        this.enableMemoryMonitoring = options.enableMemoryMonitoring !== false;
        this.enableNetworkMonitoring = options.enableNetworkMonitoring !== false;
        this.enablePerformanceAPI = options.enablePerformanceAPI !== false;
        this.monitoringInterval = options.monitoringInterval || 1000; // 1秒
        this.maxHistorySize = options.maxHistorySize || 1000;
        
        // 性能数据存储
        this.metrics = new Map(); // 性能指标历史
        this.currentSession = null; // 当前监控会话
        this.activeSessions = new Map(); // 活跃的监控会话
        
        // 监控状态
        this.isMonitoring = false;
        this.monitoringTimer = null;
        
        // 回调函数
        this.onMetricUpdate = options.onMetricUpdate || null;
        this.onPerformanceAlert = options.onPerformanceAlert || null;
        this.onMemoryWarning = options.onMemoryWarning || null;
        
        // 性能阈值
        this.thresholds = {
   