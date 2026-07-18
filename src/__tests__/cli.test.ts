import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { CLIManager } from '../cli'
import { resolveRequestedLocale } from '../i18n'

jest.mock('chalk', () => {
  const passthrough = (value: unknown) => String(value)
  const passthroughFactory = () => passthrough
  const fn = Object.assign(passthrough, {
    blue: passthrough,
    yellow: Object.assign(passthrough, { bold: passthrough }),
    green: passthrough,
    red: passthrough,
    gray: passthrough,
    cyan: Object.assign(passthrough, { bold: passthrough }),
    magenta: passthrough,
    bold: passthrough,
    bgRed: { white: passthrough },
    hex: passthroughFactory,
  })

  return {
    __esModule: true,
    default: fn,
  }
})

describe('CLI i18n', () => {
  const originalEnv = { ...process.env }

  let logSpy: ReturnType<typeof jest.spyOn>
  let errorSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    process.env = { ...originalEnv }
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('未指定语言时优先按 OS 语言识别中文', () => {
    const locale = resolveRequestedLocale(
      [],
      {
        ...process.env,
        CODE996_LANG: '',
        LC_ALL: 'en_US.UTF-8',
        LC_MESSAGES: '',
        LANG: 'en_US.UTF-8',
      },
      {
        platform: 'darwin',
        readOsLocale: () => 'zh-Hans-CN',
      }
    )

    expect(locale).toBe('zh-CN')
  })

  it('能识别 macOS AppleLanguages 列表输出', () => {
    const locale = resolveRequestedLocale(
      [],
      {
        ...process.env,
        CODE996_LANG: '',
        LC_ALL: 'en_US.UTF-8',
        LC_MESSAGES: '',
        LANG: 'en_US.UTF-8',
      },
      {
        platform: 'darwin',
        readOsLocale: () => '(\n    "zh-Hans-CN"\n)',
      }
    )

    expect(locale).toBe('zh-CN')
  })

  it('OS 语言读取失败时回退到终端 locale', () => {
    const locale = resolveRequestedLocale(
      [],
      {
        ...process.env,
        CODE996_LANG: '',
        LC_ALL: 'zh_CN.UTF-8',
        LC_MESSAGES: '',
        LANG: 'en_US.UTF-8',
      },
      {
        platform: 'darwin',
        readOsLocale: () => undefined,
      }
    )

    expect(locale).toBe('zh-CN')
  })

  it('--lang 优先级高于系统语言', () => {
    const locale = resolveRequestedLocale(
      ['node', 'code996', '--lang', 'en-US'],
      {
        ...process.env,
        CODE996_LANG: 'zh-CN',
        LC_ALL: 'zh_CN.UTF-8',
      },
      {
        platform: 'darwin',
        readOsLocale: () => 'zh-Hans-CN',
      }
    )

    expect(locale).toBe('en')
  })

  it('CODE996_LANG 优先级高于自动检测', () => {
    const locale = resolveRequestedLocale(
      [],
      {
        ...process.env,
        CODE996_LANG: 'zh_CN',
        LC_ALL: 'en_US.UTF-8',
      },
      {
        platform: 'win32',
        readOsLocale: () => 'en-US',
      }
    )

    expect(locale).toBe('zh-CN')
  })

  it('显式指定不支持的语言时报错', () => {
    expect(() =>
      resolveRequestedLocale(['node', 'code996', '--lang', 'ja'], {
        ...process.env,
      })
    ).toThrow('Unsupported locale')
  })

  it('CLI 显式指定不支持的语言时输出错误并退出', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    expect(() => new CLIManager(['node', 'code996', 'help', '--lang', 'ja'])).toThrow('process.exit')
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported locale: ja'))
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })

  it('自动检测到不支持的语言时回退英文', () => {
    const locale = resolveRequestedLocale(
      [],
      {
        ...process.env,
        CODE996_LANG: '',
        LC_ALL: '',
        LC_MESSAGES: '',
        LANG: '',
      },
      {
        platform: 'win32',
        readOsLocale: () => 'ja-JP',
        intlLocale: 'fr-FR',
      }
    )

    expect(locale).toBe('en')
  })

  it('CODE996_LANG=zh-CN 时 help 输出中文', async () => {
    process.env.CODE996_LANG = 'zh-CN'
    const cli = new CLIManager(['node', 'code996', 'help'])

    await cli.parseAsync(['node', 'code996', 'help'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('使用方法:'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('智能分析模式:'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('--open'))
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('--web'))
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('--no-open'))
  })

  it('--lang en 可以覆盖中文环境的 help 输出', async () => {
    process.env.CODE996_LANG = 'zh-CN'
    const cli = new CLIManager(['node', 'code996', 'help', '--lang', 'en'])

    await cli.parseAsync(['node', 'code996', 'help', '--lang', 'en'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Smart analysis mode:'))
  })

  it('CODE996_LANG=zh-CN 时路径不存在输出中文错误', async () => {
    process.env.CODE996_LANG = 'zh-CN'
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)
    const cli = new CLIManager(['node', 'code996', '/__missing_repo__'])

    await expect(cli.parseAsync(['node', 'code996', '/__missing_repo__'])).rejects.toThrow('process.exit')

    expect(errorSpy).toHaveBeenCalledWith('❌ 指定的路径不存在:', expect.stringContaining('/__missing_repo__'))
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })

  it('--open 与结构化输出参数同时使用时报错', async () => {
    process.env.CODE996_LANG = 'zh-CN'
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)
    const cli = new CLIManager(['node', 'code996', '--open', '--json'])

    await expect(cli.parseAsync(['node', 'code996', '--open', '--json'])).rejects.toThrow('process.exit')
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })

  it('--json 与 --md 同时使用时报错', async () => {
    process.env.CODE996_LANG = 'zh-CN'
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)
    const cli = new CLIManager(['node', 'code996', '--json', '--md'])

    await expect(cli.parseAsync(['node', 'code996', '--json', '--md'])).rejects.toThrow('process.exit')
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })
})
