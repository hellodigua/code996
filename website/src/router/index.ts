import { Router, createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '@/i18n'

const Intro = () => import('@/view/intro/index.vue')
const Result = () => import('@/view/result/index.vue')

export const router = createRouter({
  // 不固定为站点根目录，让 GitHub Pages 下的 hash 导航继承当前 /code996/ 子路径。
  history: createWebHashHistory(),
  routes: [
    // 根路径重定向
    {
      path: '/',
      redirect: (to) => {
        // 检查URL参数中的lang
        const langParam = to.query.lang as string
        if (langParam === 'en') {
          return { path: '/en/', query: to.query }
        }
        // 检查localStorage或默认中文
        const savedLang = localStorage.getItem('locale')
        if (savedLang === 'en-US') {
          return { path: '/en/', query: to.query }
        }
        return { path: '/zh/', query: to.query }
      },
    },
    // 旧格式兼容重定向
    {
      path: '/result',
      redirect: (to) => {
        const langParam = to.query.lang as string
        if (langParam === 'en') {
          // 移除lang参数，因为路径已经表示语言
          const { lang, ...restQuery } = to.query
          return { path: '/en/result', query: restQuery }
        }
        return { path: '/zh/result', query: to.query }
      },
    },
    // 中文路由
    {
      path: '/zh',
      children: [
        {
          path: '',
          name: 'zh-index',
          component: Intro,
          meta: { titleKey: 'intro.title', locale: 'zh-CN' },
        },
        {
          path: 'result',
          name: 'zh-result',
          component: Result,
          meta: { titleKey: 'nav.title', locale: 'zh-CN' },
        },
      ],
    },
    // 英文路由
    {
      path: '/en',
      children: [
        {
          path: '',
          name: 'en-index',
          component: Intro,
          meta: { titleKey: 'intro.title', locale: 'en-US' },
        },
        {
          path: 'result',
          name: 'en-result',
          component: Result,
          meta: { titleKey: 'nav.title', locale: 'en-US' },
        },
      ],
    },
  ],
})

function changeTitleGuide(router: Router) {
  router.beforeEach((to, from, next) => {
    // 从路由meta获取语言设置
    const routeLocale = to.meta.locale as string
    if (routeLocale && i18n.global.locale.value !== routeLocale) {
      i18n.global.locale.value = routeLocale as 'zh-CN' | 'en-US'
      // 同步到localStorage以保持一致性
      localStorage.setItem('locale', routeLocale)
    }

    // 设置页面标题
    const titleKey = to.meta.titleKey as string
    if (titleKey) {
      document.title = i18n.global.t(titleKey) + ' | code996'
    } else {
      document.title = 'code996'
    }
    next()
  })
}

changeTitleGuide(router)
