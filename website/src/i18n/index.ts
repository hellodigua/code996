import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

// 获取浏览器语言或本地存储的语言设置
function getDefaultLocale(): string {
  const saved = localStorage.getItem('locale')
  if (saved && messages[saved as keyof typeof messages]) {
    return saved
  }

  const browserLang = navigator.language
  if (browserLang.startsWith('zh')) {
    return 'zh-CN'
  }
  return 'en-US'
}

export const i18n = createI18n({
  legacy: false, // 使用 Composition API
  locale: getDefaultLocale(),
  fallbackLocale: 'en-US',
  messages,
})

// 切换语言函数
export function switchLanguage(locale: string) {
  if (messages[locale as keyof typeof messages]) {
    i18n.global.locale.value = locale as 'zh-CN' | 'en-US'
    localStorage.setItem('locale', locale)
    // 更新页面标题
    document.title = locale === 'zh-CN' ? 'code996' : 'code996'
  }
}

// 获取当前语言
export function getCurrentLocale() {
  return i18n.global.locale.value
}

export default i18n
