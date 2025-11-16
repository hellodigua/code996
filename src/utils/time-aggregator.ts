import { TimeCount } from '../types/git-types'

/**
 * 时间数据聚合工具
 * 用于将半小时粒度（48点）数据聚合为小时粒度（24点）
 */
export class TimeAggregator {
  /**
   * 将48个半小时点聚合为24个小时点
   * @param halfHourData 半小时粒度数据（48点）
   * @returns 小时粒度数据（24点）
   */
  static aggregateToHour(halfHourData: TimeCount[]): TimeCount[] {
    const hourMap = new Map<string, number>()

    // 初始化24小时
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0')
      hourMap.set(hour, 0)
    }

    // 聚合半小时数据
    for (const item of halfHourData) {
      // 提取小时部分：'09:30' -> '09', '09:00' -> '09'
      const hourMatch = item.time.match(/^(\d{2})/)
      if (hourMatch) {
        const hour = hourMatch[1]
        const currentCount = hourMap.get(hour) || 0
        hourMap.set(hour, currentCount + item.count)
      }
    }

    // 转为数组
    const result: TimeCount[] = []
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0')
      result.push({
        time: hour,
        count: hourMap.get(hour) || 0,
      })
    }

    return result
  }

  /**
   * 检测数据粒度
   * @param data 时间数据
   * @returns 'half-hour' 或 'hour'
   */
  static detectGranularity(data: TimeCount[]): 'half-hour' | 'hour' {
    if (data.length === 48) {
      return 'half-hour'
    }
    if (data.length === 24) {
      return 'hour'
    }
    // 通过检查是否包含冒号来判断
    const hasColon = data.some((item) => item.time.includes(':'))
    return hasColon ? 'half-hour' : 'hour'
  }
}
