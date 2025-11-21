/**
 * holiday-calendar 模块的类型声明
 */
declare module 'holiday-calendar' {
  class HolidayCalendar {
    constructor()

    /**
     * 判断某个日期是否为工作日
     * @param region 地区代码 (例如: 'CN', 'JP')
     * @param date 日期字符串 (YYYY-MM-DD)
     * @returns 是否为工作日
     */
    isWorkday(region: string, date: string): Promise<boolean>

    /**
     * 判断某个日期是否为假期
     * @param region 地区代码 (例如: 'CN', 'JP')
     * @param date 日期字符串 (YYYY-MM-DD)
     * @returns 是否为假期
     */
    isHoliday(region: string, date: string): Promise<boolean>

    /**
     * 获取指定地区和年份的所有日期信息
     * @param region 地区代码
     * @param year 年份
     * @returns 日期信息数组
     */
    getDates(
      region: string,
      year: number,
      filters?: {
        type?: 'public_holiday' | 'transfer_workday'
        startDate?: string
        endDate?: string
      }
    ): Promise<Array<{ date: string; name: string; name_cn: string; name_en: string; type: string }>>

    /**
     * 获取索引信息
     * @returns 索引信息
     */
    getIndex(): Promise<{ regions: Array<{ name: string; startYear: number; endYear: number }> }>
  }

  export default HolidayCalendar
}

