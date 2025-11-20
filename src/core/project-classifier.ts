import { GitLogData, ParsedGitData, TimeCount } from '../types/git-types'

/**
 * 项目类型枚举
 */
export enum ProjectType {
  CORPORATE = 'corporate', // 公司项目/正常工作项目
  OPEN_SOURCE = 'open_source', // 开源项目/业余项目
  UNCERTAIN = 'uncertain', // 不确定
}

/**
 * 项目分类结果
 */
export interface ProjectClassificationResult {
  projectType: ProjectType
  confidence: number // 置信度 (0-100)
  dimensions: {
    workTimeRegularity: {
      score: number // 规律性得分 (0-100)
      description: string
      details: {
        morningUptrend: boolean // 上午是否上升
        afternoonPeak: boolean // 下午是否是高峰
        eveningDowntrend: boolean // 晚上是否下降
        nightLowActivity: boolean // 深夜是否低活跃
      }
    }
    weekendActivity: {
      ratio: number // 周末活跃度 (0-1)
      description: string
    }
    moonlightingPattern: {
      isActive: boolean // 是否为月光族模式
      eveningToMorningRatio: number // 晚上/白天比率
      description: string
    }
  }
  reasoning: string // 判断理由
}

/**
 * 项目分类器
 * 通过多个维度判断项目是公司项目还是开源项目
 */
export class ProjectClassifier {
  /**
   * 分类项目
   * @param rawData 原始 Git 数据
   * @param parsedData 解析后的 Git 数据
   * @returns 分类结果
   */
  static classify(rawData: GitLogData, parsedData: ParsedGitData): ProjectClassificationResult {
    // 维度1: 工作时间规律性（最重要）
    const regularityResult = this.detectWorkTimeRegularity(rawData.byHour, rawData.byDay)

    // 维度2: 周末活跃度
    const weekendResult = this.detectWeekendActivity(parsedData.workWeekPl)

    // 维度3: 月光族模式
    const moonlightingResult = this.detectMoonlightingPattern(rawData.byHour, rawData.byDay)

    // 综合判断
    const { projectType, confidence, reasoning } = this.makeDecision(
      regularityResult,
      weekendResult,
      moonlightingResult
    )

    return {
      projectType,
      confidence,
      dimensions: {
        workTimeRegularity: regularityResult,
        weekendActivity: weekendResult,
        moonlightingPattern: moonlightingResult,
      },
      reasoning,
    }
  }

  /**
   * 维度1: 检测工作时间规律性
   * 公司项目的特征：周一到周五，上午逐渐增多，下午是高峰，晚上逐渐下降
   */
  private static detectWorkTimeRegularity(
    byHour: TimeCount[],
    byDay: TimeCount[]
  ): ProjectClassificationResult['dimensions']['workTimeRegularity'] {
    // 提取周一到周五的提交数据
    const workdayCommits = this.extractWorkdayHourlyCommits(byHour, byDay)
    if (workdayCommits.length === 0) {
      return {
        score: 50,
        description: '数据不足',
        details: {
          morningUptrend: false,
          afternoonPeak: false,
          eveningDowntrend: false,
          nightLowActivity: false,
        },
      }
    }

    // 聚合为24小时数组（处理可能的半小时粒度）
    const hourlyCommits = this.aggregateToHourArray(workdayCommits)

    // 检查各个时段的特征
    const morningUptrend = this.checkMorningUptrend(hourlyCommits) // 6:00-12:00 上升
    const afternoonPeak = this.checkAfternoonPeak(hourlyCommits) // 14:00-17:00 是高峰
    const eveningDowntrend = this.checkEveningDowntrend(hourlyCommits) // 18:00-22:00 下降
    const nightLowActivity = this.checkNightLowActivity(hourlyCommits) // 22:00-6:00 低活跃

    // 计算规律性得分（每项25分）
    let score = 0
    if (morningUptrend) score += 25
    if (afternoonPeak) score += 25
    if (eveningDowntrend) score += 25
    if (nightLowActivity) score += 25

    // 生成描述
    let description = ''
    if (score >= 75) {
      description = '高规律性（典型的公司工作模式）'
    } else if (score >= 50) {
      description = '中等规律性'
    } else if (score >= 25) {
      description = '低规律性（可能是开源项目）'
    } else {
      description = '无规律性（典型的开源项目）'
    }

    return {
      score,
      description,
      details: {
        morningUptrend,
        afternoonPeak,
        eveningDowntrend,
        nightLowActivity,
      },
    }
  }

