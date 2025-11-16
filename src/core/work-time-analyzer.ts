import { DailyFirstCommit, TimeCount, WorkTimeDetectionResult } from '../types/git-types'
import { detectEndHourWindow } from './end-hour-detector'

/**
 * 工作时间分析器
 * 根据每日最早提交时间推算上班时间，并利用小时分布估计下班时间
 */
export class WorkTimeAnalyzer {
  private static readonly STANDARD_WORK_HOURS = 9 // 默认工作时长兜底
  private static readonly MIN_VALID_MINUTES = 5 * 60 // 过滤非正常数据（早于5点视为无效）
  private static readonly MAX_VALID_MINUTES = 12 * 60 // 晚于中午12点视为无效

  /**
   * 检测工作时间
   * @param hourData 按小时统计的提交数量
   * @param dayData 按星期统计的提交数量（保留参数以兼容旧逻辑）
   * @param dailyFirstCommits 每日最早提交时间集合
   */
  static detectWorkingHours(
    hourData: TimeCount[],
    dailyFirstCommits: DailyFirstCommit[] = []
  ): WorkTimeDetectionResult {
    const filteredDailyCommits = this.filterValidDailyCommits(dailyFirstCommits)
    const sampleCount = filteredDailyCommits.length

    const minutesSamples = filteredDailyCommits.map((item) => item.minutesFromMidnight)
    let detectionMethod: WorkTimeDetectionResult['detectionMethod'] = 'default'

    let startRange: { startHour: number; endHour: number }
    const defaultMinutes = 9 * 60
    if (minutesSamples.length > 0) {
      const lowerQuantile = this.calculateQuantile(minutesSamples, 0.1, defaultMinutes)
      const upperQuantile = this.calculateQuantile(minutesSamples, 0.2, lowerQuantile + 60)
      startRange = this.buildStartHourRange(lowerQuantile, upperQuantile)
      detectionMethod = 'quantile-window'
    } else {
      startRange = this.buildStartHourRange(defaultMinutes, defaultMinutes + 30)
    }

    const startHour = startRange.startHour
    const standardEndHour = Math.min(startHour + this.STANDARD_WORK_HOURS, 24)
    const observedEndWindow = detectEndHourWindow(hourData, startHour, standardEndHour)
    const standardRange = this.buildEndHourRange(startHour, standardEndHour)

    const useObserved = observedEndWindow.method === 'backward-threshold'
    const effectiveEndHour = useObserved ? observedEndWindow.endHour : standardEndHour
    const effectiveRange = useObserved ? observedEndWindow.range : standardRange
    const endDetectionMethod = useObserved ? 'backward-threshold' : 'standard-shift'
    const confidence = this.estimateConfidence(sampleCount)

    return {
      startHour,
      endHour: effectiveEndHour,
      isReliable: confidence >= 60,
      sampleCount,
      detectionMethod,
      confidence,
      startHourRange: startRange,
      endHourRange: effectiveRange,
      endDetectionMethod,
    }
  }

  /**
   * 根据识别结果判断某个整点是否属于工作时间
   */
  static isWorkingHour(hour: number, detection: WorkTimeDetectionResult): boolean {
    const hourStartMinutes = hour * 60
    const startMinutes = detection.startHour * 60
    // 加班判定：即便检测到更晚的下班时间，正常工时最多只统计 9 小时
    const cappedEndHour = Math.min(detection.endHour, detection.startHour + this.STANDARD_WORK_HOURS)
    const endMinutes = Math.max(startMinutes, cappedEndHour * 60)
    return hourStartMinutes >= startMinutes && hourStartMinutes < endMinutes
  }

  /**
   * 过滤异常的每日最早提交数据（如凌晨噪点）
   */
  private static filterValidDailyCommits(dailyFirstCommits: DailyFirstCommit[]): DailyFirstCommit[] {
    return dailyFirstCommits.filter((item) => {
      if (item.minutesFromMidnight < this.MIN_VALID_MINUTES || item.minutesFromMidnight > this.MAX_VALID_MINUTES) {
        return false
      }

      const weekDay = new Date(`${item.date}T00:00:00Z`).getUTCDay()
      return weekDay >= 1 && weekDay <= 5
    })
  }

  /**
   * 计算分钟数组的分位数，若样本不足则回退到给定的默认值
   */
  private static calculateQuantile(samples: number[], quantile: number, fallback: number): number {
    if (!samples || samples.length === 0) {
      return fallback
    }

    const sorted = [...samples].sort((a, b) => a - b)
    const index = Math.floor((sorted.length - 1) * quantile)
    const value = sorted[index]

    if (value === undefined || Number.isNaN(value)) {
      return fallback
    }

    return value
  }

  /**
   * 将分钟数向下取整到最近的 30 分钟刻度
   */
  private static roundDownToHalfHour(minutes: number): number {
    const halfHourBlock = Math.floor(minutes / 30)
    return halfHourBlock * 30
  }

  /**
   * 构建上班时间段，基于分位数生成最长 1 小时的范围
   */
  private static buildStartHourRange(
    lowerMinutes: number,
    upperMinutes: number
  ): { startHour: number; endHour: number } {
    const boundedLower = Math.max(this.MIN_VALID_MINUTES, Math.min(lowerMinutes, this.MAX_VALID_MINUTES))
    const boundedUpper = Math.max(this.MIN_VALID_MINUTES, Math.min(upperMinutes, this.MAX_VALID_MINUTES))

    const sanitizedLower = this.roundDownToHalfHour(boundedLower)
    const sanitizedUpper = this.roundDownToHalfHour(Math.max(boundedUpper, sanitizedLower + 30))

    const start = Math.min(sanitizedLower, sanitizedUpper)
    let end = Math.max(sanitizedUpper, start + 30)

    // 限制范围不超过 1 小时，且不晚于中午 12 点
    end = Math.min(end, start + 60, this.MAX_VALID_MINUTES)

    return {
      startHour: start / 60,
      endHour: end / 60,
    }
  }

  /**
   * 根据最早上班时间推导标准 9 小时工作日的下班时间段
   */
  private static buildEndHourRange(startHour: number, endHour: number): { startHour: number; endHour: number } {
    const startMinutes = this.roundDownToHalfHour(Math.max(startHour * 60, this.MIN_VALID_MINUTES))
    const rawEndMinutes = Math.max(endHour * 60, startMinutes + this.STANDARD_WORK_HOURS * 60)
    const boundedEndMinutes = Math.min(rawEndMinutes, 24 * 60)
    const sanitizedEndMinutes = this.roundDownToHalfHour(boundedEndMinutes)

    const rangeEnd = sanitizedEndMinutes > 0 ? sanitizedEndMinutes : Math.min((startHour + 1) * 60, 24 * 60)
    const rangeStart = Math.max(startMinutes, rangeEnd - 60)

    return {
      startHour: rangeStart / 60,
      endHour: rangeEnd / 60,
    }
  }

  /**
   * 根据样本数量估算可信度（百分比）
   * 使用渐近函数，无限趋近90%但永不达到
   */
  private static estimateConfidence(sampleDays: number): number {
    if (sampleDays <= 0) {
      return 0
    }

    // 使用渐近函数：confidence = 90 * sampleDays / (sampleDays + 50)
    const confidence = (90 * sampleDays) / (sampleDays + 50)
    return Math.round(confidence)
  }
}
