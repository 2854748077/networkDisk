/**
 * HTTP请求工具类
 * 基于axios封装的HTTP请求工具，包含请求拦截器、响应拦截器和错误处理
 */

// 导入axios HTTP客户端库
import axios from 'axios'
// 导入Element Plus加载组件
import { ElLoading } from 'element-plus'
// 导入Vue Router实例
import router from '@/router'
// 导入消息提示工具
import Message from '../utils/Message'

// 定义内容类型常量
const contentTypeForm = 'application/x-www-form-urlencoded;charset=UTF-8' // 表单数据格式
const contentTypeJson = 'application/json' // JSON数据格式
// 响应类型常量
// arraybuffer - ArrayBuffer对象
// blob - Blob对象
const responseTypeJson = "json" // JSON响应格式

// 全局加载状态变量
let loading = null;

// 创建axios实例
const instance = axios.create({
    baseURL: '/api', // API基础路径
    timeout: 30 * 1000, // 请求超时时间30秒
});

/**
 * 请求前拦截器
 * 在发送请求前执行，用于显示加载状态等
 */
instance.interceptors.request.use(
    (config) => {
        // 如果需要显示加载状态，则显示加载动画
        if (config.showLoading) {
            loading = ElLoading.service({
                lock: true, // 锁定屏幕
                text: '加载中......', // 加载提示文字
                background: 'rgba(0, 0, 0, 0.7)', // 背景遮罩
            });
        }
        return config;
    },
    (error) => {
        // 请求发送失败时的处理
        if (config.showLoading && loading) {
            loading.close(); // 关闭加载动画
        }
        Message.error("请求发送失败"); // 显示错误消息
        return Promise.reject("请求发送失败");
    }
);

/**
 * 响应后拦截器
 * 在接收到响应后执行，用于处理响应数据和错误
 */
instance.interceptors.response.use(
    (response) => {
        // 从响应配置中获取相关参数
        const { showLoading, errorCallback, showError = true, responseType } = response.config;
        
        // 如果显示加载状态，则关闭加载动画
        if (showLoading && loading) {
            loading.close()
        }
        
        const responseData = response.data;
        
        // 如果是二进制数据（arraybuffer或blob），直接返回
        if (responseType == "arraybuffer" || responseType == "blob") {
            return responseData;
        }
        
        // 处理正常响应
        if (responseData.code == 200) {
            return responseData; // 成功响应
        } else if (responseData.code == 901) {
            // 登录超时处理
            router.push("/login?redirectUrl=" + encodeURI(router.currentRoute.value.path));
            return Promise.reject({ showError: false, msg: "登录超时" });
        } else {
            // 其他错误处理
            if (errorCallback) {
                errorCallback(responseData.info); // 执行错误回调
            }
            return Promise.reject({ showError: showError, msg: responseData.info });
        }
    },
    (error) => {
        // 网络错误处理
        if (error.config.showLoading && loading) {
            loading.close(); // 关闭加载动画
        }
        return Promise.reject({ showError: true, msg: "网络异常" })
    }
);

/**
 * 主请求函数
 * @param {Object} config - 请求配置对象
 * @param {string} config.url - 请求URL
 * @param {Object} config.params - 请求参数
 * @param {string} config.dataType - 数据类型（json/form）
 * @param {boolean} config.showLoading - 是否显示加载状态
 * @param {string} config.responseType - 响应类型
 * @param {Function} config.uploadProgressCallback - 上传进度回调
 * @param {Function} config.errorCallback - 错误回调
 * @param {boolean} config.showError - 是否显示错误消息
 * @returns {Promise} 请求结果
 */
const request = (config) => {
    // 解构配置参数，设置默认值
    const { url, params, dataType, showLoading = true, responseType = responseTypeJson } = config;
    let contentType = contentTypeForm; // 默认使用表单格式
    let formData = new FormData(); // 创建FormData对象
    
    // 将参数添加到FormData中
    for (let key in params) {
        formData.append(key, params[key] == undefined ? "" : params[key]);
    }
    
    // 如果指定为JSON格式，则修改内容类型
    if (dataType != null && dataType == 'json') {
        contentType = contentTypeJson;
    }
    
    // 设置请求头
    let headers = {
        'Content-Type': contentType,
        'X-Requested-With': 'XMLHttpRequest', // 标识为AJAX请求
    }

    // 发送POST请求
    return instance.post(url, formData, {
        // 上传进度回调
        onUploadProgress: (event) => {
            if (config.uploadProgressCallback) {
                config.uploadProgressCallback(event);
            }
        },
        responseType: responseType, // 响应类型
        headers: headers, // 请求头
        showLoading: showLoading, // 是否显示加载状态
        errorCallback: config.errorCallback, // 错误回调
        showError: config.showError // 是否显示错误消息
    }).catch(error => {
        // 错误处理
        console.log(error);
        if (error.showError) {
            Message.error(error.msg); // 显示错误消息
        }
        return null; // 返回null表示请求失败
    });
};

// 导出请求函数
export default request;
