import { GitLogData, TimezoneData } from '../types/git-types'
import chalk from 'chalk'
import { t } from '../i18n'

/**
 * 按时区过滤 Git 数据
 * 注意：这是后处理近似过滤，精度有限
 */
export class TimezoneFilter {
  /**
   * 验证时区格式
   * @param timezone 时区字符串，如 "+0800", "-0700"
   */
  static isValidTimezone(timezone: string): boolean {
    return /^[+-]\d{4}$/.test(timezone)
  }

  /**
   * 按指定时区过滤数据
   * @param rawData 原始 Git 数据
   * @param targetTimezone 目标时区，如 "+0800"
   * @returns 过滤后的数据和元信息
   */
  static filterByTimezone(
    rawData: GitLogData,
    targetTimezone: string
  ): {
    filteredData: GitLogData
    ratio: number
    originalCommits: number
    filteredCommits: number
    warning: string
  } {
    // 验证时区格式
    if (!this.isValidTimezone(targetTimezone)) {
      throw new Error(t('timezone.filter.invalid', { timezone: targetTimezone }))
    }

    // 检查时区数据是否存在
    if (!rawData.timezoneData || rawData.timezoneData.totalCommits === 0) {
      throw new Error(t('timezone.filter.unavailable'))
    }

    const timezoneData = rawData.timezoneData

    // 查找目标时区
    const targetTzData = timezoneData.timezones.find((tz) => tz.offset === targetTimezone)

    if (!targetTzData) {
      // 列出可用时区
      const availableTimezones = timezoneData.timezones
        .slice(0, 5)
        .map((tz) => `${tz.offset} (${((tz.count / timezoneData.totalCommits) * 100).toFixed(1)}%)`)
        .join(', ')

      throw new Error(
        t('timezone.filter.missing', {
          timezone: targetTimezone,
          available: `${availableTimezones}${timezoneData.timezones.length > 5 ? '...' : ''}`,
        })
      )
    }

    // 计算目标时区占比
    const ratio = targetTzData.count / timezoneData.totalCommits
    const filteredCommits = targetTzData.count

    // 按占比缩放数据（后处理近似过滤）
    // 使用精确缩放确保总和一致
    const scaleArray = (items: Array<{ time: string; count: number }>): Array<{ time: string; count: number }> => {
      // 第一遍：按比例缩放并向下取整
      const scaled = items.map((item) => ({
        ...item,
        count: Math.floor(item.count * ratio),
        remainder: (item.count * ratio) % 1,
      }))

      // 计算差值
      const currentSum = scaled.reduce((sum, item) => sum + item.count, 0)
      let diff = filteredCommits - currentSum

      // 按余数大小排序，将差值分配给余数最大的项
      const sortedByRemainder = [...scaled].sort((a, b) => b.remainder - a.remainder)

      for (let i = 0; i < diff && i < sortedByRemainder.length; i++) {
        const item = sortedByRemainder[i]
        const index = scaled.findIndex((x) => x.time === item.time)
        if (index !== -1) {
          scaled[index].count++
        }
      }

      return scaled.map(({ time, count }) => ({ time, count }))
    }

    const filteredData: GitLogData = {
      ...rawData,
      totalCommits: filteredCommits,
      byHour: scaleArray(rawData.byHour),
      byDay: scaleArray(rawData.byDay),
      // 以下字段无法精确过滤，保持原样
      dailyFirstCommits: rawData.dailyFirstCommits,
      dayHourCommits: rawData.dayHourCommits
        ? scaleArray(
            rawData.dayHourCommits.map((item) => ({ time: `${item.weekday}-${item.hour}`, count: item.count }))
          ).map((item) => {
            const [weekday, hour] = item.time.split('-').map(Number)
            return { weekday, hour, count: item.count }
          })
        : undefined,
      dailyLatestCommits: rawData.dailyLatestCommits,
      dailyCommitHours: rawData.dailyCommitHours,
      contributors: rawData.contributors ? Math.max(1, Math.round(rawData.contributors * ratio)) : undefined,
    }

    // 生成警告信息
    const warning = this.generateFilterWarning(targetTimezone, ratio, timezoneData.totalCommits, filteredCommits)

    return {
      filteredData,
      ratio,
      originalCommits: timezoneData.totalCommits,
      filteredCommits,
      warning,
    }
  }

  /**
   * 生成过滤警告信息
   */
  private static generateFilterWarning(
    timezone: string,
    ratio: number,
    originalCommits: number,
    filteredCommits: number
  ): string {
    const lines: string[] = []

    lines.push(chalk.blue(`⚙️  ${t('timezone.filter.enabled')}`))
    lines.push('')
    lines.push(chalk.gray(t('timezone.filter.target', { timezone })))
    lines.push(chalk.gray(t('timezone.filter.ratio', { ratio: (ratio * 100).toFixed(1) })))
    lines.push(chalk.gray(t('timezone.filter.original', { original: originalCommits, filtered: filteredCommits })))
    lines.push('')
    lines.push(chalk.yellow(`⚠️  ${t('timezone.filter.note')}`))
    lines.push(chalk.gray(`  • ${t('timezone.filter.item.firstLast')}`))
    lines.push(chalk.gray(`  • ${t('timezone.filter.item.workTime')}`))
    lines.push(chalk.gray(`  • ${t('timezone.filter.item.partial')}`))
    lines.push('')
    lines.push(chalk.gray(`💡 ${t('timezone.filter.tip')}`))

    return lines.join('\n')
  }

  /**
   * 获取可用时区列表（用于提示）
   */
  static getAvailableTimezones(timezoneData: TimezoneData, limit: number = 5): string[] {
    return timezoneData.timezones.slice(0, limit).map((tz) => {
      const ratio = ((tz.count / timezoneData.totalCommits) * 100).toFixed(1)
      return `${tz.offset} (${ratio}%, ${tz.count} commits)`
    })
  }
}
