
/**
 * 确认对话框工具类
 * 基于Element Plus的ElMessageBox组件封装的确认对话框工具
 */

// 导入Element Plus消息框组件
import { ElMessageBox } from 'element-plus'

/**
 * 显示确认对话框
 * @param {string} message - 确认消息内容
 * @param {Function} okfun - 确认按钮点击回调函数
 */
const confirm = (message, okfun) => {
    ElMessageBox.confirm(message, '提示', {
        confirmButtonText: '确定', // 确认按钮文字
        cancelButtonText: '取消', // 取消按钮文字
        type: 'info', // 对话框类型
    }).then(() => {
        // 用户点击确认按钮
        okfun();
    }).catch(() => {
        // 用户点击取消按钮或关闭对话框，不做任何操作
    })
};

// 导出确认对话框函数
export default confirm;


