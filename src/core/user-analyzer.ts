import {
  UserWorkPattern,
  TeamAnalysis,
  WorkIntensityLevel,
  TimeCount,
  WorkTimePl,
  WorkWeekPl,
} from '../types/git-types'
import { UserPatternData } from '../git/collectors/user-pattern-collector'
import { WorkTimeAnalyzer } from './work-time-analyzer'
import { calculate996Index } from './calculator'

/**
 * 用户分析器
 * 负责对每个用户进行独立的工作时间分析和996指数计算，
 * 并在团队层面进行统计和聚类分析
 */
export class UserAnalyzer {
  /**
   * 分析单个用户的工作模式
   * @param baselineEndHour 团队基准下班时间（可选，用于分类）
   */
  static analyzeUser(
    userData: UserPatternData,
    totalCommits: number,
    baselineEndHour?: number
  ): UserWorkPattern {
    const { contributor, timeDistribution, dayDistribution, dailyFirstCommits, dailyLatestCommits } = userData

    // 计算工作时间（传入空数组作为dailyFirstCommits，因为我们没有单个用户的每日首提数据）
    const workingHours = WorkTimeAnalyzer.detectWorkingHours(timeDistribution, [])

    // 计算基于每日首末commit的平均上下班时间
    const avgTimes = this.calculateAverageWorkTimes(dailyFirstCommits, dailyLatestCommits)

    // 构建工作时间数据用于996指数计算（使用真实的星期分布）
    const workTimeData = this.buildWorkTimeData(
      timeDistribution,
      dayDistribution,
      workingHours.startHour,
      workingHours.endHour
    )

    // 计算996指数
    const result996 = calculate996Index(workTimeData)

    // 计算加班统计（简化版）
    const overtimeStats = this.calculateOvertimeStats(
      timeDistribution,
      workingHours.startHour,
      workingHours.endHour
    )

    // 判断工作强度等级（使用基准下班时间，如果没有则使用默认值18）
    const intensityLevel = this.classifyIntensityLevel(workingHours.endHour, baselineEndHour)

    return {
      author: contributor.author,
      email: contributor.email,
      totalCommits: contributor.commits,
      commitPercentage: (contributor.commits / totalCommits) * 100,
      timeDistribution,
      workingHours,
      ...avgTimes, // 包含 avgStartTimeMean, avgStartTimeMedian, avgEndTimeMean, avgEndTimeMedian, validDays
      index996: result996.index996,
      overtimeStats,
      intensityLevel,
    }
  }

  /**
   * 计算用户的平均上下班时间（算术平均 + 中位数）
   * 要求：至少10天或20次有效数据
   */
  private static calculateAverageWorkTimes(
    dailyFirstCommits: Array<{ minutesFromMidnight: number }>,
    dailyLatestCommits: Array<{ minutesFromMidnight: number }>
  ): {
    avgStartTimeMean?: number
    avgStartTimeMedian?: number
    avgEndTimeMean?: number
    avgEndTimeMedian?: number
    validDays?: number
  } {
    // 检查是否有足够的数据（至少10天或20次）
    const minDays = 10
    const minCommits = 20

    const hasEnoughStartData = dailyFirstCommits.length >= minDays || dailyFirstCommits.length >= minCommits
    const hasEnoughEndData = dailyLatestCommits.length >= minDays || dailyLatestCommits.length >= minCommits

    if (!hasEnoughStartData && !hasEnoughEndData) {
      return {}
    }

    const result: {
      avgStartTimeMean?: number
      avgStartTimeMedian?: number
      avgEndTimeMean?: number
      avgEndTimeMedian?: number
      validDays?: number
    } = {}

    // 计算上班时间
    if (hasEnoughStartData) {
      const startMinutes = dailyFirstCommits.map((c) => c.minutesFromMidnight)
      result.avgStartTimeMean = this.calculateMean(startMinutes) / 60 // 转换为小时
      result.avgStartTimeMedian = this.calculateMedian(startMinutes) / 60
    }

    // 计算下班时间
    if (hasEnoughEndData) {
      const endMinutes = dailyLatestCommits.map((c) => c.minutesFromMidnight)
      result.avgEndTimeMean = this.calculateMean(endMinutes) / 60
      result.avgEndTimeMedian = this.calculateMedian(endMinutes) / 60
    }

    // 记录有效天数（取较小值）
    result.validDays = Math.min(dailyFirstCommits.length, dailyLatestCommits.length)

    return result
  }

