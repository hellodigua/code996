import chalk from 'chalk'
import { GitLogData, ParsedGitData, Result996 } from '../../../types/git-types'
import { getTerminalWidth, createAdaptiveTable } from '../../../utils/terminal'
import { getIndexColor, formatStartClock, formatEndClock } from '../../../utils/formatter'
import { AnalyzeOptions } from '../../index'

type TimeRangeMode = 'all-time' | 'custom' | 'auto-last-commit' | 'fallback'

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
  
  // 格式化加班率显示（负值友好提示）
  const overtimeDisplay = result.overTimeRadio < 0 
    ? `${chalk.blue('工作不饱和')} ${result.overTimeRadio.toFixed(1)}%`
    : radioColor(`${result.overTimeRadio.toFixed(1)}%`)

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
      { content: overtimeDisplay, colSpan: 1 },
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

/** 打印 24 小时提交分布与星期分布图形 */
export function printTimeDistribution(parsedData: ParsedGitData): void {
  const barLength = 20

  console.log(chalk.blue('🕐 24小时分布:'))

  const maxCount = Math.max(0, ...parsedData.hourData.map((item) => item.count))

  if (maxCount === 0) {
    console.log('暂无提交数据')
    console.log()
  } else {
    parsedData.hourData.forEach((hour) => {
      if (hour.count === 0) {
        return
      }

      const percentage = (hour.count / maxCount) * barLength
      const filledLength = Math.min(barLength, Math.max(1, Math.round(percentage)))
      const bar = '█'.repeat(filledLength) + ' '.repeat(barLength - filledLength)
      const countText = hour.count.toString().padStart(3)
      console.log(`${hour.time}: ${bar} ${countText}`)
    })

    console.log()
  }

  console.log(chalk.blue('📅 星期分布:'))

  const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const maxDayCount = Math.max(0, ...parsedData.dayData.map((item) => item.count))
  const totalDayCount = parsedData.dayData.reduce((sum, item) => sum + item.count, 0)

  if (totalDayCount === 0) {
    console.log('暂无星期提交数据')
    console.log()
    return
  }

  parsedData.dayData.forEach((day) => {
    const dayIndex = parseInt(day.time, 10) - 1 // 1-7 转换为 0-6
    const dayName = weekDayNames[dayIndex] || '未知'
    const percentage = totalDayCount > 0 ? ((day.count / totalDayCount) * 100).toFixed(1) : '0.0'

    if (maxDayCount === 0) {
      console.log(`${dayName}: ${''.padEnd(barLength)} 0 (0.0%)`)
    } else {
      const barPercentage = (day.count / maxDayCount) * barLength
      const filledLength = Math.min(barLength, Math.max(0, Math.round(barPercentage)))
      const bar = '█'.repeat(filledLength) + ' '.repeat(barLength - filledLength)
      const countText = day.count.toString().padStart(3)
      console.log(`${dayName}: ${bar} ${countText} (${percentage}%)`)
    }
  })

  console.log()
}

/** 打印上班与下班时间的推测信息 */
export function printWorkTimeSummary(parsedData: ParsedGitData): void {
  console.log(chalk.blue('⌛ 工作时间推测:'))

  const detection = parsedData.detectedWorkTime
  if (!detection) {
    console.log('暂无可用的工作时间推测数据')
    console.log()
    return
  }

  const startClock = formatStartClock(detection)
  const endClock = formatEndClock(detection)

  const terminalWidth = Math.min(getTerminalWidth(), 80)
  const workTimeTable = createAdaptiveTable(terminalWidth, 'core')

  workTimeTable.push(
    [
      { content: chalk.bold('上班时间'), colSpan: 1 },
      { content: startClock, colSpan: 1 },
    ],
    [
      { content: chalk.bold('下班时间'), colSpan: 1 },
      { content: endClock, colSpan: 1 },
    ],
    [
      { content: chalk.bold('可信度'), colSpan: 1 },
      { content: `${detection.confidence}%（样本天数: ${detection.sampleCount}）`, colSpan: 1 },
    ]
  )

  console.log(workTimeTable.toString())
  console.log()
}

