import { GitLogOptions, TimezoneData } from '../../types/git-types'
import { BaseCollector } from './base-collector'

/**
 * 时区数据采集器
 * 负责采集提交的时区偏移量分布
 */
export class TimezoneCollector extends BaseCollector {
  /**
   * 采集所有提交的时区偏移量
   * @returns 时区分布数据
   */
  async collectTimezones(options: GitLogOptions): Promise<TimezoneData> {
    const { path } = options

    // 同时读取作者和 committer 时间，使作者排除规则与其他时间统计保持一致。
    // 格式示例: "Author Name <email@example.com>|2025-11-20 10:15:21 +0800"
    const args = ['log', '--format=%an <%ae>|%ci']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 统计时区分布
    const timezoneMap = new Map<string, number>()
    let totalCommits = 0

    for (const line of lines) {
      const separatorIndex = line.lastIndexOf('|')
      if (separatorIndex < 0) continue

      const author = line.slice(0, separatorIndex)
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) continue

      totalCommits++
      const timezone = this.extractTimezone(line.slice(separatorIndex + 1))
      if (timezone && this.isValidTimezone(timezone)) {
        timezoneMap.set(timezone, (timezoneMap.get(timezone) || 0) + 1)
      }
    }

    // 转换为数组并按提交数降序排序
    const timezones = Array.from(timezoneMap.entries())
      .map(([offset, count]) => ({ offset, count }))
      .sort((a, b) => b.count - a.count)

    return {
      totalCommits,
      timezones,
    }
  }

  /**
   * 从 ISO 8601 格式的日期字符串中提取时区
   * @param dateStr 格式: "2025-11-20 10:15:21 +0800"
   * @returns 时区偏移，如 "+0800", "-0700"
   */
  private extractTimezone(dateStr: string): string | null {
    // 匹配最后的时区偏移量：+HHMM 或 -HHMM
    const match = dateStr.match(/([+-]\d{4})$/)
    return match ? match[1] : null
  }

  /**
   * 验证时区格式是否有效
   * @param timezone 时区字符串，如 "+0800", "-0700"
   */
  private isValidTimezone(timezone: string): boolean {
    // 时区格式：+HHMM 或 -HHMM
    return /^[+-]\d{4}$/.test(timezone)
  }
}
