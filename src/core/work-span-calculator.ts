import { DailyWorkSpan } from '../types/git-types'

/**
 * 工作跨度计算器
 * 计算每日的工作时间跨度（首次提交到最后提交的时间差）
 */
export class WorkSpanCalculator {
  /**
   * 从提交数据中计算每日工作跨度
   * @param commits 提交数据数组，每个元素包含 timestamp
   * @returns 每日工作跨度数组
   */
  static calculateDailyWorkSpans(commits: Array<{ timestamp: number }>): DailyWorkSpan[] {
    if (!commits || commits.length === 0) {
      return []
    }

    // 按日期分组提交
    const commitsByDate = new Map<string, number[]>() // date -> minutes from midnight

    for (const commit of commits) {
      const date = new Date(commit.timestamp * 1000)
      const dateStr = this.formatDate(date)
      const minutesFromMidnight = date.getHours() * 60 + date.getMinutes()

      if (!commitsByDate.has(dateStr)) {
        commitsByDate.set(dateStr, [])
      }
      commitsByDate.get(dateStr)!.push(minutesFromMidnight)
    }

    // 计算每日工作跨度
    const dailySpans: DailyWorkSpan[] = []

    for (const [date, minutes] of commitsByDate.entries()) {
      if (minutes.length === 0) continue

      // 排序以找到最早和最晚的提交
      minutes.sort((a, b) => a - b)

      const firstCommitMinutes = minutes[0]
      const lastCommitMinutes = minutes[minutes.length - 1]

      // 计算工作跨度（小时）
      const spanMinutes = lastCommitMinutes - firstCommitMinutes
      const spanHours = spanMinutes / 60

      dailySpans.push({
        date,
        firstCommitMinutes,
        lastCommitMinutes,
        spanHours,
        commitCount: minutes.length,
      })
    }

    // 按日期排序
    dailySpans.sort((a, b) => a.date.localeCompare(b.date))

    return dailySpans
  }

  /**
   * 计算工作跨度的平均值
   * @param spans 工作跨度数组
   * @returns 平均工作跨度（小时）
   */
  static calculateAverage(spans: DailyWorkSpan[]): number {
    if (spans.length === 0) return 0

    const total = spans.reduce((sum, span) => sum + span.spanHours, 0)
    return total / spans.length
  }

  /**
   * 计算工作跨度的标准差
   * @param spans 工作跨度数组
   * @returns 标准差（小时）
   */
  static calculateStdDev(spans: DailyWorkSpan[]): number {
    if (spans.length === 0) return 0
    if (spans.length === 1) return 0

    const avg = this.calculateAverage(spans)
    const squaredDiffs = spans.map((span) => Math.pow(span.spanHours - avg, 2))
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / spans.length

    return Math.sqrt(variance)
  }

  /**
   * 获取平均开始工作时间
   * @param spans 工作跨度数组
   * @returns 平均开始工作时间 (HH:mm)
   */
  static getAverageStartTime(spans: DailyWorkSpan[]): string {
    if (spans.length === 0) return '--:--'

    // 使用与 getAverageEndTime 相同的过滤逻辑
    const validSpans = spans.filter((span) => {
      const date = new Date(`${span.date}T00:00:00`)
      const dayOfWeek = date.getDay()

      return (
        dayOfWeek >= 1 &&
        dayOfWeek <= 5 && // 工作日
        span.spanHours >= 4 && // 跨度≥4小时
        span.lastCommitMinutes >= 15 * 60 // 15:00后结束
      )
    })

    const dataToUse = validSpans.length > 0 ? validSpans : spans

    const totalMinutes = dataToUse.reduce((sum, span) => sum + span.firstCommitMinutes, 0)
    const avgMinutes = Math.round(totalMinutes / dataToUse.length)
    return this.formatTime(avgMinutes)
  }

  /**
   * 获取平均结束工作时间
   * @param spans 工作跨度数组
   * @returns 平均结束工作时间 (HH:mm)
   */
  static getAverageEndTime(spans: DailyWorkSpan[]): string {
    if (spans.length === 0) return '--:--'

    // 过滤条件：只统计正常工作日
    const validSpans = spans.filter((span) => {
      const date = new Date(`${span.date}T00:00:00`)
      const dayOfWeek = date.getDay() // 0=Sunday, 6=Saturday

      // 1. 排除周末（周六、周日）
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false
      }

      // 2. 排除工作跨度过短的异常天（<4小时，可能是临时修复或远程单次提交）
      // 正常工作日至少应该工作4小时以上
      if (span.spanHours < 4) {
        return false
      }

      // 3. 排除过早结束的天（15:00之前结束，明显不是正常下班）
      // 正常下班时间至少应该在15:00之后
      if (span.lastCommitMinutes < 15 * 60) {
        return false
      }

      return true
    })

    // 如果过滤后没有有效数据，降级使用所有数据
    const dataToUse = validSpans.length > 0 ? validSpans : spans

    const totalMinutes = dataToUse.reduce((sum, span) => sum + span.lastCommitMinutes, 0)
    const avgMinutes = Math.round(totalMinutes / dataToUse.length)
    return this.formatTime(avgMinutes)
  }

  /**
   * 获取最晚的提交时间
   * @param spans 工作跨度数组
   * @returns 最晚提交时间 (HH:mm)
   */
  static getLatestEndTime(spans: DailyWorkSpan[]): string {
    if (spans.length === 0) return '--:--'

    const latestMinutes = Math.max(...spans.map((span) => span.lastCommitMinutes))
    return this.formatTime(latestMinutes)
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 格式化分钟数为 HH:mm
   * 注意：支持超过24小时的分钟数（用于表示次日凌晨）
   */
  private static formatTime(minutes: number): string {
    // 如果超过24小时，说明是次日凌晨，转换回0-24范围并标注
    let displayMinutes = minutes
    let nextDay = false

    if (minutes >= 24 * 60) {
      displayMinutes = minutes - 24 * 60
      nextDay = true
    }

    const hours = Math.floor(displayMinutes / 60)
    const mins = displayMinutes % 60
    const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`

    // 如果是次日凌晨，添加标记
    return nextDay ? `${timeStr}+1` : timeStr
  }
}
