import chalk from 'chalk'
import { TrendAnalysisResult, MonthlyTrendData } from '../../../types/git-types'
import { getTerminalWidth, createAdaptiveTable, calculateTrendTableWidths } from '../../../utils/terminal'
import { getIndexColor } from '../../../utils/formatter'
import { t } from '../../../i18n'

/**
 * 打印月度趋势分析报告
 */
export function printTrendReport(result: TrendAnalysisResult): void {
  console.log()
  console.log(chalk.cyan.bold(`📈 ${t('trend.title')}`))
  console.log()

  // 打印时间范围
  console.log(chalk.gray(t('trend.period', { since: result.timeRange.since, until: result.timeRange.until })))
  console.log(chalk.gray(t('trend.totalMonths', { count: result.summary.totalMonths })))
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
  // 根据终端宽度动态计算10列表格的列宽，避免窄终端溢出
  const adaptiveColWidths = calculateTrendTableWidths(terminalWidth)
  const table = createAdaptiveTable(terminalWidth, 'stats', {}, adaptiveColWidths)

  // 表头（支持两行显示）
  table.push([
    { content: chalk.bold(t('trend.table.month')), hAlign: 'center' },
    { content: chalk.bold(t('trend.table.index')), hAlign: 'center' },
    { content: chalk.bold(t('trend.table.avgWorkSpan')), hAlign: 'center' },
    { content: chalk.bold(t('trend.table.avgStart')), hAlign: 'center' },
    { content: chalk.bold(t('trend.table.avgEnd')), hAlign: 'center' },
    { content: chalk.bold(t('trend.table.latestEnd')), hAlign: 'center' },
    { content: chalk.bold(t('trend.table.commits')), hAlign: 'center' },
    { content: chalk.bold(t('trend.table.contributors')), hAlign: 'center' },
    { content: chalk.bold(t('trend.table.workDays')), hAlign: 'center' },
    { content: chalk.bold(t('trend.table.confidence')), hAlign: 'center' },
  ])

  // 数据行
  for (const data of monthlyData) {
    const indexColor = getIndexColor(data.index996)
    const confidenceMark = getConfidenceMark(data.confidence)

    // 格式化数据
    const index996Text = data.totalCommits > 0 ? data.index996.toFixed(1) : '--'
    const avgWorkSpanText = data.totalCommits > 0 ? `${data.avgWorkSpan.toFixed(1)}h` : '--'
    const avgStartTimeText = data.avgStartTime
    const avgEndTimeText = data.avgEndTime
    const latestEndTimeText = data.latestEndTime
    const totalCommitsText = data.totalCommits.toString()
    const contributorsText = data.contributors.toString()
    const workDaysText = `${data.workDays}`

    table.push([
      { content: data.month, hAlign: 'center' },
      { content: indexColor(index996Text), hAlign: 'center' },
      { content: avgWorkSpanText, hAlign: 'center' },
      { content: chalk.green(avgStartTimeText), hAlign: 'center' },
      { content: chalk.cyan(avgEndTimeText), hAlign: 'center' },
      { content: chalk.yellow(latestEndTimeText), hAlign: 'center' },
      { content: totalCommitsText, hAlign: 'center' },
      { content: chalk.magenta(contributorsText), hAlign: 'center' },
      { content: workDaysText, hAlign: 'center' },
      { content: confidenceMark, hAlign: 'center' },
    ])
  }

  console.log(table.toString())
  console.log()
}

/**
 * 打印趋势摘要
 */
function printTrendSummary(result: TrendAnalysisResult): void {
  console.log(chalk.cyan.bold(`📊 ${t('trend.summary.title')}`))
  console.log()

  const terminalWidth = Math.min(getTerminalWidth(), 80)
  const summaryTable = createAdaptiveTable(terminalWidth, 'core')

  const avgIndexColor = getIndexColor(result.summary.avgIndex996)
  const trendText = getTrendText(result.summary.trend)
  const trendColor = getTrendColor(result.summary.trend)

  summaryTable.push(
    [
      { content: chalk.bold(t('trend.summary.avgIndex')), colSpan: 1 },
      { content: avgIndexColor(result.summary.avgIndex996.toFixed(1)), colSpan: 1 },
    ],
    [
      { content: chalk.bold(t('trend.summary.avgWorkSpan')), colSpan: 1 },
      { content: t('trend.summary.hours', { hours: result.summary.avgWorkSpan.toFixed(1) }), colSpan: 1 },
    ],
    [
      { content: chalk.bold(t('trend.summary.direction')), colSpan: 1 },
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
  console.log(chalk.gray(t('trend.legend.title')))
  console.log(chalk.gray(t('trend.legend.content')))
  console.log()
}

/**
 * 获取置信度标记
 */
function getConfidenceMark(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return chalk.green('✓✓')
    case 'medium':
      return chalk.yellow('✓')
    case 'low':
      return chalk.red('✗')
  }
}

/**
 * 获取趋势文本
 */
function getTrendText(trend: 'increasing' | 'decreasing' | 'stable'): string {
  switch (trend) {
    case 'increasing':
      return `📈 ${t('trend.direction.increasing')}`
    case 'decreasing':
      return `📉 ${t('trend.direction.decreasing')}`
    case 'stable':
      return `📊 ${t('trend.direction.stable')}`
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
