import { GitCollector } from '../git/git-collector'
import { GitParser } from '../git/git-parser'
import { calculate996Index } from './calculator'
import { WorkSpanCalculator } from './work-span-calculator'
import {
  TrendAnalysisResult,
  MonthlyTrendData,
  DailyWorkSpan,
  DailyFirstCommit,
  DailyLatestCommit,
} from '../types/git-types'

/**
 * 趋势分析器
 * 按月分析 996 指数和工作时间的变化趋势
 */
export class TrendAnalyzer {
  /**
   * 分析指定时间范围内的月度趋势
   * @param path Git 仓库路径
   * @param since 开始日期 (YYYY-MM-DD)
   * @param until 结束日期 (YYYY-MM-DD)
   * @param authorPattern 作者过滤正则（仅统计指定作者）
   * @param progressCallback 进度回调函数 (当前月份, 总月数, 月份名称)
   * @returns 趋势分析结果
   */
  static async analyzeTrend(
    path: string,
    since: string | null,
    until: string | null,
    authorPattern?: string,
    progressCallback?: (current: number, total: number, month: string) => void
  ): Promise<TrendAnalysisResult> {
    const collector = new GitCollector()

    // 如果时间范围为空，自动获取
    if (!since || !until) {
      const firstCommit = await collector.getFirstCommitDate({ path })
      const lastCommit = await collector.getLastCommitDate({ path })
      since = since || firstCommit
      until = until || lastCommit
    }

    // 生成月份列表
    const months = this.generateMonthsList(since, until)

    // 串行分析每个月的数据（以便显示进度）
    const monthlyData: (MonthlyTrendData | null)[] = []
    for (let i = 0; i < months.length; i++) {
      if (progressCallback) {
        progressCallback(i + 1, months.length, months[i])
      }
      const data = await this.analyzeMonth(collector, path, months[i], authorPattern)
      monthlyData.push(data)
    }

    // 过滤掉数据不足的月份（可选，这里保留所有月份）
    const validMonthlyData = monthlyData.filter((data) => data !== null) as MonthlyTrendData[]

    // 计算整体趋势
    const summary = this.calculateSummary(validMonthlyData)

    return {
      monthlyData: validMonthlyData,
      timeRange: { since, until },
      summary,
    }
  }

  /**
   * 分析单个月份的数据
   * @param authorPattern 作者过滤正则
   */
  private static async analyzeMonth(
    collector: GitCollector,
    path: string,
    month: string,
    authorPattern?: string
  ): Promise<MonthlyTrendData | null> {
    try {
      // 计算该月的起止日期
      const { since, until } = this.getMonthRange(month)

      // 收集该月的 Git 数据（静默模式，不打印日志）
      const gitLogData = await collector.collect({ path, since, until, silent: true, authorPattern })

      // 如果该月没有提交，返回空数据
      if (gitLogData.totalCommits === 0) {
        return {
          month,
          index996: 0,
          avgWorkSpan: 0,
          workSpanStdDev: 0,
          avgStartTime: '--:--',
          avgEndTime: '--:--',
          latestEndTime: '--:--',
          totalCommits: 0,
          contributors: 0,
          workDays: 0,
          dataQuality: 'insufficient',
          confidence: 'low',
        }
      }

      // 解析数据并计算 996 指数
      const parsedData = GitParser.parseGitData(gitLogData, undefined, since, until)
      const result996 = calculate996Index({
        workHourPl: parsedData.workHourPl,
        workWeekPl: parsedData.workWeekPl,
        hourData: parsedData.hourData,
      })

      // 计算工作跨度指标
      const dailySpans = this.calculateWorkSpansFromData(
        gitLogData.dailyFirstCommits || [],
        gitLogData.dailyLatestCommits || []
      )

      const avgWorkSpan = WorkSpanCalculator.calculateAverage(dailySpans)
      const workSpanStdDev = WorkSpanCalculator.calculateStdDev(dailySpans)
      const avgStartTime = WorkSpanCalculator.getAverageStartTime(dailySpans)
      const avgEndTime = WorkSpanCalculator.getAverageEndTime(dailySpans)
      const latestEndTime = WorkSpanCalculator.getLatestEndTime(dailySpans)

      // 判断数据质量
      const workDays = dailySpans.length
      const dataQuality = workDays >= 10 ? 'sufficient' : workDays >= 5 ? 'limited' : 'insufficient'

      // 计算置信度：综合提交数和工作天数
      const confidence = this.calculateConfidence(gitLogData.totalCommits, workDays)

      return {
        month,
        index996: result996.index996,
        avgWorkSpan,
        workSpanStdDev,
        avgStartTime,
        avgEndTime,
        latestEndTime,
        totalCommits: gitLogData.totalCommits,
        contributors: gitLogData.contributors || 0,
        workDays,
        dataQuality,
        confidence,
      }
    } catch (error) {
      console.error(`分析月份 ${month} 时出错:`, error)
      return null
    }
  }

