/**
 * 消息提示工具类
 * 基于Element Plus的ElMessage组件封装的消息提示工具
 */

// 导入Element Plus消息组件
import { ElMessage } from 'element-plus'

/**
 * 显示消息提示
 * @param {string} msg - 消息内容
 * @param {Function} callback - 关闭回调函数
 * @param {string} type - 消息类型（error/success/warning/info）
 */
const showMessage = (msg, callback, type) => {
    ElMessage({
        type: type, // 消息类型
        message: msg, // 消息内容
        duration: 2000, // 显示时长（毫秒）
        onClose: () => {
            // 消息关闭时的回调
            if (callback) {
                callback();
            }
        }
    })
}

// 消息提示对象，提供不同类型的消息方法
const message = {
    /**
     * 错误消息提示
     * @param {string} msg - 错误消息内容
     * @param {Function} callback - 关闭回调函数
     */
    error: (msg, callback) => {
        showMessage(msg, callback, "error");
    },
    
    /**
     * 成功消息提示
     * @param {string} msg - 成功消息内容
     * @param {Function} callback - 关闭回调函数
     */
    success: (msg, callback) => {
        showMessage(msg, callback, "success");
    },
    
    /**
     * 警告消息提示
     * @param {string} msg - 警告消息内容
     * @param {Function} callback - 关闭回调函数
     */
    warning: (msg, callback) => {
        showMessage(msg, callback, "warning");
    },
}

// 导出消息提示对象
export default message;