/** 打印工作日加班分布 */
export function printWeekdayOvertime(parsedData: ParsedGitData, options?: AnalyzeOptions): void {
  if (!parsedData.weekdayOvertime) return

  const mode = options?.weekdayOvertimeMode || 'both'
  const overtime = parsedData.weekdayOvertime
  const weekdays = [
    { name: '周一', key: 'monday' as const, dayKey: 'mondayDays' as const },
    { name: '周二', key: 'tuesday' as const, dayKey: 'tuesdayDays' as const },
    { name: '周三', key: 'wednesday' as const, dayKey: 'wednesdayDays' as const },
    { name: '周四', key: 'thursday' as const, dayKey: 'thursdayDays' as const },
    { name: '周五', key: 'friday' as const, dayKey: 'fridayDays' as const },
  ]

  console.log(chalk.blue('💼 工作日加班分布:'))
  console.log()

  const commitMax = Math.max(overtime.monday, overtime.tuesday, overtime.wednesday, overtime.thursday, overtime.friday)
  const dayMax = Math.max(
    overtime.mondayDays || 0,
    overtime.tuesdayDays || 0,
    overtime.wednesdayDays || 0,
    overtime.thursdayDays || 0,
    overtime.fridayDays || 0
  )

  if (commitMax === 0 && dayMax === 0) {
    console.log('暂无工作日加班数据')
    console.log()
    return
  }

  const barLength = 20
  const peakThreshold = commitMax * 0.9

  weekdays.forEach(({ name, key, dayKey }) => {
    const commitCount = overtime[key]
    const dayCount = (overtime as any)[dayKey] || 0

    // 确定用于绘制的主值
    let primaryValue: number
    let primaryMax: number
    let primaryUnit: string
    if (mode === 'days') {
      primaryValue = dayCount
      primaryMax = dayMax || 1
      primaryUnit = '天'
    } else {
      primaryValue = commitCount
      primaryMax = commitMax || 1
      primaryUnit = '次'
    }

    const percentage = primaryMax > 0 ? (primaryValue / primaryMax) * barLength : 0
    const filledLength = Math.min(barLength, Math.max(0, Math.round(percentage)))
    const bar = '█'.repeat(filledLength) + ' '.repeat(barLength - filledLength)
    const primaryText = primaryValue.toString().padStart(3)

    const isPeak = mode !== 'days' && commitCount >= peakThreshold && commitCount > 0
    const peakLabel = isPeak ? chalk.red(' ⚠️ 加班高峰') : ''

    let extra = ''
    if (mode === 'both') {
      extra = ` / 加班天数 ${dayCount}天`
    } else if (mode === 'commits' && dayCount) {
      extra = ` (${dayCount}天)`
    }

    console.log(`${name}: ${bar} ${primaryText}${primaryUnit}${extra}${peakLabel}`)
  })

  if (overtime.totalOvertimeDays !== undefined && mode !== 'commits') {
    console.log()
    console.log(
      chalk.gray(
        `加班天数合计: ${overtime.totalOvertimeDays}天 (存在至少一次下班后提交，判定依据: 最晚提交时间 >= 推测下班时间)`
      )
    )
  }

  // 打印加班严重程度分级（如果有的话）
  if (overtime.severityLevels) {
    const levels = overtime.severityLevels
    console.log()
    console.log(chalk.bold('💀 加班严重程度分级:'))
    console.log()
    
    const severityData = [
      { emoji: '😊', level: '轻度加班', count: levels.light, desc: '下班后2小时内', color: chalk.green },
      { emoji: '😰', level: '中度加班', count: levels.moderate, desc: '下班后2-4小时', color: chalk.yellow },
      { emoji: '😱', level: '重度加班', count: levels.severe, desc: '下班后4-6小时', color: chalk.red },
      { emoji: '💀', level: '极度加班', count: levels.extreme, desc: '下班后6小时以上', color: chalk.bgRed.white },
    ]

    severityData.forEach(({ emoji, level, count, desc, color }) => {
      console.log(`${emoji} ${color(level)}: ${count}天 (${desc})`)
    })

    console.log()
    const total = levels.light + levels.moderate + levels.severe + levels.extreme
    if (levels.extreme > 0) {
      console.log(chalk.bgRed.white(` ⚠️ 警告: 检测到 ${levels.extreme} 天极度加班，建议尽快调整！`))
    } else if (levels.severe > 0) {
      console.log(chalk.red(`⚠️ 提示: 检测到 ${levels.severe} 天重度加班，请注意身体健康。`))
    } else if (total > 0) {
      console.log(chalk.yellow(`ℹ️ 提示: 当前加班强度相对温和，继续保持。`))
    }
  }

  console.log()
  console.log(
    chalk.gray(
      mode === 'both'
        ? '说明: 条形图按提交次数绘制；同时显示加班天数用于降低高频碎片提交对结果的干扰。'
        : mode === 'days'
        ? '说明: 使用加班天数视角呈现，减少提交频率差异影响。'
        : '说明: 使用提交次数视角。可通过 --weekday-overtime-mode 切换为 days 或 both。'
    )
  )
  console.log()
}

