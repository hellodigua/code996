import chalk from 'chalk'
import { GitLogData, Result996, AnalyzeOptions } from '../../../../types/git-types'
import { getTerminalWidth, createAdaptiveTable } from '../../../../utils/terminal'
import { getIndexColor } from '../../../../utils/formatter'

export type TimeRangeMode = 'all-time' | 'custom' | 'auto-last-commit' | 'fallback'

/**
 * 核心结果打印器
 * 负责打印996指数、加班比例、总提交数等核心指标
 */

/** 打印核心指标（整合统计信息，统一表格展示） */
export function printCoreResults(
  result: Result996,
  rawData: GitLogData,
  options: AnalyzeOptions,
  since?: string,
  until?: string,
  rangeMode: TimeRangeMode = 'custom'
): void {
  console.log(chalk.blue('📊 核心结果:'))
  console.log()

  const terminalWidth = Math.min(getTerminalWidth(), 80)
  const resultTable = createAdaptiveTable(terminalWidth, 'core')

  const indexColor = getIndexColor(result.index996)
  const radioColor = result.overTimeRadio > 0 ? chalk.red : chalk.green

  // 构建时间范围文本
  let periodText = ''
  if (options.since && options.until) {
    periodText = `${options.since} 至 ${options.until}`
  } else if (options.since) {
    periodText = `从 ${options.since} 开始`
  } else if (options.until) {
    periodText = `截至 ${options.until}`
  } else if (options.allTime) {
    periodText = '所有时间'
  } else if (rangeMode === 'auto-last-commit' && since && until) {
    periodText = `${since} 至 ${until}（按最后一次提交回溯365天）`
  } else if (rangeMode === 'fallback' && since && until) {
    periodText = `${since} 至 ${until}（按当前日期回溯365天）`
  } else if (since && until) {
    periodText = `${since} 至 ${until}`
  } else {
    periodText = '最近一年'
  }

  resultTable.push(
    [
      { content: chalk.bold('996指数'), colSpan: 1 },
      { content: indexColor(result.index996.toFixed(1)), colSpan: 1 },
    ],
    [
      { content: chalk.bold('整体评价'), colSpan: 1 },
      { content: result.index996Str, colSpan: 1 },
    ],
    [
      { content: chalk.bold('分析时段'), colSpan: 1 },
      { content: periodText, colSpan: 1 },
    ],
    [
      { content: chalk.bold('加班比例'), colSpan: 1 },
      { content: radioColor(`${result.overTimeRadio.toFixed(1)}%`), colSpan: 1 },
    ],
    [
      { content: chalk.bold('总提交数'), colSpan: 1 },
      { content: `${rawData.totalCommits}`, colSpan: 1 },
    ]
  )

  console.log(resultTable.toString())
  console.log()

  // 在核心结果表格下方添加996指数说明
  console.log(chalk.gray('* 996指数：为 0 则不加班，值越大代表加班越严重，996 工作制对应的值为 100。'))
  console.log()
}
