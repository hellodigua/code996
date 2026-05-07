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

  it('默认按 LC_ALL 识别中文', () => {
    const locale = resolveRequestedLocale([], {
      ...process.env,
      CODE996_LANG: '',
      LC_ALL: 'zh_CN.UTF-8',
      LC_MESSAGES: '',
      LANG: 'en_US.UTF-8',
    })

    expect(locale).toBe('zh-CN')
  })

  it('--lang 优先级高于系统语言', () => {
    const locale = resolveRequestedLocale(['node', 'code996', '--lang', 'en'], {
      ...process.env,
      LC_ALL: 'zh_CN.UTF-8',
    })

    expect(locale).toBe('en')
  })

  it('中文环境下 help 输出中文', async () => {
    process.env.LC_ALL = 'zh_CN.UTF-8'
    const cli = new CLIManager(['node', 'code996', 'help'])

    await cli.parseAsync(['node', 'code996', 'help'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('使用方法:'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('智能分析模式:'))
  })

  it('--lang en 可以覆盖中文环境的 help 输出', async () => {
    process.env.LC_ALL = 'zh_CN.UTF-8'
    const cli = new CLIManager(['node', 'code996', 'help', '--lang', 'en'])

    await cli.parseAsync(['node', 'code996', 'help', '--lang', 'en'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Smart analysis mode:'))
  })

  it('中文环境下路径不存在时输出中文错误', async () => {
    process.env.LC_ALL = 'zh_CN.UTF-8'
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)
    const cli = new CLIManager(['node', 'code996', '/__missing_repo__'])

    await expect(cli.parseAsync(['node', 'code996', '/__missing_repo__'])).rejects.toThrow('process.exit')

    expect(errorSpy).toHaveBeenCalledWith('❌ 指定的路径不存在:', expect.stringContaining('/__missing_repo__'))
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })
})
