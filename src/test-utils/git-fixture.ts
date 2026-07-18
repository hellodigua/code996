import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'

export interface FixtureCommit {
  message: string
  isoDate: string
  content?: string
  authorName?: string
  authorEmail?: string
}

export interface FixtureRepo {
  repoPath: string
  cleanup: () => void
}

/**
 * 创建一个临时 Git 仓库，并按给定时间线写入提交。
 * 这里使用真实 git 命令而不是 mock，是为了让分析链路尽量贴近实际运行场景，
 * 特别适合用来做 CLI / i18n 的回归测试。
 */
export function createFixtureRepo(commits: FixtureCommit[]): FixtureRepo {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'code996-fixture-'))

  try {
    runGit(repoPath, ['init'])
    runGit(repoPath, ['config', 'user.name', 'Fixture User'])
    runGit(repoPath, ['config', 'user.email', 'fixture@example.com'])

    const filePath = path.join(repoPath, 'fixture.txt')
    fs.writeFileSync(filePath, 'fixture-start\n')

    commits.forEach((commit, index) => {
      const content = commit.content ?? `line-${index + 1} ${commit.isoDate}\n`
      fs.appendFileSync(filePath, content)

      runGit(repoPath, ['add', 'fixture.txt'])
      runGit(repoPath, ['commit', '-m', commit.message], {
        GIT_AUTHOR_DATE: commit.isoDate,
        GIT_COMMITTER_DATE: commit.isoDate,
        GIT_AUTHOR_NAME: commit.authorName ?? 'Fixture User',
        GIT_AUTHOR_EMAIL: commit.authorEmail ?? 'fixture@example.com',
        GIT_COMMITTER_NAME: commit.authorName ?? 'Fixture User',
        GIT_COMMITTER_EMAIL: commit.authorEmail ?? 'fixture@example.com',
      })
    })

    return {
      repoPath,
      cleanup: () => {
        fs.rmSync(repoPath, { recursive: true, force: true })
      },
    }
  } catch (error) {
    fs.rmSync(repoPath, { recursive: true, force: true })
    throw error
  }
}

function runGit(repoPath: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}): void {
  execFileSync('git', args, {
    cwd: repoPath,
    stdio: 'pipe',
    env: {
      ...process.env,
      ...extraEnv,
    },
  })
}

/**
 * 生成一个轻量样本仓库。
 * 这个场景故意让提交量不足，用来稳定覆盖“样本不足”这类提示分支。
 */
export function createLightWorkloadFixtureRepo(): FixtureRepo {
  return createFixtureRepo(
    createWeekdayTimeline('2025-01-06', 12).flatMap((date, index) => [
      createCommit(date, '09:00', `light-start-${index + 1}`),
      createCommit(date, '18:00', `light-end-${index + 1}`),
    ])
  )
}

/**
 * 生成一个完整报告仓库。
 * 这个场景覆盖：
 * 1. 足够的工作日样本，触发工作时间推测
 * 2. 超过 45 天的时间跨度，触发月度趋势
 * 3. 周末与深夜提交，触发对应分析模块
 */
export function createFullReportFixtureRepo(): FixtureRepo {
  const weekdays = createWeekdayTimeline('2025-01-06', 26)
  const commits: FixtureCommit[] = []

  weekdays.forEach((date, index) => {
    commits.push(createCommit(date, '09:00', `work-start-${index + 1}`))
    commits.push(createCommit(date, '11:30', `work-mid-${index + 1}`))
    commits.push(createCommit(date, '18:30', `work-end-${index + 1}`))

    // 每隔几个工作日追加一笔深夜提交，确保深夜分析模块有稳定样本
    if (index % 5 === 0) {
      commits.push(createCommit(date, '23:30', `late-night-${index + 1}`))
    }
  })
  ;['2025-01-11', '2025-02-08', '2025-03-08', '2025-03-15'].forEach((date, index) => {
    commits.push(createCommit(date, '10:00', `weekend-start-${index + 1}`))
    commits.push(createCommit(date, '14:00', `weekend-mid-${index + 1}`))
    commits.push(createCommit(date, '18:00', `weekend-end-${index + 1}`))
  })

  return createFixtureRepo(commits)
}

/**
 * 生成连续的工作日日期序列。
 * 这里显式跳过周末，保证 fixture 的工作日/周末分布完全可控，
 * 这样算法在不同机器和时区下更稳定，也更容易复现问题。
 */
function createWeekdayTimeline(startDate: string, count: number): string[] {
  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00Z`)

  while (dates.length < count) {
    const day = cursor.getUTCDay()
    if (day >= 1 && day <= 5) {
      dates.push(cursor.toISOString().slice(0, 10))
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function createCommit(date: string, time: string, message: string): FixtureCommit {
  return {
    message,
    isoDate: `${date} ${time}:00 +0800`,
  }
}
