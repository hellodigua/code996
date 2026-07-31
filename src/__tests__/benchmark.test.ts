import fs from 'fs'
import path from 'path'
import { buildAnonymousBenchmark, assertAnonymousBenchmark } from '../benchmark/benchmark-builder'
import { BenchmarkExecutor } from '../cli/commands/benchmark'
import { CLIManager } from '../cli'
import { createFixtureRepo, FixtureRepo } from '../test-utils/git-fixture'

describe('匿名 benchmark', () => {
  let fixture: FixtureRepo

  beforeEach(() => {
    fixture = createFixtureRepo([
      {
        message: 'secret-customer-feature',
        isoDate: '2025-01-06 09:30:00 +0000',
        authorName: 'Private Developer',
        authorEmail: 'private@example.com',
      },
      {
        message: 'secret-production-fix',
        isoDate: '2025-01-06 18:30:00 +0000',
        authorName: 'Private Developer',
        authorEmail: 'private@example.com',
      },
      {
        message: 'another-private-change',
        isoDate: '2025-01-07 10:00:00 +0000',
        authorName: 'Another Developer',
        authorEmail: 'another@example.com',
      },
    ])
  })

  afterEach(() => {
    fixture.cleanup()
    jest.restoreAllMocks()
  })

  test('只输出可复算聚合和人工标签，不包含仓库或身份明细', async () => {
    const bundle = await buildAnonymousBenchmark(fixture.repoPath, {
      year: '2025',
      referenceHours: '9.5-18.5',
      teamSize: '12',
      schedule: 'fixed',
      labelConfidence: 'high',
    })
    const serialized = JSON.stringify(bundle)

    expect(bundle.kind).toBe('code996-anonymous-benchmark')
    expect(bundle.labels).toMatchObject({
      referenceWorkTime: { startHour: 9.5, endHour: 18.5 },
      teamSizeBucket: '11-30',
    })
    expect(bundle.sample.totalCommits).toBe(3)
    expect(bundle.sample.halfHourlyDistribution).toHaveLength(48)
    expect(bundle.results.comparison.startErrorMinutes).toEqual(expect.any(Number))

    expect(serialized).not.toContain(fixture.repoPath)
    expect(serialized).not.toContain(path.basename(fixture.repoPath))
    expect(serialized).not.toContain('Private Developer')
    expect(serialized).not.toContain('private@example.com')
    expect(serialized).not.toContain('secret-customer-feature')
    expect(serialized).not.toContain('2025-01-06')
  })

  test('隐私审计拒绝身份字段', async () => {
    const bundle = await buildAnonymousBenchmark(fixture.repoPath, {
      year: '2025',
      referenceHours: '9-18',
      teamSize: '3',
    })
    ;(bundle as unknown as Record<string, unknown>).email = 'leak@example.com'

    expect(() => assertAnonymousBenchmark(bundle, fixture.repoPath)).toThrow('forbidden field: email')
  })

  test('隐私审计递归拒绝字符串中的 Unix 或 Windows 仓库路径', async () => {
    const bundle = await buildAnonymousBenchmark(fixture.repoPath, {
      year: '2025',
      referenceHours: '9-18',
      teamSize: '3',
    })
    bundle.privacy.aggregateDataWarning = `review ${fixture.repoPath}/src before sharing`
    expect(() => assertAnonymousBenchmark(bundle, fixture.repoPath)).toThrow('repository path')

    bundle.privacy.aggregateDataWarning = 'review C:\\private\\repo\\src before sharing'
    expect(() => assertAnonymousBenchmark(bundle, 'C:\\private\\repo')).toThrow('repository path')
  })

  test('执行器写入只读前需人工检查的 JSON，且拒绝覆盖已有文件', async () => {
    const outputPath = path.join(fixture.repoPath, 'anonymous-output.json')
    jest.spyOn(console, 'log').mockImplementation(() => undefined)

    await BenchmarkExecutor.execute(fixture.repoPath, {
      year: '2025',
      referenceHours: '9.5-18.5',
      teamSize: '12',
      output: outputPath,
    })

    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    expect(output.privacy).toMatchObject({
      localOnly: true,
      requiresManualReview: true,
      containsSourceCode: false,
      containsIdentityData: false,
    })

    await expect(
      BenchmarkExecutor.execute(fixture.repoPath, {
        year: '2025',
        referenceHours: '9.5-18.5',
        teamSize: '12',
        output: outputPath,
      })
    ).rejects.toMatchObject({ code: 'EEXIST' })
  })

  test('CLI 不会丢失与根命令同名的年份、时区和输出参数', async () => {
    const outputPath = path.join(fixture.repoPath, 'cli-output.json')
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const args = [
      'node',
      'code996',
      'benchmark',
      fixture.repoPath,
      '--reference-hours',
      '9.5-18.5',
      '--team-size',
      '12',
      '--year',
      '2025',
      '--timezone',
      '+0000',
      '--output',
      outputPath,
    ]

    await new CLIManager(args).parseAsync(args)

    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    expect(output.scope).toMatchObject({
      rangeMode: 'year',
      sinceMonth: '2025-01',
      untilMonth: '2025-12',
      timezone: { mode: 'filtered', offset: '+0000' },
    })
  })
})
