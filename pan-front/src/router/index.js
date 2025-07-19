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
 * 在每次路由跳转前执行，用于检查用户登录状态和权限验证
 * 
 * @param {Object} to - 即将要进入的目标路由对象
 * @param {Object} from - 当前导航正要离开的路由对象
 * @param {Function} next - 调用该方法来resolve这个钩子，执行效果依赖next方法的调用参数
 */
router.beforeEach((to, _from, next) => {
  // 从Cookie中获取用户登录信息
  // userInfo包含用户ID、昵称、头像等基本信息
  const userInfo = VueCookies.get("userInfo");

  /**
   * 检查路由是否需要登录验证
   * 条件说明：
   * 1. to.meta.needLogin != null - 路由元信息中定义了needLogin字段
   * 2. to.meta.needLogin === true - 该路由需要登录才能访问
   * 3. userInfo == null - 用户未登录（Cookie中没有用户信息）
   */
  if (to.meta.needLogin != null && to.meta.needLogin && userInfo == null) {
    /**
     * 用户未登录但访问需要登录的页面时：
     * 1. 重定向到登录页面
     * 2. 通过redirectUrl参数保存用户原本想访问的页面路径
     * 3. 用户登录成功后会自动跳转回原始页面，提升用户体验
     * 
     * 示例：
     * 用户访问 /main/files -> 重定向到 /login?redirectUrl=/main/files
     * 登录成功后自动跳转回 /main/files
     */
    router.push("/login?redirectUrl=" + to.path);
    return; // 阻止继续执行，因为已经重定向了
  }

  /**
   * 继续路由跳转
   * 如果用户已登录或访问的是不需要登录的页面，则正常跳转
   */
  next();
})

// 导出路由实例
export default router
