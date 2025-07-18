/**
 * 数据验证工具类
 * 提供各种数据格式的验证功能，用于表单验证
 */

// 定义各种验证规则的正则表达式
const regs = {
    // 邮箱验证规则
    email: /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/,
    // 数字验证规则（非负整数）
    number: /^([0]|[1-9][0-9]*)$/,
    // 密码验证规则（至少8位，包含数字和字母）
    password: /^(?=.*\d)(?=.*[a-zA-Z])[\da-zA-Z~!@#$%^&*_]{8,}$/,
    // 分享码验证规则（字母数字组合）
    shareCode: /^[A-Za-z0-9]+$/
}

/**
 * 通用验证函数
 * @param {Object} rule - 验证规则对象
 * @param {string} value - 要验证的值
 * @param {RegExp} reg - 正则表达式
 * @param {Function} callback - 验证结果回调函数
 */
const verify = (rule, value, reg, callback) => {
    if (value) {
        // 如果有值，则进行正则验证
        if (reg.test(value)) {
            callback() // 验证通过
        } else {
            callback(new Error(rule.message)) // 验证失败，返回错误信息
        }
    } else {
        // 如果没有值，则验证通过（可选字段）
        callback()
    }
}

// 导出验证工具对象
export default {
    /**
     * 邮箱验证
     * @param {Object} rule - 验证规则
     * @param {string} value - 邮箱值
     * @param {Function} callback - 回调函数
     */
    email: (rule, value, callback) => {
        return verify(rule, value, regs.email, callback)
    },
    
    /**
     * 数字验证
     * @param {Object} rule - 验证规则
     * @param {string} value - 数字值
     * @param {Function} callback - 回调函数
     */
    number: (rule, value, callback) => {
        return verify(rule, value, regs.number, callback)
    },
    
    /**
     * 密码验证
     * @param {Object} rule - 验证规则
     * @param {string} value - 密码值
     * @param {Function} callback - 回调函数
     */
    password: (rule, value, callback) => {
        return verify(rule, value, regs.password, callback)
    },
    
    /**
     * 分享码验证
     * @param {Object} rule - 验证规则
     * @param {string} value - 分享码值
     * @param {Function} callback - 回调函数
     */
    shareCode: (rule, value, callback) => {
        return verify(rule, value, regs.shareCode, callback)
    },
}
