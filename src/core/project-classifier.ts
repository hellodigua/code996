import { GitLogData, ParsedGitData, TimeCount } from '../types/git-types'
import { t } from '../i18n'

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
      isActive: boolean // 是否晚间活跃
      eveningToMorningRatio: number // 晚上/白天比率
      nightRatio: number // 晚间占比（晚上/总数）
      description: string
    }
    contributorsCount: {
      count: number // 贡献者数量
      description: string // 描述
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
    // 维度1: 工作时间规律性（最重要，可单独判定）
    const regularityResult = this.detectWorkTimeRegularity(rawData.byHour, rawData.byDay, rawData.dayHourCommits)

    // 维度2: 周末活跃度
    const weekendResult = this.detectWeekendActivity(parsedData.workWeekPl)

    // 维度3: 月光族模式
    const moonlightingResult = this.detectMoonlightingPattern(rawData.byHour, rawData.byDay, rawData.dayHourCommits)

    // 贡献者数量（仅用于记录，不参与判断）
    const contributorsCount = rawData.contributors || 0

    // 综合判断（不再使用贡献者数量作为判断依据）
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
        contributorsCount: {
          count: contributorsCount,
          description: this.getContributorsDescription(contributorsCount),
        },
      },
      reasoning,
    }
  }

  /**
   * 获取贡献者数量的描述
   */
  private static getContributorsDescription(count: number): string {
    if (count >= 100) return t('project.contributors.large', { count })
    if (count >= 50) return t('project.contributors.medium', { count })
    if (count >= 20) return t('project.contributors.small', { count })
    if (count >= 10) return t('project.contributors.team', { count })
    return t('project.contributors.default', { count })
  }

  /**
   * 维度1: 检测工作时间规律性
   * 公司项目的特征：周一到周五，上午逐渐增多，下午是高峰，晚上逐渐下降
   */
  private static detectWorkTimeRegularity(
    byHour: TimeCount[],
    byDay: TimeCount[],
    dayHourCommits?: any[]
  ): ProjectClassificationResult['dimensions']['workTimeRegularity'] {
    // 提取周一到周五的提交数据（使用 dayHourCommits 如果可用）
    const hourlyCommits = this.extractWorkdayHourlyData(byHour, byDay, dayHourCommits)
    if (hourlyCommits.length === 0 || hourlyCommits.every((c) => c === 0)) {
      return {
        score: 50,
        description: t('project.regularity.insufficient'),
        details: {
          morningUptrend: false,
          afternoonPeak: false,
          eveningDowntrend: false,
          nightLowActivity: false,
        },
      }
    }

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
      description = t('project.regularity.high')
    } else if (score >= 50) {
      description = t('project.regularity.medium')
    } else if (score >= 25) {
      description = t('project.regularity.low')
    } else {
      description = t('project.regularity.none')
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
   * 提取周一到周五的小时级提交数据（更精确的版本）
   * @param byHour 总的小时分布
   * @param byDay 星期分布
   * @param dayHourCommits 按星期和小时的详细分布（如果可用）
   * @returns 24小时数组，只包含工作日的提交
   */
  private static extractWorkdayHourlyData(
    byHour: TimeCount[],
    byDay: TimeCount[],
    dayHourCommits?: any[]
  ): number[] {
    // 如果有 dayHourCommits，使用精确数据
    if (dayHourCommits && dayHourCommits.length > 0) {
      const hourCounts = new Array(24).fill(0)

      for (const item of dayHourCommits) {
        const weekday = item.weekday // 1-7 (周一到周日)
        const hour = item.hour // 0-23
        const count = item.count

        // 只统计周一到周五（1-5）
        if (weekday >= 1 && weekday <= 5) {
          hourCounts[hour] += count
        }
      }

      return hourCounts
    }

    // 降级方案：计算工作日占比，按比例分配
    let workdayTotal = 0
    let totalCommits = 0

    for (const day of byDay) {
      const dayNum = parseInt(day.time, 10)
      totalCommits += day.count
      if (dayNum >= 1 && dayNum <= 5) {
        workdayTotal += day.count
      }
    }

    if (workdayTotal === 0 || totalCommits === 0) {
      return new Array(24).fill(0)
    }

    const workdayRatio = workdayTotal / totalCommits

    // 将 byHour 按工作日占比缩放
    const hourCounts = this.aggregateToHourArray(byHour)
    return hourCounts.map((count) => Math.round(count * workdayRatio))
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
        description: t('project.weekend.noData'),
      }
    }

    const ratio = weekendCount / total

    let description = ''
    if (ratio >= 0.30) {
      description = t('project.weekend.veryHigh')
    } else if (ratio >= 0.15) {
      description = t('project.weekend.high')
    } else {
      description = t('project.weekend.low')
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
    byDay: TimeCount[],
    dayHourCommits?: any[]
  ): ProjectClassificationResult['dimensions']['moonlightingPattern'] {
    // 获取工作日的小时数据
    const hourCounts = this.extractWorkdayHourlyData(byHour, byDay, dayHourCommits)

    // 白天时段：9:00-18:00
    const dayTimeCommits = hourCounts.slice(9, 18).reduce((sum, c) => sum + c, 0)

    // 晚上时段：19:00-24:00
    const nightTimeCommits = hourCounts.slice(19, 24).reduce((sum, c) => sum + c, 0)

    const total = dayTimeCommits + nightTimeCommits
    if (total === 0) {
      return {
        isActive: false,
        eveningToMorningRatio: 0,
        nightRatio: 0,
        description: t('project.moonlighting.noData'),
      }
    }

    const nightRatio = nightTimeCommits / total
    const eveningToMorningRatio = nightTimeCommits / dayTimeCommits

    // 判断标准：晚间提交占比 >= 25% 视为晚间活跃
    const isActive = nightRatio >= 0.25

    let description = ''
    const ratioText = (nightRatio * 100).toFixed(1)
    if (nightRatio >= 0.40) {
      description = t('project.moonlighting.veryHigh', { ratio: ratioText })
    } else if (nightRatio >= 0.30) {
      description = t('project.moonlighting.high', { ratio: ratioText })
    } else if (nightRatio >= 0.25) {
      description = t('project.moonlighting.active', { ratio: ratioText })
    } else {
      description = t('project.moonlighting.low', { ratio: ratioText })
    }

    return {
      isActive,
      eveningToMorningRatio,
      nightRatio,
      description,
    }
  }

  /**
   * 综合决策
   * 注意：贡献者数量不再作为判断依据，因为大公司项目也可能有很多贡献者
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

    // ========== 强特征判断（单独满足即可判定为开源项目）==========

    // 强特征: 工作时间规律性极低（<= 25 分）
    if (regularity.score <= 25) {
      return {
        projectType: ProjectType.OPEN_SOURCE,
        confidence: 90,
        reasoning: t('project.reason.noRegularity', { score: regularity.score }),
      }
    }

    // ========== 组合判断（多个弱特征组合）==========

    let ossScore = 0 // 开源项目得分

    // 规律性得分分析
    if (regularity.score < 30) {
      ossScore += 60
      reasons.push(t('project.reason.veryLowRegularity', { score: regularity.score }))
    } else if (regularity.score < 50) {
      ossScore += 40
      reasons.push(t('project.reason.lowRegularity', { score: regularity.score }))
    } else if (regularity.score < 75) {
      ossScore += 20
      reasons.push(t('project.reason.mediumRegularity', { score: regularity.score }))
    }

    // 周末活跃度分析
    if (weekend.ratio >= 0.30) {
      ossScore += 30
      reasons.push(t('project.reason.highWeekend', { ratio: (weekend.ratio * 100).toFixed(1) }))
    } else if (weekend.ratio >= 0.20) {
      ossScore += 20
      reasons.push(t('project.reason.higherWeekend', { ratio: (weekend.ratio * 100).toFixed(1) }))
    } else if (weekend.ratio >= 0.15) {
      ossScore += 10
      reasons.push(t('project.reason.mediumWeekend', { ratio: (weekend.ratio * 100).toFixed(1) }))
    }

    // 月光族模式
    if (moonlighting.isActive) {
      ossScore += 20
      reasons.push(t('project.reason.moonlighting'))
    }

    // 决策逻辑
    let projectType: ProjectType
    let confidence: number
    let reasoning: string

    if (ossScore >= 60) {
      projectType = ProjectType.OPEN_SOURCE
      confidence = Math.min(95, 50 + ossScore / 2)
      reasoning = t('project.reason.openSourceObvious', { reasons: reasons.join(t('project.reason.separator')) })
    } else if (ossScore >= 40) {
      projectType = ProjectType.UNCERTAIN
      confidence = 50
      reasoning = t('project.reason.unclear', { reasons: reasons.join(t('project.reason.separator')) })
    } else {
      projectType = ProjectType.CORPORATE
      confidence = Math.min(95, 80 - ossScore)
      reasoning = t('project.reason.corporate')
    }

    return {
      projectType,
      confidence: Math.round(confidence),
      reasoning,
    }
  }
}
