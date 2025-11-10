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
    const { path } = options

    const args = ['log', '--format=%cd', `--date=format-local:%H`]
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    return this.parseTimeData(output, 'hour')
  }

  /**
   * 按星期统计commit数据
   */
  private async getCommitsByDay(options: GitLogOptions): Promise<TimeCount[]> {
    const { path } = options

    const args = ['log', '--format=%cd', `--date=format-local:%u`]
    this.applyCommonFilters(args, options)

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
    const { path } = options

    // 使用 --date=format 同时获取星期几和小时
    const args = ['log', '--format=%cd', '--date=format-local:%u %H']
    this.applyCommonFilters(args, options)

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
    const { path } = options

    const args = ['log', '--format=%cd', '--date=format-local:%Y-%m-%dT%H:%M:%S']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyLatest = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      const parsed = this.parseLocalTimestamp(trimmed)
      if (!parsed) {
        continue
      }

      const minutesFromMidnight = parsed.hour * 60 + parsed.minute
      const current = dailyLatest.get(parsed.dateKey)

      // 保存最晚的小时
      if (current === undefined || minutesFromMidnight > current) {
        dailyLatest.set(parsed.dateKey, minutesFromMidnight)
      }
    }

    return Array.from(dailyLatest.entries())
      .map(([date, minutes]) => ({
        date,
        hour: Math.floor(minutes / 60),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 获取每日所有提交的小时列表
   */
  private async getDailyCommitHours(options: GitLogOptions): Promise<DailyCommitHours[]> {
    const { path } = options

    const args = ['log', '--format=%cd', '--date=format-local:%Y-%m-%dT%H:%M:%S']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyHours = new Map<string, Set<number>>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      const parsed = this.parseLocalTimestamp(trimmed)
      if (!parsed) {
        continue
      }

      if (!dailyHours.has(parsed.dateKey)) {
        dailyHours.set(parsed.dateKey, new Set())
      }
      dailyHours.get(parsed.dateKey)!.add(parsed.hour)
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
    const { path } = options

    const args = ['log', '--format=%cd', '--date=format-local:%Y-%m-%dT%H:%M:%S']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyEarliest = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      const parsed = this.parseLocalTimestamp(trimmed)
      if (!parsed) {
        continue
      }

      const minutesFromMidnight = parsed.hour * 60 + parsed.minute
      const current = dailyEarliest.get(parsed.dateKey)

      if (current === undefined || minutesFromMidnight < current) {
        dailyEarliest.set(parsed.dateKey, minutesFromMidnight)
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
   * 根据 CLI 选项解析作者身份，生成正则用于 git --author 过滤
   */
  public async resolveSelfAuthor(path: string): Promise<{ pattern: string; displayLabel: string }> {
    const email = await this.getGitConfigValue('user.email', path)
    const name = await this.getGitConfigValue('user.name', path)

    if (!email && !name) {
      throw new Error('启用 --self 需要先配置 git config user.name 或 user.email')
    }

    const hasEmail = Boolean(email)
    const hasName = Boolean(name)

    const displayLabel = hasEmail && hasName ? `${name} <${email}>` : email || name || '未知用户'

    const pattern = hasEmail
      ? this.escapeAuthorPattern(email!)
      : this.escapeAuthorPattern(name!) // hasName must be true here，缺邮箱时退回姓名

    return {
      pattern,
      displayLabel,
    }
  }
  /** 统计符合过滤条件的 commit 数量 */
  public async countCommits(options: GitLogOptions): Promise<number> {
    const { path } = options

    const args = ['rev-list', '--count', 'HEAD']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const count = parseInt(output.trim(), 10)

    return isNaN(count) ? 0 : count
  }

  /**
   * 获取最早的commit时间
   */
  public async getFirstCommitDate(options: GitLogOptions): Promise<string> {
    const { path } = options

    const args = ['log', '--format=%cd', '--date=format:%Y-%m-%d', '--reverse', '--max-parents=0']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\\n').filter((line) => line.trim())
    return lines[0] || ''
  }

  /**
   * 获取最新的commit时间
   */
  public async getLastCommitDate(options: GitLogOptions): Promise<string> {
    const { path } = options

    const args = ['log', '--format=%cd', '--date=format:%Y-%m-%d', '-1']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\\n').filter((line) => line.trim())
    return lines[0] || ''
  }

  /**
   * 收集Git数据
   */
  async collect(options: GitLogOptions): Promise<GitLogData> {
    if (!options.silent) {
      console.log(chalk.blue(`正在分析仓库: ${options.path}`))
    }

    // 检查是否为有效的Git仓库
    if (!(await this.isValidGitRepo(options.path))) {
      throw new Error(`路径 "${options.path}" 不是一个有效的Git仓库`)
    }

    try {
      const [byHour, byDay, totalCommits, dailyFirstCommits, dayHourCommits, dailyLatestCommits, dailyCommitHours] =
        await Promise.all([
          this.getCommitsByHour(options),
          this.getCommitsByDay(options),
          this.countCommits(options),
          this.getDailyFirstCommits(options),
          this.getCommitsByDayAndHour(options),
          this.getDailyLatestCommits(options),
          this.getDailyCommitHours(options),
        ])

      if (!options.silent) {
        console.log(chalk.green(`数据采集完成: ${totalCommits} 个commit`))
      }

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
      if (!options.silent) {
        console.error(chalk.red(`数据采集失败: ${(error as Error).message}`))
      }
      throw error
    }
  }

  /**
   * 为 git 命令附加通用过滤条件（时间范围与作者）
   */
  private applyCommonFilters(args: string[], options: GitLogOptions): void {
    if (options.since) {
      args.push(`--since=${options.since}`)
    }
    if (options.until) {
      args.push(`--until=${options.until}`)
    }
    if (options.authorPattern) {
      args.push('--regexp-ignore-case')
      args.push('--extended-regexp')
      args.push(`--author=${options.authorPattern}`)
    }
  }

  /**
   * 解析 format-local 输出的时间戳，提取日期和小时信息
   */
  private parseLocalTimestamp(timestamp: string): { dateKey: string; hour: number; minute: number } | null {
    const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
    if (!match) {
      return null
    }

    const [, year, month, day, hourStr, minuteStr] = match
    const hour = parseInt(hourStr, 10)
    const minute = parseInt(minuteStr, 10)

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return null
    }

    return {
      dateKey: `${year}-${month}-${day}`,
      hour,
      minute,
    }
  }

  /**
   * 读取 git config 配置项（不存在时返回 null）
   */
  private async getGitConfigValue(key: string, path: string): Promise<string | null> {
    try {
      const value = await this.execGitCommand(['config', '--get', key], path)
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    } catch {
      return null
    }
  }

  /**
   * 转义正则特殊字符，构造安全的 --author 匹配模式
   */
  private escapeAuthorPattern(source: string): string {
    return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 获取所有提交者列表（name<email>格式）
   */
  public async getAllAuthors(options: GitLogOptions): Promise<Array<{ name: string; email: string }>> {
    const { path } = options

    const args = ['log', '--format=%an|%ae']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 使用 Map 去重，key 为 "name|email"
    const authorsMap = new Map<string, { name: string; email: string }>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const parts = trimmed.split('|')
      if (parts.length === 2) {
        const [name, email] = parts
        const key = `${name}|${email}`
        if (!authorsMap.has(key)) {
          authorsMap.set(key, { name, email })
        }
      }
    }

    return Array.from(authorsMap.values())
  }

  /**
   * 收集指定作者的 Git 数据
   */
  public async collectForAuthor(options: GitLogOptions, author: { name: string; email: string }): Promise<GitLogData> {
    // 使用邮箱作为精确匹配（邮箱更唯一）
    const authorPattern = this.escapeAuthorPattern(author.email)

    const authorOptions: GitLogOptions = {
      ...options,
      authorPattern,
      silent: true, // 静默模式，避免输出过多日志
    }

    return await this.collect(authorOptions)
  }
}
