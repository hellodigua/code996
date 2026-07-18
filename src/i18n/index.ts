import { execSync } from 'child_process'
import { messages } from './messages'
import { IndexDescriptionKey, Locale } from './types'

let currentLocale: Locale = 'en'

export class UnsupportedLocaleError extends Error {
  constructor(locale: string) {
    super(`Unsupported locale: ${locale}. Supported locales: en, zh-CN`)
    this.name = 'UnsupportedLocaleError'
  }
}

export interface LocaleResolutionOptions {
  platform?: NodeJS.Platform
  readOsLocale?: (platform: NodeJS.Platform) => string | undefined
  intlLocale?: string | null
}

/**
 * 解析命令行、环境变量与系统语言，得到当前应使用的 locale。
 * 这里单独封装一层，是为了把优先级规则固定下来，避免各模块自行判断导致行为不一致。
 */
export function resolveRequestedLocale(
  argv: string[] = [],
  env: NodeJS.ProcessEnv = process.env,
  options: LocaleResolutionOptions = {}
): Locale {
  const cliLang = extractLangFromArgv(argv)
  if (cliLang) {
    return normalizeExplicitLocale(cliLang)
  }

  if (hasValue(env.CODE996_LANG)) {
    return normalizeExplicitLocale(env.CODE996_LANG)
  }

  const platform = options.platform ?? process.platform
  const osLocale = options.readOsLocale ? options.readOsLocale(platform) : readOsLocale(platform)
  const intlLocale = options.intlLocale ?? getIntlLocale()
  const candidates = [osLocale, env.LC_ALL, env.LC_MESSAGES, env.LANG, intlLocale]

  for (const candidate of candidates) {
    const locale = normalizeDetectedLocale(candidate)
    if (locale) {
      return locale
    }
  }

  return 'en'
}

export function initializeLocale(
  argv: string[] = [],
  env: NodeJS.ProcessEnv = process.env,
  options: LocaleResolutionOptions = {}
): Locale {
  const locale = resolveRequestedLocale(argv, env, options)
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
  return normalizeDetectedLocale(input) ?? 'en'
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

function normalizeExplicitLocale(input?: string | null): Locale {
  const normalized = normalizeLocaleToken(input)
  if (!normalized) {
    throw new UnsupportedLocaleError(String(input ?? ''))
  }

  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-hans-cn') {
    return 'zh-CN'
  }

  if (normalized === 'en' || normalized === 'en-us') {
    return 'en'
  }

  throw new UnsupportedLocaleError(String(input ?? ''))
}

function normalizeDetectedLocale(input?: string | null): Locale | undefined {
  const normalized = normalizeLocaleToken(input)
  if (!normalized) {
    return undefined
  }

  if (normalized.startsWith('zh')) {
    return 'zh-CN'
  }

  if (normalized.startsWith('en')) {
    return 'en'
  }

  return undefined
}

function normalizeLocaleToken(input?: string | null): string | undefined {
  const value = input?.trim()
  if (!value) {
    return undefined
  }

  const firstToken = cleanLocaleToken(value.split(/\s+/)[0])
  if (isLocaleLike(firstToken)) {
    return firstToken
  }

  const embeddedLocale = value.match(/[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]+){0,3}/)?.[0]
  return cleanLocaleToken(embeddedLocale)
}

function cleanLocaleToken(input?: string): string | undefined {
  if (!input) {
    return undefined
  }

  return input
    .split(/\s+/)[0]
    .split('.')[0]
    .split('@')[0]
    .replace(/^["']|["']$/g, '')
    .replace(/_/g, '-')
    .toLowerCase()
}

function isLocaleLike(input?: string): input is string {
  return !!input && /^[a-z]{2,3}(?:-[a-z0-9]+){0,3}$/i.test(input)
}

function readOsLocale(platform: NodeJS.Platform): string | undefined {
  try {
    if (platform === 'darwin') {
      return (
        readCommand('defaults read -g AppleLanguages 2>/dev/null') ??
        readCommand('defaults read -g AppleLocale 2>/dev/null')
      )
    }

    if (platform === 'win32') {
      return (
        readCommand('powershell -NoProfile -Command "(Get-WinUserLanguageList)[0].LanguageTag"') ??
        readCommand('powershell -NoProfile -Command "(Get-Culture).Name"')
      )
    }
  } catch {
    return undefined
  }

  return undefined
}

function readCommand(command: string): string | undefined {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return output || undefined
  } catch {
    return undefined
  }
}

function getIntlLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return undefined
  }
}

function hasValue(value?: string): value is string {
  return value !== undefined && value.trim() !== ''
}

export type { IndexDescriptionKey, Locale, WorkTimeCategory, WorkWeekCategory } from './types'
