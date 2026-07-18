import chalk from 'chalk'
import { ParsedGitData } from '../../../../types/git-types'
import { t, tWeekday } from '../../../../i18n'

/**
 * 加班分析打印器
 * 负责打印工作日加班、周末加班和深夜加班分析
 */

/** 打印工作日加班分布 */
export function printWeekdayOvertime(parsedData: ParsedGitData): void {
  if (!parsedData.weekdayOvertime) {
    return
  }

  console.log(chalk.cyan.bold(`💼 ${t('overtime.weekday.title')}`))
  console.log()

  const overtime = parsedData.weekdayOvertime
  const weekdays = [
    { name: tWeekday('monday'), key: 'monday' as const },
    { name: tWeekday('tuesday'), key: 'tuesday' as const },
    { name: tWeekday('wednesday'), key: 'wednesday' as const },
    { name: tWeekday('thursday'), key: 'thursday' as const },
    { name: tWeekday('friday'), key: 'friday' as const },
  ]

  // 找出最大值用于计算条形图长度
  const maxCount = Math.max(overtime.monday, overtime.tuesday, overtime.wednesday, overtime.thursday, overtime.friday)

  if (maxCount === 0) {
    console.log(t('overtime.weekday.none'))
    console.log()
    return
  }

  const barLength = 20

  // 计算加班高峰阈值（最大值的90%）
  const peakThreshold = maxCount * 0.9

  weekdays.forEach(({ name, key }) => {
    const count = overtime[key]
    const percentage = maxCount > 0 ? (count / maxCount) * barLength : 0
    const filledLength = Math.min(barLength, Math.max(0, Math.round(percentage)))
    const bar = '█'.repeat(filledLength) + ' '.repeat(barLength - filledLength)
    const countText = count.toString().padStart(3)

    // 如果加班次数 >= 90% 的最大值，标注为加班高峰
    const isPeak = count >= peakThreshold && count > 0
    const peakLabel = isPeak ? chalk.red(` ⚠️${t('overtime.weekday.peak')}`) : ''

    console.log(`${name}: ${bar} ${t('overtime.weekday.count', { count: countText.trim() })}${peakLabel}`)
  })

  console.log()
}

/** 打印周末加班分布 */
export function printWeekendOvertime(parsedData: ParsedGitData): void {
  if (!parsedData.weekendOvertime) {
    return
  }

  const weekend = parsedData.weekendOvertime
  const totalDays = weekend.saturdayDays + weekend.sundayDays

  // 如果没有周末工作，不显示
  if (totalDays === 0) {
    return
  }

  console.log(chalk.cyan.bold(`📅 ${t('overtime.weekend.title')}`))
  console.log()

  const weekendDays = [
    { name: tWeekday('saturday'), count: weekend.saturdayDays },
    { name: tWeekday('sunday'), count: weekend.sundayDays },
  ]

  const barLength = 20
  const maxCount = Math.max(weekend.saturdayDays, weekend.sundayDays)

  weekendDays.forEach(({ name, count }) => {
    if (count === 0) return

    const percentage = maxCount > 0 ? (count / maxCount) * barLength : 0
    const filledLength = Math.min(barLength, Math.max(0, Math.round(percentage)))
    const bar = '█'.repeat(filledLength) + ' '.repeat(barLength - filledLength)
    const countText = count.toString().padStart(3)
    const percentOfTotal = totalDays > 0 ? ((count / totalDays) * 100).toFixed(1) : '0.0'

    console.log(
      `${name}: ${bar} ${t('overtime.weekend.dayCount', { count: countText.trim(), percent: percentOfTotal })}`
    )
  })

  console.log()

  // 显示加班类型分布
  const totalWorkDays = weekend.realOvertimeDays + weekend.casualFixDays
  const realOvertimeColor =
    weekend.realOvertimeDays > 15 ? chalk.red : weekend.realOvertimeDays > 8 ? chalk.yellow : chalk.green

  console.log(t('overtime.weekend.type'))
  console.log(
    `  ${t('overtime.weekend.real', {
      count: realOvertimeColor(chalk.bold(weekend.realOvertimeDays.toString())),
    })}`
  )
  console.log(
    `  ${t('overtime.weekend.casual', {
      count: chalk.gray(weekend.casualFixDays.toString()),
    })}`
  )
  console.log(
    `  ${t('overtime.weekend.ratio', {
      ratio: realOvertimeColor(((weekend.realOvertimeDays / totalWorkDays) * 100).toFixed(1) + '%'),
    })}`
  )
  console.log()
}

/** 打印深夜加班分析 */
export function printLateNightAnalysis(parsedData: ParsedGitData): void {
  if (!parsedData.lateNightAnalysis) {
    return
  }

  console.log(chalk.cyan.bold(`🌙 ${t('overtime.lateNight.title')}`))
  console.log()

  const analysis = parsedData.lateNightAnalysis
  const endHour = parsedData.detectedWorkTime?.endHour || 18

  // 计算最大值用于条形图
  const maxCount = Math.max(analysis.evening, analysis.lateNight, analysis.midnight, analysis.dawn)

  if (maxCount === 0) {
    console.log(t('overtime.lateNight.none'))
    console.log()
    return
  }

  const barLength = 20

  const timeRanges = [
    {
      label: `${Math.ceil(endHour).toString().padStart(2, '0')}:00-21:00`,
      count: analysis.evening,
      description: t('overtime.lateNight.evening'),
      isWarning: false,
    },
    {
      label: '21:00-23:00',
      count: analysis.lateNight,
      description: t('overtime.lateNight.late'),
      isWarning: false,
    },
    {
      label: '23:00-02:00',
      count: analysis.midnight,
      description: t('overtime.lateNight.midnight'),
      isWarning: analysis.midnight > 0,
    },
    {
      label: '02:00-06:00',
      count: analysis.dawn,
      description: t('overtime.lateNight.dawn'),
      isWarning: analysis.dawn > 0,
    },
  ]

  timeRanges.forEach(({ label, count, description, isWarning }) => {
    if (count === 0) return

    const percentage = maxCount > 0 ? (count / maxCount) * barLength : 0
    const filledLength = Math.min(barLength, Math.max(0, Math.round(percentage)))
    const bar = '█'.repeat(filledLength) + ' '.repeat(barLength - filledLength)
    const countText = count.toString().padStart(3)
    const warningLabel = isWarning ? chalk.red(' ⚠️') : ''

    // 计算该时段的频率（这里的count是天数，不是提交数）
    const weeklyAvg = (count / analysis.totalWeeks).toFixed(1)
    const monthlyAvg = (count / analysis.totalMonths).toFixed(1)
    const freqText = chalk.gray(t('overtime.lateNight.avg', { weekly: weeklyAvg, monthly: monthlyAvg }))

    console.log(`${label}: ${bar} ${countText} (${description})${warningLabel}${freqText}`)
  })

  console.log()

  // 显示深夜加班天数和占比
  if (analysis.midnightDays > 0) {
    const rateColor = analysis.midnightRate > 10 ? chalk.red : analysis.midnightRate > 5 ? chalk.yellow : chalk.green
    console.log(
      t('overtime.lateNight.days', {
        days: chalk.bold(analysis.midnightDays.toString()),
        total: analysis.totalWorkDays,
        rate: rateColor(analysis.midnightRate.toFixed(1) + '%'),
      })
    )
    console.log()
  }
}
