import {
  GitLogData,
  ParsedGitData,
  TimeCount,
  ValidationResult,
  WorkTimeData,
  Result996,
  WorkWeekPl,
  WorkTimeDetectionResult,
} from '../types/git-types'
import { calculate996Index } from '../core/calculator'
import { WorkTimeAnalyzer } from '../core/work-time-analyzer'
import { OvertimeAnalyzer } from '../core/overtime-analyzer'

export class GitParser {
  /**
   * 将原始Git数据转换为标准化格式
   * @param rawData 原始Git数据
   * @param customWorkHours 可选的自定义工作时间（格式："9-18"），如果不提供则自动识别
   * @param since 开始日期
   * @param until 结束日期
   */
  static parseGitData(
    rawData: GitLogData,
    customWorkHours?: string,
    since?: string,
    until?: string,
    overtimeConfig?: { 
      weekendSpanThreshold?: number
      weekendCommitThreshold?: number
      weekdayMode?: 'commits' | 'days' | 'both'
      customEndHour?: number
    }
  ): ParsedGitData {
    // 智能识别或使用自定义的工作时间
    const workTimeDetection = customWorkHours
      ? this.parseCustomWorkHours(customWorkHours)
      : WorkTimeAnalyzer.detectWorkingHours(rawData.byHour, rawData.dailyFirstCommits || [])

    // 计算加班相关分析
    const weekdayOvertime =
      rawData.dayHourCommits && rawData.dayHourCommits.length > 0
        ? OvertimeAnalyzer.calculateWeekdayOvertime(
            rawData.dayHourCommits,
            workTimeDetection,
            rawData.dailyCommitHours,
            overtimeConfig?.customEndHour
          )
        : undefined

    const weekendOvertime =
      rawData.dailyCommitHours && rawData.dailyCommitHours.length > 0
        ? OvertimeAnalyzer.calculateWeekendOvertime(rawData.dailyCommitHours, {
            spanThreshold: overtimeConfig?.weekendSpanThreshold ?? undefined,
            commitThreshold: overtimeConfig?.weekendCommitThreshold ?? undefined,
            since: since ?? undefined,
            until: until ?? undefined,
          })
        : undefined

    const lateNightAnalysis =
      rawData.dailyLatestCommits &&
      rawData.dailyLatestCommits.length > 0 &&
      rawData.dailyFirstCommits &&
      rawData.dailyFirstCommits.length > 0
        ? OvertimeAnalyzer.calculateLateNightAnalysis(
            rawData.dailyLatestCommits,
            rawData.dailyFirstCommits,
            workTimeDetection,
            since,
            until
          )
        : undefined

    return {
      hourData: rawData.byHour,
      dayData: rawData.byDay,
      totalCommits: rawData.totalCommits,
      workHourPl: this.calculateWorkHourPl(rawData.byHour, workTimeDetection),
      workWeekPl: this.calculateWorkWeekPl(rawData.byDay) as unknown as WorkWeekPl,
      detectedWorkTime: workTimeDetection, // 保存识别的工作时间
      dailyFirstCommits: rawData.dailyFirstCommits,
      weekdayOvertime,
      weekendOvertime,
      lateNightAnalysis,
    }
  }

  /**
   * 解析自定义工作时间字符串
   * @param customWorkHours 格式："9-18" 或 "10-19"
   * @returns 工作时间识别结果
   */
  private static parseCustomWorkHours(customWorkHours: string): WorkTimeDetectionResult {
    const parts = customWorkHours.split('-')
    if (parts.length !== 2) {
      throw new Error(`无效的工作时间格式: ${customWorkHours}，正确格式为 "9-18"`)
    }

    const startHour = parseInt(parts[0], 10)
    const endHour = parseInt(parts[1], 10)

    if (isNaN(startHour) || isNaN(endHour) || startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
      throw new Error(`无效的工作时间: ${customWorkHours}，小时必须在 0-23 之间`)
    }

    if (startHour >= endHour) {
      throw new Error(`无效的工作时间: ${customWorkHours}，上班时间必须早于下班时间`)
    }

    return {
      startHour,
      endHour,
      isReliable: true,
      sampleCount: -1, // -1 表示手动指定
      detectionMethod: 'manual',
      confidence: 100, // 手动指定视为最高可信度
      startHourRange: {
        startHour,
        endHour: Math.min(endHour, startHour + 1),
      },
      endHourRange: {
        startHour: Math.max(startHour, endHour - 1),
        endHour,
      },
      endDetectionMethod: 'manual',
    }
  }

