<template>
  <!-- QQ登录回调页面，显示登录处理状态 -->
  <div>登录中，请勿刷新页面</div>
</template>

<script setup>
// 导入Vue相关API
import { ref, reactive, getCurrentInstance, nextTick } from "vue";
// 导入Vue Router相关API
import { useRouter, useRoute } from "vue-router";

// 获取Vue实例，用于访问全局方法（如Request、VueCookies等）
const { proxy } = getCurrentInstance();
// 获取路由实例，用于页面跳转
const router = useRouter();
// 获取当前路由信息
const route = useRoute();

// API接口配置
const api = {
  // QQ登录回调接口地址
  logincallback: "/qqlogin/callback",
};

/**
 * QQ登录回调处理函数
 * 处理QQ授权后的回调逻辑
 */
const login = async () => {                //页面加载，自动执行
  // 向后端发送QQ登录回调请求
  let result = await proxy.Request({
    url: api.logincallback,
    // 传递当前路由的query参数（包含QQ返回的code和state）
    params: router.currentRoute.value.query,            //这就是当前路由的所有 query 参数。{ code: 'xxxx', state: 'yyyy' }
    // 请求失败时的回调：跳转到首页
    errorCallback: () => {
      router.push("/");
    },
  });
  
  // 如果请求失败，直接返回
  if (!result) {
    return;
  }

  // 获取跳转地址，如果没有指定则跳转到首页
  let redirectUrl = result.data.callbackUrl || "/";
  // 如果跳转地址是登录页，则改为跳转到首页（避免循环跳转）
  if (redirectUrl == "/login") {
    redirectUrl = "/";
  }
  
  // 将用户信息存储到Cookie中，实现前端登录态
  proxy.VueCookies.set("userInfo", result.data.userInfo, 0);
  
  // 打印跳转路径（调试用）
  console.log("路径", redirectUrl);
  
  // 执行页面跳转
  router.push(redirectUrl);
};

// 页面加载时自动执行登录回调处理
login();
</script>

<style lang="scss" scoped>
/* QQ登录回调页面样式 */
</style>
