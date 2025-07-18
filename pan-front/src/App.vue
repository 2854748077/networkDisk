<template>
  <!-- 根组件模板 -->
  <!-- Element Plus配置提供者，用于全局配置UI库的语言和消息设置 -->
  <el-config-provider :locale="locale" :message="config">
    <!-- 路由视图，用于显示当前路由对应的组件 -->
    <router-view></router-view>
  </el-config-provider>
</template>

<script setup>
// 导入Vue响应式API
import { reactive } from "vue";
// 导入Element Plus中文语言包
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

// 设置Element Plus的语言为中文
const locale = zhCn;

// 配置Element Plus消息组件的全局设置
const config = reactive({
  max: 1, // 最大显示消息数量为1个
});
</script>

<style scoped>
/* 根组件样式 */
</style>