  /**
   * 提取周一到周五的小时级提交数据
   */
  private static extractWorkdayHourlyCommits(byHour: TimeCount[], byDay: TimeCount[]): TimeCount[] {
    // 计算周一到周五的总提交数
    let workdayTotal = 0
    for (const day of byDay) {
      const dayNum = parseInt(day.time, 10)
      if (dayNum >= 1 && dayNum <= 5) {
        workdayTotal += day.count
      }
    }

    if (workdayTotal === 0) return []

    // 简化处理：假设 byHour 中的提交主要来自工作日
    // （实际情况下，工作日通常占70-80%）
    return byHour
  }

  /**
   * 将 TimeCount 数组聚合为24小时数组
   */
  private static aggregateToHourArray(hourData: TimeCount[]): number[] {
    const hourCounts = new Array(24).fill(0)

    for (const item of hourData) {
      // 解析时间字符串，支持 "HH" 或 "HH:MM" 格式
      const hour = parseInt(item.time.split(':')[0], 10)

      if (!isNaN(hour) && hour >= 0 && hour < 24) {
        hourCounts[hour] += item.count
      }
    }

    return hourCounts
  }

  /**
   * 检查上午上升趋势（6:00-12:00）
   */
  private static checkMorningUptrend(hourCounts: number[]): boolean {
    const morning = hourCounts.slice(6, 12) // 6:00-11:00
    if (morning.every((c) => c === 0)) return false

    // 检查是否整体呈上升趋势（后半段平均值 > 前半段平均值）
    const firstHalf = morning.slice(0, 3).reduce((sum, c) => sum + c, 0) / 3
    const secondHalf = morning.slice(3, 6).reduce((sum, c) => sum + c, 0) / 3

    return secondHalf > firstHalf * 1.2 // 后半段至少比前半段多20%
  }

  /**
   * 检查下午高峰（14:00-17:00）
   */
  private static checkAfternoonPeak(hourCounts: number[]): boolean {
    const afternoon = hourCounts.slice(14, 18) // 14:00-17:00
    const morning = hourCounts.slice(9, 12) // 9:00-11:00
    const evening = hourCounts.slice(19, 22) // 19:00-21:00

    const afternoonAvg = afternoon.reduce((sum, c) => sum + c, 0) / afternoon.length
    const morningAvg = morning.reduce((sum, c) => sum + c, 0) / morning.length
    const eveningAvg = evening.reduce((sum, c) => sum + c, 0) / evening.length

    // 下午平均值应该是最高的
    return afternoonAvg > morningAvg && afternoonAvg > eveningAvg
  }

  /**
   * 检查晚上下降趋势（18:00-22:00）
   */
  private static checkEveningDowntrend(hourCounts: number[]): boolean {
    const evening = hourCounts.slice(18, 23) // 18:00-22:00
    if (evening.every((c) => c === 0)) return true // 晚上没有提交也算符合

    // 检查是否整体呈下降趋势（前半段平均值 > 后半段平均值）
    const firstHalf = evening.slice(0, 3).reduce((sum, c) => sum + c, 0) / 3
    const secondHalf = evening.slice(3, 5).reduce((sum, c) => sum + c, 0) / 2

    return firstHalf > secondHalf || secondHalf < firstHalf * 1.5 // 没有显著上升
  }

  /**
   * 检查深夜低活跃（22:00-6:00）
   */
  private static checkNightLowActivity(hourCounts: number[]): boolean {
    const night = [...hourCounts.slice(22, 24), ...hourCounts.slice(0, 6)] // 22:00-5:00
    const total = hourCounts.reduce((sum, c) => sum + c, 0)

    if (total === 0) return true

    const nightTotal = night.reduce((sum, c) => sum + c, 0)
    const nightRatio = nightTotal / total

    // 深夜提交占比应该 < 15%
    return nightRatio < 0.15
  }

