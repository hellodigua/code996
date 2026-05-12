import chalk from 'chalk'
import { GitLogData, Result996, AnalyzeOptions } from '../../../../types/git-types'
import { getTerminalWidth, createAdaptiveTable } from '../../../../utils/terminal'
import { getIndexColor } from '../../../../utils/formatter'
import { t, tIndexDescription } from '../../../../i18n'

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
  console.log(chalk.cyan.bold(`📊 ${t('core.result.title')}`))
  console.log()

  const terminalWidth = Math.min(getTerminalWidth(), 80)
  const resultTable = createAdaptiveTable(terminalWidth, 'core')

  const indexColor = getIndexColor(result.index996)
  const radioColor = result.overTimeRadio > 0 ? chalk.red : chalk.green

  // 构建时间范围文本
  let periodText = ''
  if (options.since && options.until) {
    periodText = t('core.result.period.custom', { since: options.since, until: options.until })
  } else if (options.since) {
    periodText = t('core.result.period.from', { since: options.since })
  } else if (options.until) {
    periodText = t('core.result.period.until', { until: options.until })
  } else if (options.allTime) {
    periodText = t('core.result.period.all')
  } else if (rangeMode === 'auto-last-commit' && since && until) {
    periodText = t('core.result.period.lastCommit', { since, until })
  } else if (rangeMode === 'fallback' && since && until) {
    periodText = t('core.result.period.current', { since, until })
  } else if (since && until) {
    periodText = t('core.result.period.custom', { since, until })
  } else {
    periodText = t('core.result.period.default')
  }

  resultTable.push(
    [
      { content: chalk.bold(t('core.result.index')), colSpan: 1 },
      { content: indexColor(result.index996.toFixed(1)), colSpan: 1 },
    ],
    [
      { content: chalk.bold(t('core.result.overall')), colSpan: 1 },
      { content: tIndexDescription(result.index996DescriptionKey), colSpan: 1 },
    ],
    [
      { content: chalk.bold(t('core.result.period')), colSpan: 1 },
      { content: periodText, colSpan: 1 },
    ],
    [
      { content: chalk.bold(t('core.result.overtimeRatio')), colSpan: 1 },
      { content: radioColor(`${result.overTimeRadio.toFixed(1)}%`), colSpan: 1 },
    ],
    [
      { content: chalk.bold(t('core.result.totalCommits')), colSpan: 1 },
      { content: `${rawData.totalCommits}`, colSpan: 1 },
    ]
  )

  console.log(resultTable.toString())
  console.log()

  // 在核心结果表格下方添加996指数说明
  console.log(chalk.gray(t('core.result.note')))
  console.log()
}
