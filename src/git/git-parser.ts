import {
  GitLogData,
  ParsedGitData,
  TimeCount,
  ValidationResult,
  WorkTimeData,
  Result996,
  WorkWeekPl,
  WorkTimeDetectionResult,
  DailyCommitCount,
} from '../types/git-types'
import { calculate996Index } from '../core/calculator'
import { WorkTimeAnalyzer } from '../core/work-time-analyzer'
import { OvertimeAnalyzer } from '../core/overtime-analyzer'
import { getWorkdayChecker } from '../utils/workday-checker'

export class GitParser {
  /**
   * 将原始Git数据转换为标准化格式
   * @param rawData 原始Git数据
   * @param customWorkHours 可选的自定义工作时间（格式："9-18"），如果不提供则自动识别
   * @param since 开始日期
   * @param until 结束日期
   */
  static async parseGitData(
    rawData: GitLogData,
    customWorkHours?: string,
    since?: string,
    until?: string
  ): Promise<ParsedGitData> {
    // 智能识别或使用自定义的工作时间
    const workTimeDetection = customWorkHours
      ? this.parseCustomWorkHours(customWorkHours)
      : WorkTimeAnalyzer.detectWorkingHours(rawData.byHour, rawData.dailyFirstCommits || [])

    // 计算加班相关分析
    const weekdayOvertime =
      rawData.dayHourCommits && rawData.dayHourCommits.length > 0
        ? OvertimeAnalyzer.calculateWeekdayOvertime(rawData.dayHourCommits, workTimeDetection)
        : undefined

    const weekendOvertime =
      rawData.dailyCommitHours && rawData.dailyCommitHours.length > 0
        ? await OvertimeAnalyzer.calculateWeekendOvertime(rawData.dailyCommitHours)
        : undefined

    const lateNightAnalysis =
      rawData.dailyLatestCommits &&
      rawData.dailyLatestCommits.length > 0 &&
      rawData.dailyFirstCommits &&
      rawData.dailyFirstCommits.length > 0
        ? await OvertimeAnalyzer.calculateLateNightAnalysis(
            rawData.dailyLatestCommits,
            rawData.dailyFirstCommits,
            workTimeDetection,
            since,
            until
          )
        : undefined

    // 使用 dailyCommitCounts 中的日期信息来正确判断工作日/周末（考虑中国调休）
    const workWeekPl = await this.calculateWorkWeekPl(rawData.byDay, rawData.dailyCommitCounts || [], rawData.byHour)

    return {
      hourData: rawData.byHour,
      dayData: rawData.byDay,
      totalCommits: rawData.totalCommits,
      workHourPl: this.calculateWorkHourPl(rawData.byHour, workTimeDetection),
      workWeekPl: workWeekPl as unknown as WorkWeekPl,
      detectedWorkTime: workTimeDetection, // 保存识别的工作时间
      dailyFirstCommits: rawData.dailyFirstCommits,
      weekdayOvertime,
      weekendOvertime,
      lateNightAnalysis,
    }
  }

  /**
   * 解析自定义工作时间字符串
   * @param customWorkHours 格式："9-18" 或 "9.5-18.5" (支持小数，0.5代表30分钟)
   * @returns 工作时间识别结果
   */
  private static parseCustomWorkHours(customWorkHours: string): WorkTimeDetectionResult {
    const parts = customWorkHours.split('-')
    if (parts.length !== 2) {
      throw new Error(`无效的工作时间格式: ${customWorkHours}，正确格式为 "9-18" 或 "9.5-18.5"`)
    }

    const startHour = parseFloat(parts[0])
    const endHour = parseFloat(parts[1])

    if (isNaN(startHour) || isNaN(endHour) || startHour < 0 || startHour > 23 || endHour < 0 || endHour > 24) {
      throw new Error(`无效的工作时间: ${customWorkHours}，小时必须在 0-23 之间，结束时间可到24`)
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
      confidence: 100, // 手动指定视为最高置信度
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
   * 使用 holiday-calendar 支持中国调休制度
   * @param dayData 按星期统计的提交数（兼容性保留）
   * @param dailyCommitCounts 每日提交数列表（包含具体日期和提交数）
   * @param hourData 按小时统计的提交数（用于验证）
   */
  private static async calculateWorkWeekPl(
    dayData: TimeCount[],
    dailyCommitCounts: DailyCommitCount[],
    hourData: TimeCount[]
  ): Promise<WorkDayPl> {
    // 如果没有具体日期信息，回退到基础判断（周一到周五为工作日）
    if (!dailyCommitCounts || dailyCommitCounts.length === 0) {
      return this.calculateWorkWeekPlBasic(dayData)
    }

    try {
      const checker = getWorkdayChecker()

      // 批量判断所有日期是否为工作日
      const dates = dailyCommitCounts.map((item) => item.date)
      const isWorkdayResults = await checker.isWorkdayBatch(dates)

      let workDayCount = 0
      let weekendCount = 0

      dailyCommitCounts.forEach((item, index) => {
        if (isWorkdayResults[index]) {
          workDayCount += item.count
        } else {
          weekendCount += item.count
        }
      })

      return [
        { time: '工作日', count: workDayCount },
        { time: '周末', count: weekendCount },
      ]
    } catch (error) {
      // 如果 holiday-calendar 查询失败，回退到基础判断
      console.warn('使用 holiday-calendar 失败，回退到基础判断:', error)
      return this.calculateWorkWeekPlBasic(dayData)
    }
  }

  /**
   * 基础的工作日/周末判断（不考虑调休）
   * 周一到周五为工作日，周六日为周末
   */
  private static calculateWorkWeekPlBasic(dayData: TimeCount[]): WorkDayPl {
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
