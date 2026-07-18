import chalk from 'chalk'
import { ParsedGitData } from '../../../../types/git-types'
import { getTerminalWidth, createAdaptiveTable } from '../../../../utils/terminal'
import { formatStartClock, formatEndClock } from '../../../../utils/formatter'
import { t } from '../../../../i18n'

const MAX_STANDARD_WORK_HOURS = 9

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

  if (detection.detectionMethod === 'manual') {
    // 用户已通过 --hours 指定标准工时，这里直接跳过推测模块以避免重复信息
    printWorkHourCapNotice(detection)
    return
  }

  // 如果置信度低于40%，不显示工作时间推测（但仍然显示加班说明）
  if (detection.confidence < 40) {
    printWorkHourCapNotice(detection)
    return
  }

  // 只在自动推断场景展示该模块，因此固定输出自动提示
  const titleSuffix = chalk.gray(t('workTime.auto'))
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
      { content: chalk.bold(t('workTime.end')), colSpan: 1 },
      { content: endClock, colSpan: 1 },
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

  printWorkHourCapNotice(detection)
}

// 当推测/指定的工作时段超过 9 小时时，告知用户超出的部分已按加班计算
function printWorkHourCapNotice(detection: ParsedGitData['detectedWorkTime']): void {
  if (!detection) {
    return
  }

  const actualSpan = detection.endHour - detection.startHour
  if (actualSpan <= MAX_STANDARD_WORK_HOURS) {
    return
  }

  const spanText = actualSpan.toFixed(1)
  console.log(chalk.yellow(`⚠️  ${t('workTime.capNotice', { hours: spanText })}`))
  console.log()
}
