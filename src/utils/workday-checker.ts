/**
 * 工作日检查工具
 * 集成 holiday-calendar 包，支持中国调休制度
 */

import HolidayCalendar from 'holiday-calendar'

/**
 * 工作日检查器
 * 封装 holiday-calendar 的调用逻辑，支持中国法定节假日和调休工作日
 * 默认只支持中国（CN）地区
 */
export class WorkdayChecker {
  private calendar: HolidayCalendar
  private readonly region = 'CN'

  constructor() {
    this.calendar = new HolidayCalendar()
  }

  /**
   * 判断某个日期是否为工作日
   * @param date 日期字符串 (YYYY-MM-DD) 或 Date 对象
   * @returns 是否为工作日
   */
  async isWorkday(date: string | Date): Promise<boolean> {
    const dateStr = this.formatDate(date)
    try {
      return await this.calendar.isWorkday(this.region, dateStr)
    } catch (error) {
      // 如果查询失败（可能是数据不存在），回退到基础判断
      return this.fallbackIsWorkday(date)
    }
  }

  /**
   * 判断某个日期是否为假期（法定节假日或周末）
   * @param date 日期字符串 (YYYY-MM-DD) 或 Date 对象
   * @returns 是否为假期
   */
  async isHoliday(date: string | Date): Promise<boolean> {
    const dateStr = this.formatDate(date)
    try {
      return await this.calendar.isHoliday(this.region, dateStr)
    } catch (error) {
      // 如果查询失败，回退到基础判断
      return this.fallbackIsHoliday(date)
    }
  }

  /**
   * 批量判断多个日期是否为工作日
   * @param dates 日期数组
   * @returns 工作日判断结果数组
   */
  async isWorkdayBatch(dates: Array<string | Date>): Promise<boolean[]> {
    return Promise.all(dates.map((date) => this.isWorkday(date)))
  }

  /**
   * 批量判断多个日期是否为假期
   * @param dates 日期数组
   * @returns 假期判断结果数组
   */
  async isHolidayBatch(dates: Array<string | Date>): Promise<boolean[]> {
    return Promise.all(dates.map((date) => this.isHoliday(date)))
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private formatDate(date: string | Date): string {
    if (typeof date === 'string') {
      return date
    }
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 回退方案：基础的工作日判断（不考虑调休）
   * 当 holiday-calendar 数据不可用时使用
   */
  private fallbackIsWorkday(date: string | Date): boolean {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    const dayOfWeek = dateObj.getDay()
    // 周一到周五为工作日
    return dayOfWeek >= 1 && dayOfWeek <= 5
  }

  /**
   * 回退方案：基础的假期判断（不考虑调休）
   * 当 holiday-calendar 数据不可用时使用
   */
  private fallbackIsHoliday(date: string | Date): boolean {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    const dayOfWeek = dateObj.getDay()
    // 周六日为假期
    return dayOfWeek === 0 || dayOfWeek === 6
  }
}

/**
 * 创建默认的工作日检查器实例（单例模式）
 */
let defaultChecker: WorkdayChecker | null = null

/**
 * 获取默认的工作日检查器（单例模式）
 */
export function getWorkdayChecker(): WorkdayChecker {
  if (!defaultChecker) {
    defaultChecker = new WorkdayChecker()
  }
  return defaultChecker
}

/**
 * 便捷方法：判断是否为工作日
 */
export async function isWorkday(date: string | Date): Promise<boolean> {
  const checker = getWorkdayChecker()
  return checker.isWorkday(date)
}

/**
 * 便捷方法：判断是否为假期
 */
export async function isHoliday(date: string | Date): Promise<boolean> {
  const checker = getWorkdayChecker()
  return checker.isHoliday(date)
}