  /**
   * 计算工作时间分布（按小时）
   * @param hourData 按小时统计的commit数据
   * @param workTimeDetection 工作时间识别结果
   */
  private static calculateWorkHourPl(hourData: TimeCount[], workTimeDetection: WorkTimeDetectionResult): WorkTimePl {
    let workCount = 0
    let overtimeCount = 0

    for (const item of hourData) {
      const hour = parseInt(item.time, 10)

      // 判断是否在工作时间内
      if (WorkTimeAnalyzer.isWorkingHour(hour, workTimeDetection)) {
        workCount += item.count
      } else {
        overtimeCount += item.count
      }
    }

    return [
      { time: '工作', count: workCount },
      { time: '加班', count: overtimeCount },
    ]
  }

  /**
   * 计算工作时间分布（按星期）
   * 假设工作日为周一到周五，周末为加班
   */
  private static calculateWorkWeekPl(dayData: TimeCount[]): WorkDayPl {
    let workDayCount = 0
    let weekendCount = 0

    for (const item of dayData) {
      const day = parseInt(item.time, 10)

      // 工作日：周一到周五（1-5）
      if (day >= 1 && day <= 5) {
        workDayCount += item.count
      } else {
        weekendCount += item.count
      }
    }

    return [
      { time: '工作日', count: workDayCount },
      { time: '周末', count: weekendCount },
    ]
  }

  /**
   * 验证数据的完整性
   */
  static validateData(data: ParsedGitData): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 检查总commit数是否一致
    const hourTotal = data.hourData.reduce((sum, item) => sum + item.count, 0)
    const dayTotal = data.dayData.reduce((sum, item) => sum + item.count, 0)

    if (hourTotal !== data.totalCommits) {
      errors.push(`按小时统计的总commit数(${hourTotal})与实际总commit数(${data.totalCommits})不一致`)
    }

    if (dayTotal !== data.totalCommits) {
      errors.push(`按星期统计的总commit数(${dayTotal})与实际总commit数(${data.totalCommits})不一致`)
    }

    // 检查是否有足够的数据
    if (data.totalCommits === 0) {
      warnings.push('仓库中没有找到commit记录')
    }

    // 检查数据分布
    const workHourCount = data.workHourPl[0].count
    const overtimeHourCount = data.workHourPl[1].count
    const workDayCount = data.workWeekPl[0].count
    const weekendCount = data.workWeekPl[1].count

    if (workHourCount === 0 && overtimeHourCount > 0) {
      warnings.push('所有commit都在非工作时间，可能是加班严重或工作时间设置不合理')
    }

    if (workDayCount === 0 && weekendCount > 0) {
      warnings.push('所有commit都在周末，可能是周末工作或工作日设置不合理')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 计算 996 指数
   */
  static calculate996Index(data: ParsedGitData): Result996 {
    const workTimeData: WorkTimeData = {
      workHourPl: data.workHourPl,
      workWeekPl: data.workWeekPl,
      hourData: data.hourData,
    }

    return calculate996Index(workTimeData)
  }
}

export type WorkTimePl = [{ time: '工作' | '加班'; count: number }, { time: '工作' | '加班'; count: number }]

export type WorkDayPl = [{ time: '工作日' | '周末'; count: number }, { time: '工作日' | '周末'; count: number }]