  /**
   * 维度2: 检测周末活跃度
   */
  private static detectWeekendActivity(
    workWeekPl: ParsedGitData['workWeekPl']
  ): ProjectClassificationResult['dimensions']['weekendActivity'] {
    const workdayCount = workWeekPl[0].count
    const weekendCount = workWeekPl[1].count
    const total = workdayCount + weekendCount

    if (total === 0) {
      return {
        ratio: 0,
        description: '无数据',
      }
    }

    const ratio = weekendCount / total

    let description = ''
    if (ratio >= 0.35) {
      description = `${(ratio * 100).toFixed(1)}% (高周末活跃度)`
    } else if (ratio >= 0.25) {
      description = `${(ratio * 100).toFixed(1)}% (中等周末活跃度)`
    } else {
      description = `${(ratio * 100).toFixed(1)}% (低周末活跃度)`
    }

    return {
      ratio,
      description,
    }
  }

  /**
   * 维度3: 检测月光族模式（工作日晚上 vs 白天）
   */
  private static detectMoonlightingPattern(
    byHour: TimeCount[],
    byDay: TimeCount[]
  ): ProjectClassificationResult['dimensions']['moonlightingPattern'] {
    // 聚合为24小时数组
    const hourCounts = this.aggregateToHourArray(byHour)

    // 白天时段：9:00-18:00
    const dayTimeCommits = hourCounts.slice(9, 18).reduce((sum, c) => sum + c, 0)

    // 晚上时段：19:00-24:00
    const nightTimeCommits = hourCounts.slice(19, 24).reduce((sum, c) => sum + c, 0)

    const total = dayTimeCommits + nightTimeCommits
    if (total === 0) {
      return {
        isActive: false,
        eveningToMorningRatio: 0,
        description: '无数据',
      }
    }

    const ratio = nightTimeCommits / dayTimeCommits
    const isActive = nightTimeCommits > dayTimeCommits

    let description = ''
    if (isActive) {
      description = `晚上提交 > 白天提交 (${ratio.toFixed(2)}x)`
    } else {
      description = `白天提交 > 晚上提交 (${(1 / ratio).toFixed(2)}x)`
    }

    return {
      isActive,
      eveningToMorningRatio: ratio,
      description,
    }
  }

  /**
   * 综合决策
   */
  private static makeDecision(
    regularity: ProjectClassificationResult['dimensions']['workTimeRegularity'],
    weekend: ProjectClassificationResult['dimensions']['weekendActivity'],
    moonlighting: ProjectClassificationResult['dimensions']['moonlightingPattern']
  ): {
    projectType: ProjectType
    confidence: number
    reasoning: string
  } {
    const reasons: string[] = []
    let ossScore = 0 // 开源项目得分

    // 规律性得分 < 50 是强烈的开源项目信号
    if (regularity.score < 50) {
      ossScore += 50
      reasons.push(`工作时间规律性低 (${regularity.score}/100)`)
    } else if (regularity.score < 75) {
      ossScore += 25
      reasons.push(`工作时间规律性中等 (${regularity.score}/100)`)
    }

    // 周末活跃度 >= 35% 是开源项目信号
    if (weekend.ratio >= 0.35) {
      ossScore += 30
      reasons.push(`周末活跃度高 (${(weekend.ratio * 100).toFixed(1)}%)`)
    } else if (weekend.ratio >= 0.25) {
      ossScore += 15
      reasons.push(`周末活跃度中等 (${(weekend.ratio * 100).toFixed(1)}%)`)
    }

    // 月光族模式是开源项目信号
    if (moonlighting.isActive) {
      ossScore += 20
      reasons.push('晚上提交量超过白天')
    }

    // 决策逻辑
    let projectType: ProjectType
    let confidence: number
    let reasoning: string

    if (ossScore >= 60) {
      projectType = ProjectType.OPEN_SOURCE
      confidence = Math.min(95, 50 + ossScore / 2)
      reasoning = `开源项目特征明显：${reasons.join('；')}`
    } else if (ossScore >= 40) {
      projectType = ProjectType.UNCERTAIN
      confidence = 50
      reasoning = `项目特征不明确：${reasons.join('；')}`
    } else {
      projectType = ProjectType.CORPORATE
      confidence = Math.min(95, 80 - ossScore)
      reasoning = '符合公司项目特征'
    }

    return {
      projectType,
      confidence: Math.round(confidence),
      reasoning,
    }
  }
}
