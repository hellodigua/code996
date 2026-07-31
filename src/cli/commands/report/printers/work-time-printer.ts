import chalk from 'chalk'
import { ParsedGitData } from '../../../../types/git-types'
import { getTerminalWidth, createAdaptiveTable } from '../../../../utils/terminal'
import { formatStartClock, formatEndClock, formatObservedEndClock } from '../../../../utils/formatter'
import { t } from '../../../../i18n'

/**
 * 工作时间打印器
 * 负责打印工作时间推测和相关说明
 */

/** 打印上班与下班时间的推测信息 */
export function printWorkTimeSummary(parsedData: ParsedGitData): void {
  const detection = parsedData.detectedWorkTime
  if (!detection) {
    console.log(chalk.cyan.bold(`⌛ ${t('workTime.title')}`))
    console.log(t('workTime.none'))
    console.log()
    return
  }

  const titleSuffix =
    detection.detectionMethod === 'manual' ? chalk.gray(t('workTime.manual')) : chalk.gray(t('workTime.auto'))
  console.log(chalk.cyan.bold(`⌛ ${t('workTime.title')}`) + ' ' + titleSuffix)

  const startClock = formatStartClock(detection)
  const endClock = formatEndClock(detection)

  const terminalWidth = Math.min(getTerminalWidth(), 80)
  const workTimeTable = createAdaptiveTable(terminalWidth, 'core')

  workTimeTable.push(
    [
      { content: chalk.bold(t('workTime.start')), colSpan: 1 },
      { content: startClock, colSpan: 1 },
    ],
    [
      { content: chalk.bold(t('workTime.standardEnd')), colSpan: 1 },
      { content: endClock, colSpan: 1 },
    ],
    [
      { content: chalk.bold(t('workTime.observedEnd')), colSpan: 1 },
      { content: formatObservedEndClock(detection), colSpan: 1 },
    ],
    [
      { content: chalk.bold(t('workTime.confidence')), colSpan: 1 },
      {
        content: t('workTime.confidenceValue', {
          confidence: detection.confidence,
          sample: detection.sampleCount >= 0 ? detection.sampleCount : t('workTime.manualSample'),
        }),
        colSpan: 1,
      },
    ]
  )

  console.log(workTimeTable.toString())
  console.log()

  if (!detection.isReliable) {
    console.log(chalk.yellow(`⚠️  ${t('workTime.lowConfidence')}`))
    console.log()
  }
}
