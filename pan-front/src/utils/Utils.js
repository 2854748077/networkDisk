/**
 * 通用工具类
 * 提供各种常用的工具函数
 */

export default {
    /**
     * 文件大小格式化函数
     * 将字节数转换为人类可读的文件大小字符串
     * @param {number} limit - 文件大小（字节）
     * @returns {string} 格式化后的文件大小字符串
     */
    size2Str: (limit) => {
        var size = "";
        
        // 根据文件大小选择合适的单位
        if (limit < 0.1 * 1024) {
            // 小于0.1KB，则转化成B
            size = limit.toFixed(2) + "B"
        } else if (limit < 0.1 * 1024 * 1024) {
            // 小于0.1MB，则转化成KB
            size = (limit / 1024).toFixed(2) + "KB"
        } else if (limit < 0.1 * 1024 * 1024 * 1024) {
            // 小于0.1GB，则转化成MB
            size = (limit / (1024 * 1024)).toFixed(2) + "MB"
        } else {
            // 其他转化成GB
            size = (limit / (1024 * 1024 * 1024)).toFixed(2) + "GB"
        }
        
        // 处理小数点后两位为00的情况
        var sizeStr = size + ""; // 转成字符串
        var index = sizeStr.indexOf("."); // 获取小数点处的索引
        var dou = sizeStr.substr(index + 1, 2) // 获取小数点后两位的值
        
        if (dou == "00") {
            // 判断后两位是否为00，如果是则删除00
            return sizeStr.substring(0, index) + sizeStr.substr(index + 3, 2)
        }
        
        return size;
    },
}