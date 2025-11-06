import { spawn } from 'child_process'
import {
  GitLogOptions,
  GitLogData,
  TimeCount,
  DailyFirstCommit,
  DayHourCommit,
  DailyLatestCommit,
  DailyCommitHours,
} from '../types/git-types'
import chalk from 'chalk'

export class GitCollector {
  private static readonly DEFAULT_SINCE = '1970-01-01'
  private static readonly DEFAULT_UNTIL = '2100-01-01'

  /**
   * 执行git命令并返回输出
   */
  private async execGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // 确保路径是绝对路径
      const absolutePath = require('path').resolve(cwd)

      const child = spawn('git', args, {
        cwd: absolutePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_DIR: `${absolutePath}/.git`,
          GIT_WORK_TREE: absolutePath,
        },
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Git命令执行失败 (退出码: ${code}): ${stderr}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`无法执行git命令: ${err.message}`))
      })
    })
  }

  /**
   * 检查是否为有效的Git仓库
   */
  private async isValidGitRepo(path: string): Promise<boolean> {
    try {
      await this.execGitCommand(['status'], path)
      return true
    } catch {
      return false
    }
  }

  /**
   * 按小时统计commit数据
   */
  private async getCommitsByHour(options: GitLogOptions): Promise<TimeCount[]> {
    const { path, since, until } = options

    const args = ['log', '--format=%cd', `--date=format:%H`]

    // 添加日期过滤器
    if (since) {
      args.push(`--since=${since}`)
    }
    if (until) {
      args.push(`--until=${until}`)
    }

    const output = await this.execGitCommand(args, path)
    return this.parseTimeData(output, 'hour')
  }

  /**
   * 按星期统计commit数据
   */
  private async getCommitsByDay(options: GitLogOptions): Promise<TimeCount[]> {
    const { path, since, until } = options

    const args = ['log', '--format=%cd', `--date=format:%u`]

    // 添加日期过滤器
    if (since) {
      args.push(`--since=${since}`)
    }
    if (until) {
      args.push(`--until=${until}`)
    }

    const output = await this.execGitCommand(args, path)
    return this.parseTimeData(output, 'day')
  }

  /**
   * 解析时间数据
   */
  private parseTimeData(output: string, type: 'hour' | 'day'): TimeCount[] {
    const lines = output.split('\n').filter((line) => line.trim())
    const timeCounts: TimeCount[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()
      const parts = trimmedLine.split(/\s+/)

      if (parts.length === 1) {
        const time = parts[0]

        if (time) {
          // 查找是否已存在该时间点的计数
          const existingIndex = timeCounts.findIndex((item) => item.time === time)
          if (existingIndex >= 0) {
            timeCounts[existingIndex].count++
          } else {
            timeCounts.push({
              time,
              count: 1,
            })
          }
        }
      }
    }

    // 确保所有时间点都有数据（补0）
    if (type === 'hour') {
      return this.fillMissingHours(timeCounts)
    }

    return this.fillMissingDays(timeCounts)
  }

  /**
   * 按星期几和小时统计commit数据
   */
  private async getCommitsByDayAndHour(options: GitLogOptions): Promise<DayHourCommit[]> {
    const { path, since, until } = options

    // 使用 --date=format 同时获取星期几和小时
    const args = ['log', '--format=%cd', '--date=format:%u %H']

    if (since) {
      args.push(`--since=${since}`)
    }
    if (until) {
      args.push(`--until=${until}`)
    }

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 统计每个 weekday+hour 组合的提交数
    const commitMap = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      const parts = trimmed.split(/\s+/)

      if (parts.length >= 2) {
        const weekday = parseInt(parts[0], 10)
        const hour = parseInt(parts[1], 10)

        if (!isNaN(weekday) && !isNaN(hour) && weekday >= 1 && weekday <= 7 && hour >= 0 && hour <= 23) {
          const key = `${weekday}-${hour}`
          commitMap.set(key, (commitMap.get(key) || 0) + 1)
        }
      }
    }

    // 转换为数组格式
    const result: DayHourCommit[] = []
    commitMap.forEach((count, key) => {
      const [weekday, hour] = key.split('-').map((v) => parseInt(v, 10))
      result.push({ weekday, hour, count })
    })

    return result
  }

  /**
   * 获取每日最晚的提交时间
   */
  private async getDailyLatestCommits(options: GitLogOptions): Promise<DailyLatestCommit[]> {
    const { path, since, until } = options

    const args = ['log', '--format=%cd', '--date=iso-strict']

    if (since) {
      args.push(`--since=${since}`)
    }
    if (until) {
      args.push(`--until=${until}`)
    }

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyLatest = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      const commitDate = new Date(trimmed)
      if (Number.isNaN(commitDate.getTime())) {
        continue
      }

      const dateKey = [
        commitDate.getFullYear(),
        (commitDate.getMonth() + 1).toString().padStart(2, '0'),
        commitDate.getDate().toString().padStart(2, '0'),
      ].join('-')

      const hour = commitDate.getHours()
      const current = dailyLatest.get(dateKey)

      // 保存最晚的小时
      if (current === undefined || hour > current) {
        dailyLatest.set(dateKey, hour)
      }
    }

    return Array.from(dailyLatest.entries())
      .map(([date, hour]) => ({
        date,
        hour,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 获取每日所有提交的小时列表
   */
  private async getDailyCommitHours(options: GitLogOptions): Promise<DailyCommitHours[]> {
    const { path, since, until } = options

    const args = ['log', '--format=%cd', '--date=iso-strict']

    if (since) {
      args.push(`--since=${since}`)
    }
    if (until) {
      args.push(`--until=${until}`)
    }

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyHours = new Map<string, Set<number>>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      const commitDate = new Date(trimmed)
      if (Number.isNaN(commitDate.getTime())) {
        continue
      }

      const dateKey = [
        commitDate.getFullYear(),
        (commitDate.getMonth() + 1).toString().padStart(2, '0'),
        commitDate.getDate().toString().padStart(2, '0'),
      ].join('-')

      const hour = commitDate.getHours()

      if (!dailyHours.has(dateKey)) {
        dailyHours.set(dateKey, new Set())
      }
      dailyHours.get(dateKey)!.add(hour)
    }

    return Array.from(dailyHours.entries())
      .map(([date, hours]) => ({
        date,
        hours,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 获取每日最早的提交时间（分钟数表示）
   */
  private async getDailyFirstCommits(options: GitLogOptions): Promise<DailyFirstCommit[]> {
    const { path, since, until } = options

    const args = ['log', '--format=%cd', '--date=iso-strict']

    if (since) {
      args.push(`--since=${since}`)
    }
    if (until) {
      args.push(`--until=${until}`)
    }

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyEarliest = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      const commitDate = new Date(trimmed)
      if (Number.isNaN(commitDate.getTime())) {
        continue
      }

      const dateKey = [
        commitDate.getFullYear(),
        (commitDate.getMonth() + 1).toString().padStart(2, '0'),
        commitDate.getDate().toString().padStart(2, '0'),
      ].join('-')

      const minutesFromMidnight = commitDate.getHours() * 60 + commitDate.getMinutes()
      const current = dailyEarliest.get(dateKey)

      if (current === undefined || minutesFromMidnight < current) {
        dailyEarliest.set(dateKey, minutesFromMidnight)
      }
    }

    return Array.from(dailyEarliest.entries())
      .map(([date, minutesFromMidnight]) => ({
        date,
        minutesFromMidnight,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 补全缺失的小时数据
   */
  private fillMissingHours(data: TimeCount[]): TimeCount[] {
    const hours: TimeCount[] = []

    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0')
      const existing = data.find((item) => item.time === hour)

      hours.push({
        time: hour,
        count: existing ? existing.count : 0,
      })
    }

    return hours
  }

  /**
   * 补全缺失的星期数据
   */
  private fillMissingDays(data: TimeCount[]): TimeCount[] {
    const days: TimeCount[] = []

    for (let i = 1; i <= 7; i++) {
      const day = i.toString()
      const existing = data.find((item) => item.time === day)

      days.push({
        time: day,
        count: existing ? existing.count : 0,
      })
    }

    return days
  }

  /**
   * 获取总commit数
   */
  private async getTotalCommits(options: GitLogOptions): Promise<number> {
    const { path, since, until } = options

    const args = ['rev-list', '--count', 'HEAD']

    // 添加日期过滤器
    if (since) {
      args.push(`--since=${since}`)
    }
    if (until) {
      args.push(`--until=${until}`)
    }

    const output = await this.execGitCommand(args, path)
    const count = parseInt(output.trim(), 10)

    return isNaN(count) ? 0 : count
  }

  /**
   * 获取最早的commit时间
   */
  public async getFirstCommitDate(options: GitLogOptions): Promise<string> {
    const { path, since, until } = options

    const args = ['log', '--format=%cd', '--date=format:%Y-%m-%d', '--reverse', '--max-parents=0']

    // 添加日期过滤器
    if (since) {
      args.push(`--since=${since}`)
    }
    if (until) {
      args.push(`--until=${until}`)
    }

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\\n').filter((line) => line.trim())
    return lines[0] || ''
  }

  /**
   * 获取最新的commit时间
   */
  public async getLastCommitDate(options: GitLogOptions): Promise<string> {
    const { path, since, until } = options

    const args = ['log', '--format=%cd', '--date=format:%Y-%m-%d', '-1']

    // 添加日期过滤器
    if (since) {
      args.push(`--since=${since}`)
    }
    if (until) {
      args.push(`--until=${until}`)
    }

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\\n').filter((line) => line.trim())
    return lines[0] || ''
  }

  /**
   * 收集Git数据
   */
  async collect(options: GitLogOptions): Promise<GitLogData> {
    console.log(chalk.blue(`正在分析仓库: ${options.path}`))

    // 检查是否为有效的Git仓库
    if (!(await this.isValidGitRepo(options.path))) {
      throw new Error(`路径 "${options.path}" 不是一个有效的Git仓库`)
    }

    try {
      const [byHour, byDay, totalCommits, dailyFirstCommits, dayHourCommits, dailyLatestCommits, dailyCommitHours] =
        await Promise.all([
          this.getCommitsByHour(options),
          this.getCommitsByDay(options),
          this.getTotalCommits(options),
          this.getDailyFirstCommits(options),
          this.getCommitsByDayAndHour(options),
          this.getDailyLatestCommits(options),
          this.getDailyCommitHours(options),
        ])

      console.log(chalk.green(`数据采集完成: ${totalCommits} 个commit`))

      return {
        byHour,
        byDay,
        totalCommits,
        dailyFirstCommits: dailyFirstCommits.length > 0 ? dailyFirstCommits : undefined,
        dayHourCommits: dayHourCommits.length > 0 ? dayHourCommits : undefined,
        dailyLatestCommits: dailyLatestCommits.length > 0 ? dailyLatestCommits : undefined,
        dailyCommitHours: dailyCommitHours.length > 0 ? dailyCommitHours : undefined,
      }
    } catch (error) {
      console.error(chalk.red(`数据采集失败: ${(error as Error).message}`))
      throw error
    }
  }
}
