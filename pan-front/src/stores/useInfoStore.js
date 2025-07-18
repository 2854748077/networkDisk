/**
 * 用户信息状态管理
 * 基于Pinia的用户信息存储，用于管理用户登录状态和信息
 */

// 导入Pinia状态管理库
import { defineStore } from 'pinia'

// 定义用户信息存储
export const userStore = defineStore('userInfo', {
  // 状态定义
  state: () => {
    return {
      userInfo: {}, // 用户信息对象
    }
  },
  
  // 计算属性（getters）
  getters: {
    /**
     * 获取用户信息
     * @returns {Object} 用户信息对象
     */
    getUserInfo() {
      return this.userInfo;
    }
  },
  
  // 操作方法（actions）
  actions: {
    /**
     * 保存用户信息
     * @param {Object} userInfo - 用户信息对象
     */
    saveUserInfo(userInfo) {
      this.userInfo = userInfo
    }
  }
})
