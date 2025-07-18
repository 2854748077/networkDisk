/**
 * Vue Router路由配置文件
 * 定义应用的所有路由规则和导航守卫
 */

// 导入Vue Router相关API
import { createRouter, createWebHistory } from 'vue-router'
// 导入Cookie管理库
import VueCookies from 'vue-cookies'

// 创建路由实例
const router = createRouter({
  // 使用HTML5历史模式
  history: createWebHistory(import.meta.env.BASE_URL),
  // 路由配置数组
  routes: [
    // 登录页面路由
    {
      path: '/login',
      name: '登录',
      component: () => import("@/views/Login.vue")
    },
    // 主框架路由（包含子路由）
    {
      path: "/",
      component: () => import("@/views/Framework.vue"),
      children: [
        // 根路径重定向到文件管理页面
        {
          path: '/',
          redirect: "/main/all"
        },
        // 文件管理页面（支持分类参数）
        {
          path: '/main/:category',
          name: '首页',
          meta: {
            needLogin: true, // 需要登录
            menuCode: "main" // 菜单代码
          },
          component: () => import("@/views/main/Main.vue")
        },
        // 我的分享页面
        {
          path: '/myshare',
          name: '我的分享',
          meta: {
            needLogin: true,
            menuCode: "share"
          },
          component: () => import("@/views/share/Share.vue")
        },
        // 回收站页面
        {
          path: '/recycle',
          name: '回收站',
          meta: {
            needLogin: true,
            menuCode: "recycle"
          },
          component: () => import("@/views/recycle/Recycle.vue")
        },
        // 系统设置页面（管理员功能）
        {
          path: '/settings/sysSetting',
          name: '系统设置',
          meta: {
            needLogin: true,
            menuCode: "settings"
          },
          component: () => import("@/views/admin/SysSettings.vue")
        },
        // 用户管理页面（管理员功能）
        {
          path: '/settings/userList',
          name: '用户管理',
          meta: {
            needLogin: true,
            menuCode: "settings"
          },
          component: () => import("@/views/admin/UserList.vue")
        },
        // 用户文件管理页面（管理员功能）
        {
          path: '/settings/fileList',
          name: '用户文件',
          meta: {
            needLogin: true,
            menuCode: "settings"
          },
          component: () => import("@/views/admin/FileList.vue")
        },
      ]
    },
    // 分享校验页面（无需登录）
    {
      path: '/shareCheck/:shareId',
      name: '分享校验',
      component: () => import("@/views/webshare/ShareCheck.vue")
    },
    // 分享页面（无需登录）
    {
      path: '/share/:shareId',
      name: '分享',
      component: () => import("@/views/webshare/Share.vue")
    },
    // QQ登录回调页面
    {
      path: '/qqlogincalback',
      name: "qq登录回调",
      component: () => import('@/views/QqLoginCallback.vue'),
    },
    // GitHub登录回调页面
    {
      path: '/githublogincallback',
     // name: "GitHub登录回调",
      name: 'GitHubLoginCallback',
      //component: () => import('@/views/GitHubLoginCallback.vue'),
      component: () => import('@/views/GitHubLoginCallback.vue'),
    }
  ]
})

/**
 * 全局前置守卫
 * 在每次路由跳转前执行，用于检查用户登录状态
 */
router.beforeEach((to, from, next) => {
  // 从Cookie中获取用户信息
  const userInfo = VueCookies.get("userInfo");
  // 如果路由需要登录但用户未登录，则跳转到登录页
  if (to.meta.needLogin != null && to.meta.needLogin && userInfo == null) {
    router.push("/login");
  }
  // 继续路由跳转
  next();
})

// 导出路由实例
export default router
