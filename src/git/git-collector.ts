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
            const existing = timeCounts[existingIndex]
            if (existing !== undefined) {
              existing.count++
            }
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
        const part0 = parts[0]
        const part1 = parts[1]
        if (part0 !== undefined && part1 !== undefined) {
          const weekday = parseInt(part0, 10)
          const hour = parseInt(part1, 10)

          if (!isNaN(weekday) && !isNaN(hour) && weekday >= 1 && weekday <= 7 && hour >= 0 && hour <= 23) {
            const key = `${weekday}-${hour}`
            commitMap.set(key, (commitMap.get(key) || 0) + 1)
          }
        }
      }
    }

    // 转换为数组格式
    const result: DayHourCommit[] = []
    commitMap.forEach((count, key) => {
      const parts = key.split('-')
      const part0 = parts[0]
      const part1 = parts[1]
      if (part0 !== undefined && part1 !== undefined) {
        const weekday = parseInt(part0, 10)
        const hour = parseInt(part1, 10)
        if (!isNaN(weekday) && !isNaN(hour)) {
          result.push({ weekday, hour, count })
        }
      }
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

  // date -> { hours:Set<number>, firstMinutes:number, lastMinutes:number, commitCount:number }
  const dailyHours = new Map<string, { hours: Set<number>; firstMinutes: number; lastMinutes: number; commitCount: number }>()

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
        dailyHours.set(parsed.dateKey, {
          hours: new Set<number>(),
          firstMinutes: parsed.hour * 60 + parsed.minute,
          lastMinutes: parsed.hour * 60 + parsed.minute,
          commitCount: 0,
        })
      }
      const info = dailyHours.get(parsed.dateKey)!
      info.hours.add(parsed.hour)
      const minutesFromMidnight = parsed.hour * 60 + parsed.minute
      if (minutesFromMidnight < info.firstMinutes) info.firstMinutes = minutesFromMidnight
      if (minutesFromMidnight > info.lastMinutes) info.lastMinutes = minutesFromMidnight
      info.commitCount++
    }

    return Array.from(dailyHours.entries())
      .map(([date, info]) => ({
        date,
        hours: info.hours,
        firstMinutes: info.firstMinutes,
        lastMinutes: info.lastMinutes,
        commitCount: info.commitCount,
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
   * 收集多个仓库的Git数据并合并
   */
  async collectMultiple(repoPaths: string[], options: Omit<GitLogOptions, 'path'>): Promise<GitLogData> {
    console.log(chalk.blue(`📦 正在分析 ${repoPaths.length} 个仓库...`))
    console.log()

    const allData: GitLogData[] = []

    for (let i = 0; i < repoPaths.length; i++) {
      const repoPath = repoPaths[i]
      if (repoPath === undefined) {
        continue
      }
      console.log(chalk.gray(`[${i + 1}/${repoPaths.length}] ${repoPath}`))

      try {
        const data = await this.collect({
          ...options,
          path: repoPath,
          silent: true,
        })
        allData.push(data)
        console.log(chalk.green(`  ✓ 完成: ${data.totalCommits} 个commit`))
      } catch (error) {
        console.log(chalk.red(`  ✗ 失败: ${(error as Error).message}`))
      }
    }

    console.log()
    console.log(chalk.blue(`🔄 正在合并数据...`))

    if (allData.length === 0) {
      throw new Error('没有成功采集到任何仓库的数据')
    }

    return this.mergeGitLogData(allData)
  }

  /**
   * 合并多个仓库的GitLogData
   */
  private mergeGitLogData(dataList: GitLogData[]): GitLogData {
    if (dataList.length === 0) {
      throw new Error('没有数据可以合并')
    }

    if (dataList.length === 1) {
      const firstData = dataList[0]
      if (firstData === undefined) {
        throw new Error('数据访问异常')
      }
      return firstData
    }

    // 合并 byHour
    const byHourMap = new Map<string, number>()
    for (const data of dataList) {
      for (const item of data.byHour) {
        byHourMap.set(item.time, (byHourMap.get(item.time) || 0) + item.count)
      }
    }
    const byHour: TimeCount[] = Array.from(byHourMap.entries()).map(([time, count]) => ({ time, count }))

    // 合并 byDay
    const byDayMap = new Map<string, number>()
    for (const data of dataList) {
      for (const item of data.byDay) {
        byDayMap.set(item.time, (byDayMap.get(item.time) || 0) + item.count)
      }
    }
    const byDay: TimeCount[] = Array.from(byDayMap.entries()).map(([time, count]) => ({ time, count }))

    // 合并 totalCommits
    const totalCommits = dataList.reduce((sum, data) => sum + data.totalCommits, 0)

    // 合并 dailyFirstCommits
    const allDailyFirstCommits: DailyFirstCommit[] = []
    for (const data of dataList) {
      if (data.dailyFirstCommits) {
        allDailyFirstCommits.push(...data.dailyFirstCommits)
      }
    }
    // 按日期分组,保留每天最早的
    const dailyFirstMap = new Map<string, number>()
    for (const item of allDailyFirstCommits) {
      const current = dailyFirstMap.get(item.date)
      if (current === undefined || item.minutesFromMidnight < current) {
        dailyFirstMap.set(item.date, item.minutesFromMidnight)
      }
    }
    const dailyFirstCommits: DailyFirstCommit[] = Array.from(dailyFirstMap.entries()).map(
      ([date, minutesFromMidnight]) => ({ date, minutesFromMidnight })
    )

    // 合并 dayHourCommits
    const dayHourMap = new Map<string, number>()
    for (const data of dataList) {
      if (data.dayHourCommits) {
        for (const item of data.dayHourCommits) {
          const key = `${item.weekday}-${item.hour}`
          dayHourMap.set(key, (dayHourMap.get(key) || 0) + item.count)
        }
      }
    }
    const dayHourCommits: DayHourCommit[] = Array.from(dayHourMap.entries()).map((entry) => {
  const parts = entry[0].split('-')
  const weekday = Number(parts[0])
  const hour = Number(parts[1])
  return { weekday, hour, count: entry[1] }
    })

    // 合并 dailyLatestCommits
    const allDailyLatestCommits: DailyLatestCommit[] = []
    for (const data of dataList) {
      if (data.dailyLatestCommits) {
        allDailyLatestCommits.push(...data.dailyLatestCommits)
      }
    }
    // 按日期分组,保留每天最晚的
    const dailyLatestMap = new Map<string, number>()
    for (const item of allDailyLatestCommits) {
      const current = dailyLatestMap.get(item.date)
      if (current === undefined || item.hour > current) {
        dailyLatestMap.set(item.date, item.hour)
      }
    }
    const dailyLatestCommits: DailyLatestCommit[] = Array.from(dailyLatestMap.entries()).map(([date, hour]) => ({
      date,
      hour,
    }))

    // 合并 dailyCommitHours
    const allDailyCommitHours: DailyCommitHours[] = []
    for (const data of dataList) {
      if (data.dailyCommitHours) {
        allDailyCommitHours.push(...data.dailyCommitHours)
      }
    }
    // 按日期分组,合并小时集合和统计数据
    const dailyHoursMap = new Map<
      string,
      { hours: Set<number>; firstMinutes: number; lastMinutes: number; commitCount: number }
    >()
    for (const item of allDailyCommitHours) {
      if (!dailyHoursMap.has(item.date)) {
        dailyHoursMap.set(item.date, {
          hours: new Set(item.hours),
          firstMinutes: item.firstMinutes ?? Infinity,
          lastMinutes: item.lastMinutes ?? -Infinity,
          commitCount: item.commitCount ?? 0,
        })
      } else {
        const existing = dailyHoursMap.get(item.date)!
        item.hours.forEach((h) => existing.hours.add(h))
        if (item.firstMinutes !== undefined && item.firstMinutes < existing.firstMinutes) {
          existing.firstMinutes = item.firstMinutes
        }
        if (item.lastMinutes !== undefined && item.lastMinutes > existing.lastMinutes) {
          existing.lastMinutes = item.lastMinutes
        }
        existing.commitCount += item.commitCount ?? 0
      }
    }
    const dailyCommitHours: DailyCommitHours[] = Array.from(dailyHoursMap.entries()).map(([date, info]) => ({
      date,
      hours: info.hours,
      firstMinutes: info.firstMinutes === Infinity ? undefined : info.firstMinutes,
      lastMinutes: info.lastMinutes === -Infinity ? undefined : info.lastMinutes,
      commitCount: info.commitCount,
    }))

    return {
      byHour,
      byDay,
      totalCommits,
      dailyFirstCommits: dailyFirstCommits.length > 0 ? dailyFirstCommits : undefined,
      dayHourCommits: dayHourCommits.length > 0 ? dayHourCommits : undefined,
      dailyLatestCommits: dailyLatestCommits.length > 0 ? dailyLatestCommits : undefined,
      dailyCommitHours: dailyCommitHours.length > 0 ? dailyCommitHours : undefined,
    }
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
    if (hourStr === undefined || minuteStr === undefined) {
      return null
    }
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
        const name = parts[0]
        const email = parts[1]
        if (name === undefined || email === undefined) {
          continue
        }
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
