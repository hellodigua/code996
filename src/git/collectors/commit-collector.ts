import {
  GitLogOptions,
  DailyFirstCommit,
  DayHourCommit,
  DailyLatestCommit,
  DailyCommitHours,
  DailyCommitCount,
} from '../../types/git-types'
import { BaseCollector } from './base-collector'

/**
 * 提交详情数据采集器
 * 负责采集每日首末提交、按星期和小时的提交分布等
 */
export class CommitCollector extends BaseCollector {
  /**
   * 按星期几和小时统计commit数据
   */
  async getCommitsByDayAndHour(options: GitLogOptions): Promise<DayHourCommit[]> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|D H|ISO_TIMESTAMP" (D=星期几 0-6，H=小时)
    // 使用提交时的原始时区
    const args = ['log', '--format=%an <%ae>|%cd|%ai', '--date=format:%w %H']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 统计每个 weekday+hour 组合的提交数
    const commitMap = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()

      // 分离作者、时间数据和ISO时间戳
      const parts = trimmed.split('|')
      if (parts.length < 3) {
        continue
      }

      const author = parts[0]
      const timeData = parts[1]
      const isoTimestamp = parts[2]

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      const timeParts = timeData.trim().split(/\s+/)

      if (timeParts.length >= 2) {
        const dayW = parseInt(timeParts[0], 10)
        const hour = parseInt(timeParts[1], 10)

        if (!isNaN(dayW) && !isNaN(hour) && dayW >= 0 && dayW <= 6 && hour >= 0 && hour <= 23) {
          // 转换：%w 的 0(周日) -> 7, 1-6 -> 1-6
          const weekday = dayW === 0 ? 7 : dayW
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
   * 获取每日最早的提交时间（分钟数表示）
   */
  async getDailyFirstCommits(options: GitLogOptions): Promise<DailyFirstCommit[]> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|YYYY-MM-DDTHH:MM:SS|ISO_TIMESTAMP"
    // 使用提交时的原始时区
    const args = ['log', '--format=%an <%ae>|%cd|%ai', '--date=format:%Y-%m-%dT%H:%M:%S']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyEarliest = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      // 分离作者、时间和ISO时间戳
      const parts = trimmed.split('|')
      if (parts.length < 3) {
        continue
      }

      const author = parts[0]
      const timestamp = parts[1]
      const isoTimestamp = parts[2]

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      const parsed = this.parseLocalTimestamp(timestamp)
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
   * 获取每日最晚的提交时间
   * 注意：凌晨0:00-6:00的提交会被归入前一天，因为这通常是前一天工作的延续
   */
  async getDailyLatestCommits(options: GitLogOptions): Promise<DailyLatestCommit[]> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|YYYY-MM-DDTHH:MM:SS|ISO_TIMESTAMP"
    // 使用提交时的原始时区
    const args = ['log', '--format=%an <%ae>|%cd|%ai', '--date=format:%Y-%m-%dT%H:%M:%S']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyLatest = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      // 分离作者、时间和ISO时间戳
      const parts = trimmed.split('|')
      if (parts.length < 3) {
        continue
      }

      const author = parts[0]
      const timestamp = parts[1]
      const isoTimestamp = parts[2]

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      const parsed = this.parseLocalTimestamp(timestamp)
      if (!parsed) {
        continue
      }

      let effectiveDate = parsed.dateKey
      let effectiveMinutes = parsed.hour * 60 + parsed.minute

      // 如果是凌晨0:00-6:00的提交，归入前一天
      // 这些提交通常是前一天加班的延续
      if (parsed.hour >= 0 && parsed.hour < 6) {
        const date = new Date(`${parsed.dateKey}T00:00:00`)
        date.setDate(date.getDate() - 1)
        effectiveDate = this.formatDateKey(date)
        // 分钟数需要加24小时，表示次日凌晨
        effectiveMinutes = effectiveMinutes + 24 * 60
      }

      const current = dailyLatest.get(effectiveDate)

      // 保存最晚的分钟数
      if (current === undefined || effectiveMinutes > current) {
        dailyLatest.set(effectiveDate, effectiveMinutes)
      }
    }

    return Array.from(dailyLatest.entries())
      .map(([date, minutesFromMidnight]) => ({
        date,
        minutesFromMidnight,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private formatDateKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 获取每日所有提交的小时列表
   */
  async getDailyCommitHours(options: GitLogOptions): Promise<DailyCommitHours[]> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|YYYY-MM-DDTHH:MM:SS|ISO_TIMESTAMP"
    // 使用提交时的原始时区
    const args = ['log', '--format=%an <%ae>|%cd|%ai', '--date=format:%Y-%m-%dT%H:%M:%S']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyHours = new Map<string, Set<number>>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      // 分离作者、时间和ISO时间戳
      const parts = trimmed.split('|')
      if (parts.length < 3) {
        continue
      }

      const author = parts[0]
      const timestamp = parts[1]
      const isoTimestamp = parts[2]

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      const parsed = this.parseLocalTimestamp(timestamp)
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
   * 获取每日提交数
   * @returns 每天的提交数列表（date: YYYY-MM-DD, count: 提交数）
   */
  async getDailyCommitCounts(options: GitLogOptions): Promise<DailyCommitCount[]> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|YYYY-MM-DD|ISO_TIMESTAMP"
    // 使用提交时的原始时区
    const args = ['log', '--format=%an <%ae>|%cd|%ai', '--date=format:%Y-%m-%d']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyCounts = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      // 分离作者、日期和ISO时间戳
      const parts = trimmed.split('|')
      if (parts.length < 3) {
        continue
      }

      const author = parts[0]
      const date = parts[1].trim()
      const isoTimestamp = parts[2]

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      // 验证日期格式 (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        continue
      }

      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
    }

    return Array.from(dailyCounts.entries())
      .map(([date, count]) => ({
        date,
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}
