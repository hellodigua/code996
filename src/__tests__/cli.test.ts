import { CLIManager } from '../cli'
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// 轻量 mock chalk，保留调用结构
jest.mock('chalk', () => ({
  blue: (t: string) => t,
  yellow: (t: string) => t,
  green: (t: string) => t,
  red: (t: string) => t,
  gray: (t: string) => t,
  bold: (t: string) => t,
  hex: () => (t: string) => t,
}))

describe('CLIManager help output (direct method)', () => {
  let logSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  test('showHelp() prints usage and commands sections', () => {
    const cli = new CLIManager()
    // 直接调用私有方法，避免 commander 参数解析副作用
    ;(cli as any).showHelp()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('使用方法:'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('命令:'))
  })
})
