import chalk from 'chalk'
import { ParsedGitData } from '../../../../types/git-types'

/**
 * 加班分析打印器
 * 负责打印工作日加班、周末加班和深夜加班分析
 */

/** 打印工作日加班分布 */
export function printWeekdayOvertime(parsedData: ParsedGitData): void {
  if (!parsedData.weekdayOvertime) {
    return
  }

  console.log(chalk.cyan.bold('💼 工作日加班分布:'))
  console.log()

  const overtime = parsedData.weekdayOvertime
  const weekdays = [
    { name: '周一', key: 'monday' as const },
    { name: '周二', key: 'tuesday' as const },
    { name: '周三', key: 'wednesday' as const },
    { name: '周四', key: 'thursday' as const },
    { name: '周五', key: 'friday' as const },
  ]

  // 找出最大值用于计算条形图长度
  const maxCount = Math.max(overtime.monday, overtime.tuesday, overtime.wednesday, overtime.thursday, overtime.friday)

  if (maxCount === 0) {
    console.log('暂无工作日加班数据')
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
    const peakLabel = isPeak ? chalk.red(' ⚠️ 加班高峰') : ''

    console.log(`${name}: ${bar} ${countText}次${peakLabel}`)
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

  console.log(chalk.cyan.bold('📅 周末加班分析:'))
  console.log()

  const weekendDays = [
    { name: '周六', count: weekend.saturdayDays },
    { name: '周日', count: weekend.sundayDays },
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

    console.log(`${name}: ${bar} ${countText}天 (${percentOfTotal}%)`)
  })

  console.log()

  // 显示加班类型分布
  const totalWorkDays = weekend.realOvertimeDays + weekend.casualFixDays
  const realOvertimeColor =
    weekend.realOvertimeDays > 15 ? chalk.red : weekend.realOvertimeDays > 8 ? chalk.yellow : chalk.green

  console.log('加班类型:')
  console.log(
    `  真正加班: ${realOvertimeColor(chalk.bold(weekend.realOvertimeDays.toString()))}天 (提交时间跨度>=3小时)`
  )
  console.log(`  临时修复: ${chalk.gray(weekend.casualFixDays.toString())}天 (提交时间跨度<3小时)`)
  console.log(`  加班占比: ${realOvertimeColor(((weekend.realOvertimeDays / totalWorkDays) * 100).toFixed(1) + '%')}`)
  console.log()
}

/** 打印深夜加班分析 */
export function printLateNightAnalysis(parsedData: ParsedGitData): void {
  if (!parsedData.lateNightAnalysis) {
    return
  }

  console.log(chalk.cyan.bold('🌙 深夜加班分析:'))
  console.log()

  const analysis = parsedData.lateNightAnalysis
  const endHour = parsedData.detectedWorkTime?.endHour || 18

  // 计算最大值用于条形图
  const maxCount = Math.max(analysis.evening, analysis.lateNight, analysis.midnight, analysis.dawn)

  if (maxCount === 0) {
    console.log('暂无深夜加班数据')
    console.log()
    return
  }

  const barLength = 20

  const timeRanges = [
    {
      label: `${Math.ceil(endHour).toString().padStart(2, '0')}:00-21:00`,
      count: analysis.evening,
      description: '晚间提交',
      isWarning: false,
    },
    {
      label: '21:00-23:00',
      count: analysis.lateNight,
      description: '加班晚期',
      isWarning: false,
    },
    {
      label: '23:00-02:00',
      count: analysis.midnight,
      description: '深夜加班',
      isWarning: analysis.midnight > 0,
    },
    {
      label: '02:00-06:00',
      count: analysis.dawn,
      description: '凌晨编程',
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
    const freqText = chalk.gray(` 平均每周${weeklyAvg}天 每月${monthlyAvg}天`)

    console.log(`${label}: ${bar} ${countText}天 (${description})${warningLabel}${freqText}`)
  })

  console.log()

  // 显示深夜加班天数和占比
  if (analysis.midnightDays > 0) {
    const rateColor = analysis.midnightRate > 10 ? chalk.red : analysis.midnightRate > 5 ? chalk.yellow : chalk.green
    console.log(
      `深夜/凌晨加班天数: ${chalk.bold(analysis.midnightDays.toString())}天 / ${analysis.totalWorkDays}天工作日 (${rateColor(analysis.midnightRate.toFixed(1) + '%')})`
    )
    console.log()
  }
}
