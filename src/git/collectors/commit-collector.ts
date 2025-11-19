import {
  GitLogOptions,
  DailyFirstCommit,
  DayHourCommit,
  DailyLatestCommit,
  DailyCommitHours,
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

    // 格式: "Author Name <email@example.com>|D H" (D=星期几，H=小时)
    const args = ['log', '--format=%an <%ae>|%cd', '--date=format-local:%u %H']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 统计每个 weekday+hour 组合的提交数
    const commitMap = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      
      // 分离作者和时间数据
      const pipeIndex = trimmed.lastIndexOf('|')
      if (pipeIndex === -1) {
        continue
      }

      const author = trimmed.substring(0, pipeIndex)
      const timeData = trimmed.substring(pipeIndex + 1)

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      const parts = timeData.trim().split(/\s+/)

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
   * 获取每日最早的提交时间（分钟数表示）
   */
  async getDailyFirstCommits(options: GitLogOptions): Promise<DailyFirstCommit[]> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|YYYY-MM-DDTHH:MM:SS"
    const args = ['log', '--format=%an <%ae>|%cd', '--date=format-local:%Y-%m-%dT%H:%M:%S']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyEarliest = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      // 分离作者和时间
      const pipeIndex = trimmed.lastIndexOf('|')
      if (pipeIndex === -1) {
        continue
      }

      const author = trimmed.substring(0, pipeIndex)
      const timestamp = trimmed.substring(pipeIndex + 1)

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
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

    // 格式: "Author Name <email@example.com>|YYYY-MM-DDTHH:MM:SS"
    const args = ['log', '--format=%an <%ae>|%cd', '--date=format-local:%Y-%m-%dT%H:%M:%S']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyLatest = new Map<string, number>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      // 分离作者和时间
      const pipeIndex = trimmed.lastIndexOf('|')
      if (pipeIndex === -1) {
        continue
      }

      const author = trimmed.substring(0, pipeIndex)
      const timestamp = trimmed.substring(pipeIndex + 1)

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
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

    // 格式: "Author Name <email@example.com>|YYYY-MM-DDTHH:MM:SS"
    const args = ['log', '--format=%an <%ae>|%cd', '--date=format-local:%Y-%m-%dT%H:%M:%S']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const dailyHours = new Map<string, Set<number>>()

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      // 分离作者和时间
      const pipeIndex = trimmed.lastIndexOf('|')
      if (pipeIndex === -1) {
        continue
      }

      const author = trimmed.substring(0, pipeIndex)
      const timestamp = trimmed.substring(pipeIndex + 1)

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
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
}
