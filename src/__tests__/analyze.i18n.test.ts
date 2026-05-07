import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { AnalyzeExecutor } from '../cli/commands/analyze'
import { setLocale } from '../i18n'
import {
  createFullReportFixtureRepo,
  createLightWorkloadFixtureRepo,
  FixtureRepo,
} from '../test-utils/git-fixture'

jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn((text?: string) => ({
    text: text ?? '',
    start() {
      return this
    },
    render() {
      return this
    },
    succeed() {
      return this
    },
    fail() {
      return this
    },
    warn() {
      return this
    },
    info() {
      return this
    },
  })),
}))

describe('AnalyzeExecutor i18n', () => {
  let fixtureRepo: FixtureRepo | null = null
  let logSpy: ReturnType<typeof jest.spyOn>
  let errorSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    fixtureRepo?.cleanup()
    fixtureRepo = null
  })

  it('英文模式下轻量样本仓库输出不应混入中文', async () => {
    fixtureRepo = createLightWorkloadFixtureRepo()

    setLocale('en')

    await AnalyzeExecutor.execute(fixtureRepo.repoPath, {
      allTime: true,
      skipUserAnalysis: true,
    })

    const joinedLogs = logSpy.mock.calls.flat().join('\n')
    const joinedErrors = errorSpy.mock.calls.flat().join('\n')
    const combinedOutput = `${joinedLogs}\n${joinedErrors}`

    expect(combinedOutput).toContain('Time range:')
    expect(combinedOutput).toContain('Insufficient samples')
    expect(combinedOutput).not.toMatch(/[\u4e00-\u9fff]/)
  })

  it('英文模式下完整报告仓库输出不应混入中文', async () => {
    fixtureRepo = createFullReportFixtureRepo()

    setLocale('en')

    await AnalyzeExecutor.execute(fixtureRepo.repoPath, {
      since: '2025-01-01',
      until: '2025-03-31',
      skipUserAnalysis: true,
    })

    const joinedLogs = logSpy.mock.calls.flat().join('\n')
    const joinedErrors = errorSpy.mock.calls.flat().join('\n')
    const combinedOutput = `${joinedLogs}\n${joinedErrors}`

    expect(combinedOutput).toContain('Core results:')
    expect(combinedOutput).toContain('Overtime note:')
    expect(combinedOutput).toContain('Monthly trend report')
    expect(combinedOutput).toContain('Late-night overtime analysis:')
    expect(combinedOutput).not.toMatch(/[\u4e00-\u9fff]/)
  })
})
