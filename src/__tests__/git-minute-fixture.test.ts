import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { GitCollector } from '../git/git-collector'
import { GitParser } from '../git/git-parser'
import { TrendAnalyzer } from '../core/trend-analyzer'

function git(repo: string, args: string[], date?: string): void {
  execFileSync('git', args, {
    cwd: repo,
    stdio: 'ignore',
    env: date
      ? {
          ...process.env,
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_DATE: date,
        }
      : process.env,
  })
}

describe('受控 Git 仓库分钟级回归', () => {
  let repo: string

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'code996-minute-fixture-'))
    git(repo, ['init', '-q'])
    git(repo, ['config', 'user.name', 'Fixture User'])
    git(repo, ['config', 'user.email', 'fixture@example.com'])

    writeFileSync(join(repo, 'fixture.txt'), 'start\n')
    git(repo, ['add', 'fixture.txt'])
    git(repo, ['commit', '-q', '-m', 'start'], '2025-01-06T09:30:00+0800')

    writeFileSync(join(repo, 'fixture.txt'), 'start\novertime\n')
    git(repo, ['add', 'fixture.txt'])
    git(repo, ['commit', '-q', '-m', 'overtime'], '2025-01-06T18:30:00+0800')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  test('采集器保留 18:30，并按 9:30-18:30 判为加班', async () => {
    const collector = new GitCollector()
    const collected = await collector.collect({
      path: repo,
      since: '2025-01-01',
      until: '2025-01-31',
      timezone: '+0800',
      silent: true,
    })
    const parsed = await GitParser.parseGitData(collected, '9.5-18.5', '2025-01-01', '2025-01-31', false)

    expect(collected.byHour.find((item) => item.time === '09:30')?.count).toBe(1)
    expect(collected.byHour.find((item) => item.time === '18:30')?.count).toBe(1)
    expect(collected.dayHourCommits).toEqual(
      expect.arrayContaining([expect.objectContaining({ weekday: 1, hour: 18, minute: 30, count: 1 })])
    )
    expect(parsed.workHourPl).toEqual([
      { time: 'work', count: 1 },
      { time: 'overtime', count: 1 },
    ])
    expect(parsed.weekdayOvertime?.monday).toBe(1)
  })

  test('自定义工时贯穿月度趋势', async () => {
    const trend = await TrendAnalyzer.analyzeTrend(
      repo,
      '2025-01-01',
      '2025-01-31',
      undefined,
      undefined,
      '+0800',
      false,
      '9-19'
    )

    expect(trend.monthlyData).toHaveLength(1)
    expect(trend.monthlyData[0].index996).toBe(0)
  })
})
