import { GitLogData, TimeCount, DailyFirstCommit, DailyLatestCommit, DayHourCommit, DailyCommitHours } from '../types/git-types'

/**
 * Git 数据合并器
 * 负责将多个仓库的 GitLogData 合并为一个统一的数据集
 */
export class GitDataMerger {
  /**
   * 合并多个仓库的 Git 数据
   * @param dataList 多个仓库的 GitLogData 数组
   * @returns 合并后的 GitLogData
   */
  static merge(dataList: GitLogData[]): GitLogData {
    if (dataList.length === 0) {
      throw new Error('数据列表为空，无法合并')
    }

    if (dataList.length === 1) {
      return dataList[0]
    }

    return {
      byHour: this.mergeByHour(dataList),
      byDay: this.mergeByDay(dataList),
      totalCommits: this.mergeTotalCommits(dataList),
      dailyFirstCommits: this.mergeDailyFirstCommits(dataList),
      dayHourCommits: this.mergeDayHourCommits(dataList),
      dailyLatestCommits: this.mergeDailyLatestCommits(dataList),
      dailyCommitHours: this.mergeDailyCommitHours(dataList),
    }
  }

  /**
   * 合并按小时统计的数据（24小时）
   */
  private static mergeByHour(dataList: GitLogData[]): TimeCount[] {
    const hourMap = new Map<string, number>()

    // 初始化 24 小时
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0')
      hourMap.set(hour, 0)
    }

    // 累加各仓库的数据
    for (const data of dataList) {
      for (const item of data.byHour) {
        const current = hourMap.get(item.time) || 0
        hourMap.set(item.time, current + item.count)
      }
    }

    // 转换为数组
    const result: TimeCount[] = []
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0')
      result.push({
        time: hour,
        count: hourMap.get(hour) || 0,
      })
    }

    return result
  }

  /**
   * 合并按星期统计的数据（周一到周日）
   */
  private static mergeByDay(dataList: GitLogData[]): TimeCount[] {
    const dayMap = new Map<string, number>()

    // 初始化 7 天（1-7）
    for (let i = 1; i <= 7; i++) {
      dayMap.set(i.toString(), 0)
    }

    // 累加各仓库的数据
    for (const data of dataList) {
      for (const item of data.byDay) {
        const current = dayMap.get(item.time) || 0
        dayMap.set(item.time, current + item.count)
      }
    }

    // 转换为数组
    const result: TimeCount[] = []
    for (let i = 1; i <= 7; i++) {
      result.push({
        time: i.toString(),
        count: dayMap.get(i.toString()) || 0,
      })
    }

    return result
  }

  /**
   * 合并总提交数
   */
  private static mergeTotalCommits(dataList: GitLogData[]): number {
    return dataList.reduce((sum, data) => sum + data.totalCommits, 0)
  }

  /**
   * 合并每日首次提交时间
   * 策略：对于同一天，取所有仓库中最早的提交时间
   */
  private static mergeDailyFirstCommits(dataList: GitLogData[]): DailyFirstCommit[] | undefined {
    const dailyMap = new Map<string, number>()

    for (const data of dataList) {
      if (!data.dailyFirstCommits) {
        continue
      }

      for (const item of data.dailyFirstCommits) {
        const current = dailyMap.get(item.date)
        if (current === undefined || item.minutesFromMidnight < current) {
          dailyMap.set(item.date, item.minutesFromMidnight)
        }
      }
    }

    if (dailyMap.size === 0) {
      return undefined
    }

    return Array.from(dailyMap.entries())
      .map(([date, minutesFromMidnight]) => ({
        date,
        minutesFromMidnight,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 合并每日最晚提交时间
   * 策略：对于同一天，取所有仓库中最晚的提交时间
   */
  private static mergeDailyLatestCommits(dataList: GitLogData[]): DailyLatestCommit[] | undefined {
    const dailyMap = new Map<string, number>()

    for (const data of dataList) {
      if (!data.dailyLatestCommits) {
        continue
      }

      for (const item of data.dailyLatestCommits) {
        const current = dailyMap.get(item.date)
        if (current === undefined || item.hour > current) {
          dailyMap.set(item.date, item.hour)
        }
      }
    }

    if (dailyMap.size === 0) {
      return undefined
    }

    return Array.from(dailyMap.entries())
      .map(([date, hour]) => ({
        date,
        hour,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 合并按星期和小时的提交统计
   * 策略：累加相同 (weekday, hour) 组合的提交数
   */
  private static mergeDayHourCommits(dataList: GitLogData[]): DayHourCommit[] | undefined {
    const map = new Map<string, number>()

    for (const data of dataList) {
      if (!data.dayHourCommits) {
        continue
      }

      for (const item of data.dayHourCommits) {
        const key = `${item.weekday}-${item.hour}`
        const current = map.get(key) || 0
        map.set(key, current + item.count)
      }
    }

    if (map.size === 0) {
      return undefined
    }

    const result: DayHourCommit[] = []
    map.forEach((count, key) => {
      const [weekday, hour] = key.split('-').map((v) => parseInt(v, 10))
      result.push({ weekday, hour, count })
    })

    return result
  }

  /**
   * 合并每日提交小时列表
   * 策略：对于同一天，合并所有仓库的提交小时集合（取并集）
   */
  private static mergeDailyCommitHours(dataList: GitLogData[]): DailyCommitHours[] | undefined {
    const dailyMap = new Map<string, Set<number>>()

    for (const data of dataList) {
      if (!data.dailyCommitHours) {
        continue
      }

      for (const item of data.dailyCommitHours) {
        if (!dailyMap.has(item.date)) {
          dailyMap.set(item.date, new Set())
        }
        const hoursSet = dailyMap.get(item.date)!
        item.hours.forEach((hour) => hoursSet.add(hour))
      }
    }

    if (dailyMap.size === 0) {
      return undefined
    }

    return Array.from(dailyMap.entries())
      .map(([date, hours]) => ({
        date,
        hours,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}

