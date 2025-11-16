import {
  DayHourCommit,
  WeekdayOvertimeDistribution,
  WeekendOvertimeDistribution,
  LateNightAnalysis,
  WorkTimeDetectionResult,
  TimeCount,
  DailyFirstCommit,
  DailyLatestCommit,
  DailyCommitHours,
} from '../types/git-types'

/**
 * 加班分析器
 * 负责分析工作日加班分布和深夜加班情况
 */
export class OvertimeAnalyzer {
  /**
   * 计算工作日加班分布（周一到周五的下班后提交数）
   * @param dayHourCommits 按星期几和小时的提交数据
   * @param workTime 工作时间识别结果
   */
  static calculateWeekdayOvertime(
    dayHourCommits: DayHourCommit[],
    workTime: WorkTimeDetectionResult
  ): WeekdayOvertimeDistribution {
    const endHour = Math.ceil(workTime.endHour)

    // 初始化周一到周五的加班计数
    const overtimeCounts = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
    }

    // 统计每个工作日下班后的提交数
    for (const commit of dayHourCommits) {
      const { weekday, hour, count } = commit

      // 只统计工作日（周一到周五：1-5）
      if (weekday >= 1 && weekday <= 5) {
        // 只统计下班时间之后的提交
        if (hour >= endHour) {
          const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
          const dayIndex = weekday - 1
          overtimeCounts[dayNames[dayIndex]] += count
        }
      }
    }

    // 找出加班最多的一天
    const entries = Object.entries(overtimeCounts)
    const maxEntry = entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max), entries[0])

    const dayNameMap: Record<string, string> = {
      monday: '周一',
      tuesday: '周二',
      wednesday: '周三',
      thursday: '周四',
      friday: '周五',
    }

    return {
      ...overtimeCounts,
      peakDay: dayNameMap[maxEntry[0]],
      peakCount: maxEntry[1],
    }
  }

  /**
   * 计算周末加班分布（基于每天的提交小时数区分真正加班和临时修复）
   * @param dailyCommitHours 每日提交小时列表
   */
  static calculateWeekendOvertime(dailyCommitHours: DailyCommitHours[]): WeekendOvertimeDistribution {
    // 定义阈值：提交时间跨度 >= 3 小时才算真正加班
    const REAL_OVERTIME_THRESHOLD = 3

    // 统计结果
    let saturdayDays = 0
    let sundayDays = 0
    let casualFixDays = 0
    let realOvertimeDays = 0

    for (const { date, hours } of dailyCommitHours) {
      const commitDate = new Date(date)
      const dayOfWeek = commitDate.getDay() // 0=Sunday, 6=Saturday

      // 只统计周末
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        continue
      }

      const commitHours = hours.size

      // 根据提交的小时数判断是否为真正加班
      const isRealOvertime = commitHours >= REAL_OVERTIME_THRESHOLD

      if (dayOfWeek === 6) {
        // 周六
        saturdayDays++
        if (isRealOvertime) {
          realOvertimeDays++
        } else {
          casualFixDays++
        }
      } else if (dayOfWeek === 0) {
        // 周日
        sundayDays++
        if (isRealOvertime) {
          realOvertimeDays++
        } else {
          casualFixDays++
        }
      }
    }

    return {
      saturdayDays,
      sundayDays,
      casualFixDays,
      realOvertimeDays,
    }
  }

  /**
   * 计算深夜加班分析（基于每天的最晚提交时间）
   * @param dailyLatestCommits 每日最晚提交时间
   * @param dailyFirstCommits 每日首次提交时间（用于统计工作日）
   * @param workTime 工作时间识别结果
   * @param since 开始日期
   * @param until 结束日期
   */
  static calculateLateNightAnalysis(
    dailyLatestCommits: DailyLatestCommit[],
    dailyFirstCommits: DailyFirstCommit[],
    workTime: WorkTimeDetectionResult,
    since?: string,
    until?: string
  ): LateNightAnalysis {
    const endHour = Math.ceil(workTime.endHour)

    // 统计不同时段的天数（而不是提交数）
    let evening = 0 // 下班后-21:00
    let lateNight = 0 // 21:00-23:00
    let midnight = 0 // 23:00-02:00
    let dawn = 0 // 02:00-06:00

    // 统计有深夜/凌晨提交的天数
    const midnightDaysSet = new Set<string>()

    // 按照每天的最晚提交时间来统计
    for (const { date, minutesFromMidnight } of dailyLatestCommits) {
      const latestHour = Math.floor(minutesFromMidnight / 60)

      if (latestHour >= endHour && latestHour < 21) {
        evening++
      } else if (latestHour >= 21 && latestHour < 23) {
        lateNight++
      } else if (latestHour >= 23) {
        // 23:00-23:59 算作深夜
        midnight++
        midnightDaysSet.add(date)
      } else if (latestHour < 6) {
        // 00:00-05:59 算作凌晨
        // 注意：这里 latestHour 是当天的最晚时间，如果是凌晨，说明工作到了第二天凌晨
        dawn++
        midnightDaysSet.add(date)
      }
    }

    // 从 dailyFirstCommits 统计总工作日天数
    // 排除周末（需要解析日期）
    const workDaysSet = new Set<string>()
    for (const commit of dailyFirstCommits) {
      const date = new Date(commit.date)
      const dayOfWeek = date.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
      // 只统计周一到周五
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workDaysSet.add(commit.date)
      }
    }

    const midnightDays = midnightDaysSet.size
    const totalWorkDays = workDaysSet.size > 0 ? workDaysSet.size : 1 // 避免除以0
    const midnightRate = (midnightDays / totalWorkDays) * 100

    // 计算总周数和月数
    let totalWeeks = 0
    let totalMonths = 0

    if (since && until) {
      const sinceDate = new Date(since)
      const untilDate = new Date(until)
      const diffTime = Math.abs(untilDate.getTime() - sinceDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      totalWeeks = Math.max(1, Math.floor(diffDays / 7))
      totalMonths = Math.max(1, Math.floor(diffDays / 30))
    } else {
      // 如果没有时间范围，根据工作日天数估算
      totalWeeks = Math.max(1, Math.floor(totalWorkDays / 5))
      totalMonths = Math.max(1, Math.floor(totalWorkDays / 22))
    }

    return {
      evening,
      lateNight,
      midnight,
      dawn,
      midnightDays,
      totalWorkDays,
      midnightRate,
      totalWeeks,
      totalMonths,
    }
  }
}