/** 打印周末加班分布 */
export function printWeekendOvertime(parsedData: ParsedGitData, options?: AnalyzeOptions): void {
  if (!parsedData.weekendOvertime) return
  const weekend = parsedData.weekendOvertime
  const totalActive = weekend.saturdayDays + weekend.sundayDays
  if (totalActive === 0) return

  const spanThreshold = options?.weekendSpanThreshold ? parseFloat(options.weekendSpanThreshold) : 3
  const commitThreshold = options?.weekendCommitThreshold ? parseInt(options.weekendCommitThreshold, 10) : 3

  console.log(chalk.blue('📅 周末加班分析:'))
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
    const percentOfActive = totalActive > 0 ? ((count / totalActive) * 100).toFixed(1) : '0.0'
    console.log(`${name}: ${bar} ${countText}天 (${percentOfActive}%)`)
  })

  console.log()
  const totalWorkDays = weekend.realOvertimeDays + weekend.casualFixDays
  const realOvertimeColor =
    weekend.realOvertimeDays > 15 ? chalk.red : weekend.realOvertimeDays > 8 ? chalk.yellow : chalk.green

  console.log('加班类型:')
  console.log(
    `  真正加班: ${realOvertimeColor(
      chalk.bold(weekend.realOvertimeDays.toString())
    )}天 (跨度≥${spanThreshold}h 且 提交数≥${commitThreshold})`
  )
  console.log(
    `  临时修复: ${chalk.gray(
      weekend.casualFixDays.toString()
    )}天 (跨度<${spanThreshold}h 或 提交数<${commitThreshold})`
  )
  console.log(
    `  加班占比(真正加班/活跃周末): ${realOvertimeColor(
      ((weekend.realOvertimeDays / (totalActive || 1)) * 100).toFixed(1) + '%'
    )}`
  )
  if (weekend.totalWeekendDays && weekend.activeWeekendDays) {
    console.log(
      `  周末活跃渗透率: ${(weekend.weekendActivityRate || 0).toFixed(1)}%  真正加班渗透率: ${(weekend.realOvertimeRate || 0).toFixed(1)}%`
    )
  }
  console.log()
  console.log(
    chalk.gray(
      '说明: 真正加班采用“时间跨度 + 提交次数”双阈值判定，减少零散修复对结果的干扰；可通过阈值参数调整。'
    )
  )
  console.log()
}

/** 打印深夜加班分析 */
export function printLateNightAnalysis(parsedData: ParsedGitData): void {
  if (!parsedData.lateNightAnalysis) {
    return
  }

  console.log(chalk.blue('🌙 深夜加班分析:'))
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
