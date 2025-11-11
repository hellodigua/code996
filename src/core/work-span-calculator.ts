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

      // 跳过没有有效数据的日期
      if (firstCommitMinutes === undefined || lastCommitMinutes === undefined) {
        continue
      }

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
   */
  private static formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }
}

