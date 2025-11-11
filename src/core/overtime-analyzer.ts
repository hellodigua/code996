import {
  DayHourCommit,
  WeekdayOvertimeDistribution,
  WeekendOvertimeDistribution,
  LateNightAnalysis,
  WorkTimeDetectionResult,
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
   * @param customEndHour 自定义下班时间（优先级高于工作时间识别结果）
   */
  static calculateWeekdayOvertime(
    dayHourCommits: DayHourCommit[],
    workTime: WorkTimeDetectionResult,
    dailyCommitHours?: DailyCommitHours[],
    customEndHour?: number
  ): WeekdayOvertimeDistribution {
    const endHour = customEndHour !== undefined ? customEndHour : Math.ceil(workTime.endHour)

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
          const dayKey = dayNames[dayIndex]
          if (dayKey !== undefined) {
            overtimeCounts[dayKey] += count
          }
        }
      }
    }
    // 计算加班"天数"视角：某天存在至少一条下班后提交（使用精确分钟）
    const dayCounts = {
      mondayDays: 0,
      tuesdayDays: 0,
      wednesdayDays: 0,
      thursdayDays: 0,
      fridayDays: 0,
      totalOvertimeDays: 0,
    }

    // 加班严重程度分级（仅当设置了自定义下班时间时计算）
    const severityLevels = customEndHour !== undefined ? {
      light: 0,    // 下班后 2小时内
      moderate: 0, // 2-4小时
      severe: 0,   // 4-6小时
      extreme: 0,  // 6小时以上
    } : undefined

    if (dailyCommitHours && dailyCommitHours.length > 0) {
      for (const day of dailyCommitHours) {
        const dateObj = new Date(day.date)
        const dow = dateObj.getDay() // 0=Sun .. 6=Sat
        if (dow < 1 || dow > 5) continue
        // 精确判定：最后一次提交分钟 >= endHour*60 视为加班天
        const lastMinutes = day.lastMinutes
        if (lastMinutes !== undefined) {
          if (lastMinutes >= endHour * 60) {
            const map: Record<number, keyof typeof dayCounts> = {
              1: 'mondayDays',
              2: 'tuesdayDays',
              3: 'wednesdayDays',
              4: 'thursdayDays',
              5: 'fridayDays',
            }
            const dayKey = map[dow]
            if (dayKey !== undefined) {
              dayCounts[dayKey]++
              dayCounts.totalOvertimeDays++
            }

            // 计算加班严重程度
            if (severityLevels && customEndHour !== undefined) {
              const overtimeHours = (lastMinutes - customEndHour * 60) / 60
              if (overtimeHours <= 2) {
                severityLevels.light++
              } else if (overtimeHours <= 4) {
                severityLevels.moderate++
              } else if (overtimeHours <= 6) {
                severityLevels.severe++
              } else {
                severityLevels.extreme++
              }
            }
          }
        } else {
          // 兼容旧数据：若无分钟精度，使用小时集合判定
          const hasAfterEndHour = Array.from(day.hours.values()).some((h) => h >= endHour)
          if (hasAfterEndHour) {
            const map: Record<number, keyof typeof dayCounts> = {
              1: 'mondayDays',
              2: 'tuesdayDays',
              3: 'wednesdayDays',
              4: 'thursdayDays',
              5: 'fridayDays',
            }
            const dayKey = map[dow]
            if (dayKey !== undefined) {
              dayCounts[dayKey]++
              dayCounts.totalOvertimeDays++
            }
          }
        }
      }
    }

    // 找出加班最多的一天
    const entries = Object.entries(overtimeCounts)
    const firstEntry = entries[0]
    const maxEntry = firstEntry !== undefined 
      ? entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max), firstEntry)
      : undefined

    const dayNameMap: Record<string, string> = {
      monday: '周一',
      tuesday: '周二',
      wednesday: '周三',
      thursday: '周四',
      friday: '周五',
    }

    return {
      ...overtimeCounts,
      peakDay: maxEntry !== undefined ? (dayNameMap[maxEntry[0]] ?? undefined) : undefined,
      peakCount: maxEntry !== undefined ? maxEntry[1] : undefined,
      mondayDays: dayCounts.mondayDays,
      tuesdayDays: dayCounts.tuesdayDays,
      wednesdayDays: dayCounts.wednesdayDays,
      thursdayDays: dayCounts.thursdayDays,
      fridayDays: dayCounts.fridayDays,
      totalOvertimeDays: dayCounts.totalOvertimeDays,
      severityLevels,
    }
  }

  /**
   * 计算周末加班分布（基于每天的提交小时数区分真正加班和临时修复）
   * @param dailyCommitHours 每日提交小时列表
   */
  static calculateWeekendOvertime(
    dailyCommitHours: DailyCommitHours[],
    config?: { spanThreshold?: number; commitThreshold?: number; since?: string; until?: string }
  ): WeekendOvertimeDistribution {
    const spanThreshold = config?.spanThreshold ?? 3
    const commitThreshold = config?.commitThreshold ?? 3

    let saturdayDays = 0
    let sundayDays = 0
    let casualFixDays = 0
    let realOvertimeDays = 0

    for (const { date, hours, firstMinutes, lastMinutes, commitCount } of dailyCommitHours) {
      const commitDate = new Date(date)
      const dayOfWeek = commitDate.getDay() // 0=Sunday, 6=Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) continue

      // 计算真实跨度（小时）
      let spanHours: number | undefined
      if (firstMinutes !== undefined && lastMinutes !== undefined) {
        spanHours = (lastMinutes - firstMinutes) / 60
      }

      // 判定真正加班：同时满足跨度与提交数阈值；若缺失分钟精度则使用小时集合大小近似
      const effectiveCommitCount = commitCount ?? hours.size
      const effectiveSpan = spanHours !== undefined ? spanHours : hours.size // 退回小时段数量近似
      const isRealOvertime = effectiveSpan >= spanThreshold && effectiveCommitCount >= commitThreshold

      if (dayOfWeek === 6) {
        saturdayDays++
        if (isRealOvertime) realOvertimeDays++
        else casualFixDays++
      } else {
        sundayDays++
        if (isRealOvertime) realOvertimeDays++
        else casualFixDays++
      }
    }

    // 计算时间范围内总周末天数
    let totalWeekendDays: number | undefined
    if (config?.since && config?.until) {
      const sinceDate = new Date(config.since)
      const untilDate = new Date(config.until)
      let cursor = new Date(sinceDate.getTime())
      let count = 0
      while (cursor.getTime() <= untilDate.getTime()) {
        const dow = cursor.getDay()
        if (dow === 0 || dow === 6) count++
        cursor.setDate(cursor.getDate() + 1)
      }
      totalWeekendDays = count
    } else if (dailyCommitHours.length > 0) {
      const firstDay = dailyCommitHours[0]
      const lastDay = dailyCommitHours[dailyCommitHours.length - 1]
      if (firstDay !== undefined && lastDay !== undefined) {
        const minDate = new Date(firstDay.date)
        const maxDate = new Date(lastDay.date)
        let cursor = new Date(minDate.getTime())
        let count = 0
        while (cursor.getTime() <= maxDate.getTime()) {
          const dow = cursor.getDay()
          if (dow === 0 || dow === 6) count++
          cursor.setDate(cursor.getDate() + 1)
        }
        totalWeekendDays = count
      }
    }

    const activeWeekendDays = saturdayDays + sundayDays
    const realOvertimeRate =
      totalWeekendDays && totalWeekendDays > 0 ? (realOvertimeDays / totalWeekendDays) * 100 : undefined
    const weekendActivityRate =
      totalWeekendDays && totalWeekendDays > 0 ? (activeWeekendDays / totalWeekendDays) * 100 : undefined

    return {
      saturdayDays,
      sundayDays,
      casualFixDays,
      realOvertimeDays,
      activeWeekendDays,
      totalWeekendDays,
      realOvertimeRate,
      weekendActivityRate,
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
    for (const { date, hour: latestHour } of dailyLatestCommits) {
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
