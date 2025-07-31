<template>
  <div>GitHub登录处理中...</div>
</template>

<script setup>
import { getCurrentInstance } from "vue";
import { useRouter, useRoute } from "vue-router";
const { proxy } = getCurrentInstance();
const router = useRouter();
const route = useRoute();

(async () => {
  // 直接用当前路由的query参数（包含code和state）
  const res = await proxy.Request({
    url: "/githublogin/callback",
    params: route.query
  });
  if (res && res.data) {
    proxy.VueCookies.set("userInfo", res.data.userInfo, 0);
    router.replace(res.data.callbackUrl || "/");
  } else {
    router.replace("/login");
  }
})();
</script>

<style lang="scss" scoped>
/* GitHub登录回调页面样式 */
</style>