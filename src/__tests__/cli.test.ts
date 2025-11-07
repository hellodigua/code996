import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { CLIManager } from '../src/cli'
import * as chalk from 'chalk'

// Mock chalk to avoid color output in tests
jest.mock('chalk', () => ({
  blue: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  green: jest.fn((text) => text),
  red: jest.fn((text) => text),
  gray: jest.fn((text) => text),
  bold: { blue: jest.fn((text) => text) },
}))

describe('CLIManager', () => {
  let consoleSpy: jest.SpyInstance
  let cli: CLIManager

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    cli = new CLIManager()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('analyze command', () => {
    it('should handle analyze command with default options', async () => {
      cli.parse(['node', 'code996', 'analyze'])

      expect(consoleSpy).toHaveBeenCalledWith('分析仓库: .')
      expect(consoleSpy).toHaveBeenCalledWith('分析完成！ (此功能将在后续阶段实现)')
    })

    it('should handle analyze command with custom path', async () => {
      cli.parse(['node', 'code996', 'analyze', '/test/path'])

      expect(consoleSpy).toHaveBeenCalledWith('分析仓库: /test/path')
    })

    it('should handle analyze command with debug mode', async () => {
      cli.parse(['node', 'code996', 'analyze', '--debug'])

      expect(consoleSpy).toHaveBeenCalledWith('调试模式开启')
      expect(consoleSpy).toHaveBeenCalledWith('参数:')
    })
  })

  describe('version command', () => {
    it('should display version information', () => {
      cli.parse(['node', 'code996', 'version'])

      expect(consoleSpy).toHaveBeenCalledWith('code996 v0.1.1')
      expect(consoleSpy).toHaveBeenCalledWith('通过分析 Git commit 的时间分布，计算出项目的"996指数"')
    })
  })

  describe('help command', () => {
    it('should display help information', () => {
      cli.parse(['node', 'code996', 'help'])

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('code996'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('使用方法:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('命令:'))
    })
  })

  describe('error handling', () => {
    it('should handle unknown commands', () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation()

      cli.parse(['node', 'code996', 'unknown'])

      expect(consoleSpy).toHaveBeenCalledWith("错误: 未知命令 'unknown'")
      expect(exitSpy).toHaveBeenCalledWith(1)

      exitSpy.mockRestore()
    })
  })
})
