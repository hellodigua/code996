import { TimezoneData, TimezoneAnalysisResult, TimeCount } from '../types/git-types'
import { t } from '../i18n'

/**
 * 时区分析器
 * 检测项目是否为跨时区协作，分析时区分布和睡眠时段
 */
export class TimezoneAnalyzer {
  private static readonly CROSS_TIMEZONE_THRESHOLD = 0.01 // 跨时区判定阈值：1%
  private static readonly SLEEP_WINDOW_HOURS = 5 // 睡眠时段窗口：连续5小时
  private static readonly SLEEP_RATIO_THRESHOLD = 0.01 // 睡眠时段提交占比阈值：1%

  /**
   * 分析时区分布，判断是否为跨时区项目
   * @param timezoneData 时区分布数据
   * @param hourData 24小时提交分布数据
   * @returns 跨时区分析结果
   */
  static analyzeTimezone(timezoneData: TimezoneData, hourData: TimeCount[]): TimezoneAnalysisResult {
    // 如果没有提交数据，返回默认结果
    if (timezoneData.totalCommits === 0) {
      return {
        isCrossTimezone: false,
        crossTimezoneRatio: 0,
        dominantTimezone: null,
        dominantRatio: 0,
        sleepPeriodRatio: 0,
        confidence: 0,
      }
    }

    // 方法1：时区离散度分析
    const tzDiversity = this.calculateTimezoneDiversity(timezoneData)

    // 方法2：睡眠时段占比分析
    const sleepAnalysis = this.analyzeSleepPeriod(hourData)

    // 综合判断：满足任一条件即视为跨时区
    const isCrossTimezone =
      tzDiversity.crossTimezoneRatio >= this.CROSS_TIMEZONE_THRESHOLD ||
      sleepAnalysis.minSleepRatio >= this.SLEEP_RATIO_THRESHOLD

    // 计算检测置信度
    const confidence = this.calculateConfidence(tzDiversity, sleepAnalysis, timezoneData.totalCommits)

    return {
      isCrossTimezone,
      crossTimezoneRatio: tzDiversity.crossTimezoneRatio,
      dominantTimezone: tzDiversity.dominantTimezone,
      dominantRatio: tzDiversity.dominantRatio,
      sleepPeriodRatio: sleepAnalysis.minSleepRatio,
      confidence,
      timezoneGroups: tzDiversity.groups,
    }
  }

  /**
   * 计算时区离散度
   * @param data 时区分布数据
   * @returns 时区离散度分析结果
   */
  private static calculateTimezoneDiversity(data: TimezoneData) {
    if (data.timezones.length === 0) {
      return {
        crossTimezoneRatio: 0,
        dominantTimezone: null,
        dominantRatio: 0,
        groups: [],
      }
    }

    // 找出主导时区（提交数最多的时区）
    const dominantTz = data.timezones[0]
    const dominantRatio = dominantTz.count / data.totalCommits

    // 跨时区比例 = 1 - 主导时区比例
    const crossTimezoneRatio = 1 - dominantRatio

    // 构建时区分组详情（前5个）
    const groups = data.timezones.slice(0, 5).map((tz) => ({
      offset: tz.offset,
      count: tz.count,
      ratio: tz.count / data.totalCommits,
    }))

    return {
      crossTimezoneRatio,
      dominantTimezone: dominantTz.offset,
      dominantRatio,
      groups,
    }
  }

  /**
   * 分析睡眠时段占比
   * 找出提交量最少的连续5小时，检查其占比
   * @param hourData 24小时提交分布数据
   * @returns 睡眠时段分析结果
   */
  private static analyzeSleepPeriod(hourData: TimeCount[]) {
    // 将 hourData 转换为 24 小时数组（聚合半小时数据）
    const hourCounts = this.aggregateToHourArray(hourData)
    const total = hourCounts.reduce((sum, count) => sum + count, 0)

    if (total === 0) {
      return { minSleepRatio: 0, sleepWindow: [] }
    }

    // 使用滑动窗口找出连续5小时提交量最少的时段
    let minSum = Infinity
    let minWindowStart = 0

    for (let start = 0; start < 24; start++) {
      let windowSum = 0

      for (let i = 0; i < this.SLEEP_WINDOW_HOURS; i++) {
        const hour = (start + i) % 24
        windowSum += hourCounts[hour]
      }

      if (windowSum < minSum) {
        minSum = windowSum
        minWindowStart = start
      }
    }

    // 计算最少时段的占比
    const minSleepRatio = minSum / total

    // 构建睡眠时段窗口
    const sleepWindow: number[] = []
    for (let i = 0; i < this.SLEEP_WINDOW_HOURS; i++) {
      sleepWindow.push((minWindowStart + i) % 24)
    }

    return {
      minSleepRatio,
      sleepWindow,
    }
  }

  /**
   * 将 hourData 聚合为 24 小时数组
   * @param hourData 按小时或半小时统计的提交数据
   * @returns 24小时的提交数量数组
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
   * 计算检测置信度
   * @param tzDiversity 时区离散度分析结果
   * @param sleepAnalysis 睡眠时段分析结果
   * @param totalCommits 总提交数
   * @returns 置信度百分比 (0-100)
   */
  private static calculateConfidence(
    tzDiversity: { crossTimezoneRatio: number },
    sleepAnalysis: { minSleepRatio: number },
    totalCommits: number
  ): number {
    // 基础置信度：基于提交数量（提交越多越可信）
    let baseConfidence = 0
    if (totalCommits < 50) {
      baseConfidence = 30
    } else if (totalCommits < 200) {
      baseConfidence = 50
    } else if (totalCommits < 500) {
      baseConfidence = 70
    } else {
      baseConfidence = 85
    }

    // 如果两种方法都指向跨时区，提升置信度
    const bothMethodsAgree =
      tzDiversity.crossTimezoneRatio >= this.CROSS_TIMEZONE_THRESHOLD &&
      sleepAnalysis.minSleepRatio >= this.SLEEP_RATIO_THRESHOLD

    if (bothMethodsAgree) {
      baseConfidence = Math.min(95, baseConfidence + 15)
    }

    return Math.round(baseConfidence)
  }

  /**
   * 生成跨时区警告信息
   * @param analysis 跨时区分析结果
   * @returns 格式化的警告文本
   */
  static generateWarningMessage(analysis: TimezoneAnalysisResult): string {
    if (!analysis.isCrossTimezone) {
      return ''
    }

    const lines: string[] = []
    lines.push(`⚠️  ${t('timezone.warning.title')}\n`)

    // 时区分布信息
    if (analysis.timezoneGroups && analysis.timezoneGroups.length > 0) {
      lines.push(t('timezone.warning.body', { ratio: (analysis.crossTimezoneRatio * 100).toFixed(1) }))
      lines.push(t('timezone.warning.groups'))

      for (const group of analysis.timezoneGroups.slice(0, 3)) {
        const percent = (group.ratio * 100).toFixed(1)
        lines.push(`  • ${group.offset}: ${percent}%`)
      }
      lines.push('')
    }

    // 建议
    lines.push(`💡 ${t('timezone.warning.tip')}`)

    return lines.join('\n')
  }
}
