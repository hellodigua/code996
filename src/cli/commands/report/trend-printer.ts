import chalk from 'chalk'
import { TrendAnalysisResult, MonthlyTrendData } from '../../../types/git-types'
import { getTerminalWidth, createAdaptiveTable, calculateTrendTableWidths } from '../../../utils/terminal'
import { getIndexColor } from '../../../utils/formatter'

/**
 * 打印月度趋势分析报告
 */
export function printTrendReport(result: TrendAnalysisResult): void {
  console.log()
  console.log(chalk.blue.bold('📈 月度趋势分析报告'))
  console.log()

  // 打印时间范围
  console.log(chalk.gray(`分析时段: ${result.timeRange.since} 至 ${result.timeRange.until}`))
  console.log(chalk.gray(`总计月份: ${result.summary.totalMonths} 个月`))
  console.log()

  // 打印月度数据表格
  printMonthlyTable(result.monthlyData)

  // 打印趋势摘要
  printTrendSummary(result)

  // 打印数据说明
  printDataQualityLegend()
}

/**
 * 打印月度数据表格
 */
function printMonthlyTable(monthlyData: MonthlyTrendData[]): void {
  const terminalWidth = Math.min(getTerminalWidth(), 120)
  // 根据终端宽度动态计算7列表格的列宽，避免窄终端溢出
  const adaptiveColWidths = calculateTrendTableWidths(terminalWidth)
  const table = createAdaptiveTable(terminalWidth, 'stats', {}, adaptiveColWidths)

  // 表头
  table.push([
    { content: chalk.bold('月份'), hAlign: 'center' },
    { content: chalk.bold('996指数'), hAlign: 'center' },
    { content: chalk.bold('平均工时'), hAlign: 'center' },
    { content: chalk.bold('稳定性'), hAlign: 'center' },
    { content: chalk.bold('最晚下班'), hAlign: 'center' },
    { content: chalk.bold('提交数'), hAlign: 'center' },
    { content: chalk.bold('工作天数'), hAlign: 'center' },
  ])

  // 数据行
  for (const data of monthlyData) {
    const indexColor = getIndexColor(data.index996)
    const qualityMark = getQualityMark(data.dataQuality)

    // 格式化数据
    const index996Text = data.totalCommits > 0 ? data.index996.toFixed(1) : '--'
    const avgWorkSpanText = data.totalCommits > 0 ? `${data.avgWorkSpan.toFixed(1)}h` : '--'
    const stdDevText = data.totalCommits > 0 ? `±${data.workSpanStdDev.toFixed(1)}h` : '--'
    const latestEndTimeText = data.latestEndTime
    const totalCommitsText = data.totalCommits.toString()
    const workDaysText = `${data.workDays}天${qualityMark}`

    table.push([
      { content: data.month, hAlign: 'center' },
      { content: indexColor(index996Text), hAlign: 'center' },
      { content: avgWorkSpanText, hAlign: 'center' },
      { content: chalk.gray(stdDevText), hAlign: 'center' },
      { content: chalk.yellow(latestEndTimeText), hAlign: 'center' },
      { content: totalCommitsText, hAlign: 'center' },
      { content: workDaysText, hAlign: 'center' },
    ])
  }

  console.log(table.toString())
  console.log()
}

/**
 * 打印趋势摘要
 */
function printTrendSummary(result: TrendAnalysisResult): void {
  console.log(chalk.blue('📊 整体趋势:'))
  console.log()

  const terminalWidth = Math.min(getTerminalWidth(), 80)
  const summaryTable = createAdaptiveTable(terminalWidth, 'core')

  const avgIndexColor = getIndexColor(result.summary.avgIndex996)
  const trendText = getTrendText(result.summary.trend)
  const trendColor = getTrendColor(result.summary.trend)

  summaryTable.push(
    [
      { content: chalk.bold('平均996指数'), colSpan: 1 },
      { content: avgIndexColor(result.summary.avgIndex996.toFixed(1)), colSpan: 1 },
    ],
    [
      { content: chalk.bold('平均工作时长'), colSpan: 1 },
      { content: `${result.summary.avgWorkSpan.toFixed(1)} 小时`, colSpan: 1 },
    ],
    [
      { content: chalk.bold('趋势方向'), colSpan: 1 },
      { content: trendColor(trendText), colSpan: 1 },
    ]
  )

  console.log(summaryTable.toString())
  console.log()
}

/**
 * 打印数据质量说明
 */
function printDataQualityLegend(): void {
  console.log(chalk.gray('数据质量标记:'))
  console.log(chalk.gray('  ✓ 数据充足 (≥10天) | ⚠ 数据有限 (5-9天) | ✗ 数据不足 (<5天)'))
  console.log()
}

/**
 * 获取数据质量标记
 */
function getQualityMark(quality: 'sufficient' | 'limited' | 'insufficient'): string {
  switch (quality) {
    case 'sufficient':
      return chalk.green(' ✓')
    case 'limited':
      return chalk.yellow(' ⚠')
    case 'insufficient':
      return chalk.red(' ✗')
  }
}

/**
 * 获取趋势文本
 */
function getTrendText(trend: 'increasing' | 'decreasing' | 'stable'): string {
  switch (trend) {
    case 'increasing':
      return '📈 加班趋势上升'
    case 'decreasing':
      return '📉 加班趋势下降'
    case 'stable':
      return '📊 保持稳定'
  }
}

/**
 * 获取趋势颜色
 */
function getTrendColor(trend: 'increasing' | 'decreasing' | 'stable'): (text: string) => string {
  switch (trend) {
    case 'increasing':
      return (text: string) => chalk.red(text)
    case 'decreasing':
      return (text: string) => chalk.green(text)
    case 'stable':
      return (text: string) => chalk.blue(text)
  }
}
