import { computed, readonly, ref } from 'vue'
import en from './locales/en-US'
import zhCN from './locales/zh-CN'
import type { WebLocale } from '../types'

const messages = { 'zh-CN': zhCN, en }
const locale = ref<WebLocale>(navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en')

function readMessage(path: string, params: Record<string, string | number> = {}): string {
  const value = path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, messages[locale.value])

  if (typeof value !== 'string') return path
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

export function useWebI18n() {
  const languageLabel = computed(() => (locale.value === 'zh-CN' ? '中' : 'EN'))

  return {
    locale: readonly(locale),
    languageLabel,
    t: readMessage,
    setLocale: (nextLocale: string) => {
      locale.value = nextLocale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
      document.documentElement.lang = locale.value
    },
    toggleLocale: () => {
      locale.value = locale.value === 'zh-CN' ? 'en' : 'zh-CN'
      document.documentElement.lang = locale.value
    },
  }
}