  /**
   * 计算算术平均值
   */
  private static calculateMean(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * 计算中位数
   */
  private static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2
    }
    return sorted[mid]
  }

  /**
   * 构建工作时间数据（用于996指数计算）
   */
  private static buildWorkTimeData(
    timeDistribution: TimeCount[],
    dayDistribution: TimeCount[],
    startHour: number,
    endHour: number
  ): { workHourPl: WorkTimePl; workWeekPl: WorkWeekPl; hourData: TimeCount[] } {
    // 统计正常工作时间和加班时间的提交数
    let normalWork = 0
    let overtime = 0

    for (const item of timeDistribution) {
      const hour = parseInt(item.time, 10)
      if (hour >= startHour && hour < endHour) {
        normalWork += item.count
      } else {
        overtime += item.count
      }
    }

    // 使用真实的星期分布数据
    // 周一到周五（1-5）为工作日，周六日（6-7）为周末
    let workdayCommits = 0
    let weekendCommits = 0

    for (const item of dayDistribution) {
      const day = parseInt(item.time, 10)
      if (day >= 1 && day <= 5) {
        workdayCommits += item.count
      } else if (day === 6 || day === 7) {
        weekendCommits += item.count
      }
    }

    const workHourPl: WorkTimePl = [
      { time: '工作', count: normalWork },
      { time: '加班', count: overtime },
    ]

    const workWeekPl: WorkWeekPl = [
      { time: '工作日', count: workdayCommits },
      { time: '周末', count: weekendCommits },
    ]

    return {
      workHourPl,
      workWeekPl,
      hourData: timeDistribution,
    }
  }

  /**
   * 计算加班统计（简化版）
   */
  private static calculateOvertimeStats(timeDistribution: TimeCount[], startHour: number, endHour: number) {
    let totalOvertime = 0

    for (const item of timeDistribution) {
      const hour = parseInt(item.time, 10)
      if (hour < startHour || hour >= endHour) {
        totalOvertime += item.count
      }
    }

    // 简化处理：假设加班中80%在工作日，20%在周末
    const workdayOvertime = Math.round(totalOvertime * 0.8)
    const weekendOvertime = totalOvertime - workdayOvertime

    return {
      workdayOvertime,
      weekendOvertime,
      totalOvertime,
    }
  }

  /**
   * 根据下班时间判断工作强度等级
   * @param endHour 个人下班时间
   * @param baselineEndHour 团队基准下班时间（默认18）
   */
  private static classifyIntensityLevel(endHour: number, baselineEndHour: number = 18): WorkIntensityLevel {
    // 动态计算分类阈值
    // normal: 基准时间之前
    // moderate: 基准时间到基准时间+2小时
    // heavy: 基准时间+2小时之后
    const normalThreshold = baselineEndHour
    const moderateThreshold = baselineEndHour + 2

    if (endHour < normalThreshold) return 'normal'
    if (endHour < moderateThreshold) return 'moderate'
    return 'heavy'
  }

  /**
   * 分析团队工作模式
   */
  static analyzeTeam(
    userPatterns: UserWorkPattern[],
    filterThreshold: number,
    totalContributors: number,
    overallIndex: number
  ): TeamAnalysis {
    // 先计算团队的基准下班时间（使用P50中位数）
    const endTimesForBaseline = userPatterns
      .filter((u) => u.workingHours && u.workingHours.endHour)
      .map((u) => u.workingHours!.endHour)
      .sort((a, b) => a - b)

    const baselineEndHour = endTimesForBaseline.length > 0 ? this.calculatePercentile(endTimesForBaseline, 50) : 18

    // 根据基准下班时间重新分类工作强度
    userPatterns.forEach((u) => {
      if (u.workingHours) {
        u.intensityLevel = this.classifyIntensityLevel(u.workingHours.endHour, baselineEndHour)
      }
    })

    // 按工作强度分类
    const distribution = {
      normal: userPatterns.filter((u) => u.intensityLevel === 'normal'),
      moderate: userPatterns.filter((u) => u.intensityLevel === 'moderate'),
      heavy: userPatterns.filter((u) => u.intensityLevel === 'heavy'),
    }

    // 统计分析
    const index996List = userPatterns.map((u) => u.index996 || 0).sort((a, b) => a - b)
    const statistics = {
      median996: this.calculatePercentile(index996List, 50),
      mean996: index996List.reduce((sum, val) => sum + val, 0) / index996List.length,
      range: [index996List[0], index996List[index996List.length - 1]] as [number, number],
      percentiles: {
        p25: this.calculatePercentile(index996List, 25),
        p50: this.calculatePercentile(index996List, 50),
        p75: this.calculatePercentile(index996List, 75),
        p90: this.calculatePercentile(index996List, 90),
      },
    }

    // 健康度评估
    const healthAssessment = this.assessTeamHealth(overallIndex, statistics.median996, distribution)

    return {
      coreContributors: userPatterns,
      totalAnalyzed: userPatterns.length,
      totalContributors,
      filterThreshold,
      baselineEndHour,
      distribution,
      statistics,
      healthAssessment,
    }
  }

  /**
   * 计算分位数
   */
  private static calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0
    const index = (percentile / 100) * (sortedValues.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower

    if (lower === upper) {
      return sortedValues[lower]
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
  }

  /**
   * 团队健康度评估
   */
  private static assessTeamHealth(
    overallIndex: number,
    teamMedianIndex: number,
    distribution: TeamAnalysis['distribution']
  ): TeamAnalysis['healthAssessment'] {
    let conclusion = ''
    let warning: string | undefined

    const heavyCount = distribution.heavy.length
    const totalCount = distribution.normal.length + distribution.moderate.length + distribution.heavy.length

    if (teamMedianIndex < 40) {
      conclusion = '团队整体节奏良好，工作生活平衡较好。'
    } else if (teamMedianIndex < 60) {
      conclusion = '团队整体节奏尚可，存在一定加班情况。'
    } else if (teamMedianIndex < 80) {
      conclusion = '团队加班较为普遍，建议关注成员健康。'
    } else {
      conclusion = '团队加班强度较大，需要重点关注。'
    }

    // 检查是否存在个别严重加班的情况
    if (heavyCount > 0 && heavyCount / totalCount < 0.3) {
      const heavyRatio = ((heavyCount / totalCount) * 100).toFixed(0)
      warning = `检测到 ${heavyCount} 名成员（${heavyRatio}%）存在严重加班情况，建议关注个别成员负荷。`
    }

    // 检查整体指数和中位数的差异
    const indexGap = overallIndex - teamMedianIndex
    if (indexGap > 20) {
      if (warning) {
        warning += ` 项目整体指数（${overallIndex.toFixed(0)}）明显高于团队中位数（${teamMedianIndex.toFixed(0)}），可能存在个别"卷王"拉高整体数据。`
      } else {
        warning = `项目整体指数（${overallIndex.toFixed(0)}）明显高于团队中位数（${teamMedianIndex.toFixed(0)}），可能存在个别"卷王"拉高整体数据。`
      }
    }

    return {
      overallIndex,
      teamMedianIndex,
      conclusion,
      warning,
    }
  }
}

