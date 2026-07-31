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
      status: 'labeled',
      referenceWorkTime: { startHour: 9.5, endHour: 18.5 },
      teamSizeBucket: '11-30',
    })
    expect(bundle.sample.totalCommits).toBe(3)
    expect(bundle.sample.halfHourlyDistribution).toHaveLength(48)
    expect(bundle.results.comparison?.startErrorMinutes).toEqual(expect.any(Number))

    expect(serialized).not.toContain(fixture.repoPath)
    expect(serialized).not.toContain(path.basename(fixture.repoPath))
    expect(serialized).not.toContain('Private Developer')
    expect(serialized).not.toContain('private@example.com')
    expect(serialized).not.toContain('secret-customer-feature')
    expect(serialized).not.toContain('2025-01-06')
  })

  test('不提供任何人工信息时生成可供人工复核的无标签样本', async () => {
    const bundle = await buildAnonymousBenchmark(fixture.repoPath, {})

    expect(bundle.labels).toEqual({
      status: 'unlabeled',
      schedule: 'unknown',
      teamSizeBucket: 'unknown',
      confidence: 'unknown',
    })
    expect(bundle.results.automatic.result996.index996).toEqual(expect.any(Number))
    expect(bundle.results.reference).toBeUndefined()
    expect(bundle.results.comparison).toBeUndefined()
    expect(bundle.scope.rangeMode).toBe('auto-last-commit')
    expect(bundle.sample.totalCommits).toBe(3)
  })

  test('默认范围包含最后提交日，单日仓库也能生成 benchmark', async () => {
    const oneDayFixture = createFixtureRepo([
      {
        message: 'only-commit',
        isoDate: '2025-01-07 10:00:00 +0000',
      },
    ])

    try {
      const bundle = await buildAnonymousBenchmark(oneDayFixture.repoPath, {})
      expect(bundle.scope.rangeMode).toBe('auto-last-commit')
      expect(bundle.scope.untilMonth).toBe('2025-01')
      expect(bundle.sample.totalCommits).toBe(1)
    } finally {
      oneDayFixture.cleanup()
    }
  })

  test('纯日期范围使用固定午夜边界，不遗漏首日或混入次日', async () => {
    const originalTimezone = process.env.TZ
    process.env.TZ = 'UTC'
    const dateBoundaryFixture = createFixtureRepo([
      {
        message: 'first-day-early',
        isoDate: '2025-01-01 00:30:00 +0000',
      },
      {
        message: 'first-day-late',
        isoDate: '2025-01-01 23:30:00 +0000',
      },
      {
        message: 'next-day-early',
        isoDate: '2025-01-02 00:30:00 +0000',
      },
    ])

    try {
      const bundle = await buildAnonymousBenchmark(dateBoundaryFixture.repoPath, {
        since: '2025-01-01',
        until: '2025-01-01',
      })
      expect(bundle.sample.totalCommits).toBe(2)
      expect(bundle.sample.weekdayDistribution.find((item) => item.time === '3')?.count).toBe(2)
      expect(bundle.sample.weekdayDistribution.find((item) => item.time === '4')?.count).toBe(0)
    } finally {
      dateBoundaryFixture.cleanup()
      if (originalTimezone === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = originalTimezone
      }
    }
  })

  test('末次提交分布保留次日凌晨的扩展半小时桶', async () => {
    const midnightFixture = createFixtureRepo([
      {
        message: 'after-midnight-0015',
        isoDate: '2025-01-07 00:15:00 +0000',
      },
      {
        message: 'after-midnight-0545',
        isoDate: '2025-01-08 05:45:00 +0000',
      },
    ])

    try {
      const bundle = await buildAnonymousBenchmark(midnightFixture.repoPath, { allTime: true })
      expect(bundle.sample.dailyLatestCommitDistribution).toEqual([
        { time: '24:00', count: 1 },
        { time: '29:30', count: 1 },
      ])
    } finally {
      midnightFixture.cleanup()
    }
  })

  test('时区过滤和摘要使用 committer 时区，与时间桶来源一致', async () => {
    const timezoneFixture = createFixtureRepo([
      {
        message: 'different-author-committer-offsets',
        isoDate: '2025-01-06 09:15:00 +0800',
        committerIsoDate: '2025-01-05 18:15:00 -0700',
      },
    ])

    try {
      await expect(
        buildAnonymousBenchmark(timezoneFixture.repoPath, {
          year: '2025',
          timezone: '+0800',
        })
      ).rejects.toThrow('No commits matched')

      const bundle = await buildAnonymousBenchmark(timezoneFixture.repoPath, {
        year: '2025',
        timezone: '-0700',
      })
      expect(bundle.scope.timezone).toEqual({
        mode: 'filtered',
        offset: '-0700',
        dominantRatio: 1,
      })
      expect(bundle.sample.totalCommits).toBe(1)
      expect(bundle.sample.halfHourlyDistribution.find((item) => item.count > 0)).toEqual({
        time: '18:00',
        count: 1,
      })

      const unfilteredBundle = await buildAnonymousBenchmark(timezoneFixture.repoPath, {
        year: '2025',
      })
      expect(unfilteredBundle.scope.timezone).toEqual({
        mode: 'dominant',
        offset: '-0700',
        dominantRatio: 1,
      })
    } finally {
      timezoneFixture.cleanup()
    }
  })

  test('显式时区决定节假日模式，不受仓库主时区影响', async () => {
    const mixedTimezoneFixture = createFixtureRepo([
      {
        message: 'cn-majority-1',
        isoDate: '2025-01-06 09:00:00 +0800',
      },
      {
        message: 'cn-majority-2',
        isoDate: '2025-01-06 10:00:00 +0800',
      },
      {
        message: 'filtered-us-sample',
        isoDate: '2025-01-06 10:00:00 -0700',
      },
    ])

    try {
      const usBundle = await buildAnonymousBenchmark(mixedTimezoneFixture.repoPath, {
        allTime: true,
        timezone: '-0700',
      })
      expect(usBundle.sample.totalCommits).toBe(1)
      expect(usBundle.scope.timezone).toEqual({
        mode: 'filtered',
        offset: '-0700',
        dominantRatio: 1,
      })
      expect(usBundle.scope.holidayMode).toBe(false)

      const cnBundle = await buildAnonymousBenchmark(mixedTimezoneFixture.repoPath, {
        allTime: true,
        timezone: '+0800',
      })
      expect(cnBundle.sample.totalCommits).toBe(2)
      expect(cnBundle.scope.holidayMode).toBe(true)
    } finally {
      mixedTimezoneFixture.cleanup()
    }
  })

  test('作者排除同步应用于时区摘要和节假日模式', async () => {
    const ignoredAuthorFixture = createFixtureRepo([
      {
        message: 'bot-cn-1',
        isoDate: '2025-01-06 09:00:00 +0800',
        authorName: 'Build Bot',
        authorEmail: 'bot@example.com',
      },
      {
        message: 'bot-cn-2',
        isoDate: '2025-01-06 10:00:00 +0800',
        authorName: 'Build Bot',
        authorEmail: 'bot@example.com',
      },
      {
        message: 'human-us',
        isoDate: '2025-01-06 10:00:00 -0700',
        authorName: 'Human Dev',
        authorEmail: 'human@example.com',
      },
    ])

    try {
      const bundle = await buildAnonymousBenchmark(ignoredAuthorFixture.repoPath, {
        allTime: true,
        ignoreAuthor: 'Bot',
      })
      expect(bundle.sample.totalCommits).toBe(1)
      expect(bundle.scope.timezone).toEqual({
        mode: 'dominant',
        offset: '-0700',
        dominantRatio: 1,
      })
      expect(bundle.scope.holidayMode).toBe(false)
    } finally {
      ignoredAuthorFixture.cleanup()
    }
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

  test('当前仓库中只运行 code996 benchmark 即可生成无标签文件', async () => {
    const previousCwd = process.cwd()
    const args = ['node', 'code996', 'benchmark']
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      process.chdir(fixture.repoPath)
      await new CLIManager(args).parseAsync(args)

      const outputFile = fs
        .readdirSync(fixture.repoPath)
        .find((file) => /^code996-benchmark-[a-f0-9]{8}\.json$/.test(file))
      expect(outputFile).toBeDefined()

      const output = JSON.parse(fs.readFileSync(path.join(fixture.repoPath, outputFile!), 'utf8'))
      expect(output.labels).toMatchObject({
        status: 'unlabeled',
        schedule: 'unknown',
        teamSizeBucket: 'unknown',
        confidence: 'unknown',
      })
      expect(output.results.reference).toBeUndefined()
    } finally {
      process.chdir(previousCwd)
    }
  })
})
