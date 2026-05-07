import { messages } from './messages'
import { IndexDescriptionKey, Locale } from './types'

let currentLocale: Locale = 'en'

/**
 * 解析命令行、环境变量与系统语言，得到当前应使用的 locale。
 * 这里单独封装一层，是为了把优先级规则固定下来，避免各模块自行判断导致行为不一致。
 */
export function resolveRequestedLocale(argv: string[] = [], env: NodeJS.ProcessEnv = process.env): Locale {
  const cliLang = extractLangFromArgv(argv)
  if (cliLang) {
    return normalizeLocale(cliLang)
  }

  const envLang = env.CODE996_LANG || env.LC_ALL || env.LC_MESSAGES || env.LANG
  return normalizeLocale(envLang)
}

export function initializeLocale(argv: string[] = [], env: NodeJS.ProcessEnv = process.env): Locale {
  const locale = resolveRequestedLocale(argv, env)
  currentLocale = locale
  return locale
}

export function setLocale(locale: string): Locale {
  currentLocale = normalizeLocale(locale)
  return currentLocale
}

export function getLocale(): Locale {
  return currentLocale
}

export function normalizeLocale(input?: string | null): Locale {
  if (!input) {
    return 'en'
  }

  const normalized = input.trim().replace('_', '-').toLowerCase()
  if (normalized.startsWith('zh')) {
    return 'zh-CN'
  }

  return 'en'
}

export function t(key: string, params?: Record<string, string | number>): string {
  const template = messages[currentLocale][key] ?? messages.en[key] ?? key
  if (!params) {
    return template
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = params[token]
    return value === undefined ? `{{${token}}}` : String(value)
  })
}

export function tIndexDescription(key: IndexDescriptionKey): string {
  return t(`index.desc.${key}`)
}

export function tWeekday(dayKey: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday') {
  return t(`weekday.${dayKey}`)
}

function extractLangFromArgv(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]

    if (token === '--lang') {
      return argv[i + 1]
    }

    if (token.startsWith('--lang=')) {
      return token.slice('--lang='.length)
    }
  }

  return undefined
}

export type { IndexDescriptionKey, Locale, WorkTimeCategory, WorkWeekCategory } from './types'