  /**
   * 从每日首次和最后提交数据计算工作跨度
   */
  private static calculateWorkSpansFromData(
    dailyFirstCommits: DailyFirstCommit[],
    dailyLatestCommits: DailyLatestCommit[]
  ): DailyWorkSpan[] {
    const spans: DailyWorkSpan[] = []

    // 创建最晚提交的映射表（现在直接存储分钟数）
    const latestCommitMap = new Map<string, number>()
    for (const commit of dailyLatestCommits) {
      latestCommitMap.set(commit.date, commit.minutesFromMidnight)
    }

    // 遍历每日首次提交，计算工作跨度
    for (const firstCommit of dailyFirstCommits) {
      const lastCommitMinutes = latestCommitMap.get(firstCommit.date)
      if (lastCommitMinutes === undefined) continue

      const firstCommitMinutes = firstCommit.minutesFromMidnight

      const spanHours = (lastCommitMinutes - firstCommitMinutes) / 60

      // 过滤异常数据（工作跨度不应为负或超过 24 小时）
      if (spanHours >= 0 && spanHours <= 24) {
        spans.push({
          date: firstCommit.date,
          firstCommitMinutes,
          lastCommitMinutes,
          spanHours,
          commitCount: 1, // 这里简化处理，实际可以从其他数据源获取
        })
      }
    }

    return spans
  }

  /**
   * 生成月份列表
   * @param since 开始日期 (YYYY-MM-DD)
   * @param until 结束日期 (YYYY-MM-DD)
   * @returns 月份列表 (YYYY-MM)
   */
  private static generateMonthsList(since: string, until: string): string[] {
    const months: string[] = []
    const startDate = new Date(since)
    const endDate = new Date(until)

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (current <= endDate) {
      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      months.push(`${year}-${month}`)

      // 移动到下个月
      current.setMonth(current.getMonth() + 1)
    }

    return months
  }

  /**
   * 获取月份的起止日期
   * @param month 月份 (YYYY-MM)
   * @returns 起止日期
   */
  private static getMonthRange(month: string): { since: string; until: string } {
    const [year, monthNum] = month.split('-').map(Number)

    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0) // 当月最后一天

    const since = this.formatDate(startDate)
    const until = this.formatDate(endDate)

    return { since, until }
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
   * 计算整体趋势摘要
   */
  private static calculateSummary(monthlyData: MonthlyTrendData[]): TrendAnalysisResult['summary'] {
    if (monthlyData.length === 0) {
      return {
        totalMonths: 0,
        avgIndex996: 0,
        avgWorkSpan: 0,
        trend: 'stable',
      }
    }

    // 只统计数据充足的月份
    const validData = monthlyData.filter((d) => d.dataQuality === 'sufficient')

    if (validData.length === 0) {
      return {
        totalMonths: monthlyData.length,
        avgIndex996: 0,
        avgWorkSpan: 0,
        trend: 'stable',
      }
    }

    const totalMonths = validData.length
    const avgIndex996 = validData.reduce((sum, d) => sum + d.index996, 0) / totalMonths
    const avgWorkSpan = validData.reduce((sum, d) => sum + d.avgWorkSpan, 0) / totalMonths

    // 简单的趋势判断：比较前半段和后半段的平均值
    const trend = this.determineTrend(validData)

    return {
      totalMonths,
      avgIndex996,
      avgWorkSpan,
      trend,
    }
  }

  /**
   * 判断整体趋势
   */
  private static determineTrend(data: MonthlyTrendData[]): 'increasing' | 'decreasing' | 'stable' {
    if (data.length < 2) return 'stable'

    const midPoint = Math.floor(data.length / 2)
    const firstHalf = data.slice(0, midPoint)
    const secondHalf = data.slice(midPoint)

    const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.index996, 0) / firstHalf.length
    const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.index996, 0) / secondHalf.length

    const diff = secondHalfAvg - firstHalfAvg

    if (Math.abs(diff) < 10) return 'stable' // 差异小于 10 认为稳定
    return diff > 0 ? 'increasing' : 'decreasing'
  }

  /**
   * 计算置信度等级
   * 综合考虑提交数和工作天数两个维度
   */
  private static calculateConfidence(commits: number, workDays: number): 'high' | 'medium' | 'low' {
    // 高可信：提交数≥100 且 工作天数≥10
    if (commits >= 100 && workDays >= 10) {
      return 'high'
    }

    // 中可信：提交数≥50 或 工作天数≥5
    if (commits >= 50 || workDays >= 5) {
      return 'medium'
    }

    // 低可信：提交数<50 且 工作天数<5
    return 'low'
  }
}
