import chalk from 'chalk'
import { ParsedGitData, TimeCount } from '../../../../types/git-types'
import { TimeAggregator } from '../../../../utils/time-aggregator'

/**
 * 时间分布打印器
 * 负责打印24小时和星期分布图表
 */

/** 打印 24 小时提交分布与星期分布图形 */
export function printTimeDistribution(parsedData: ParsedGitData, halfHourMode = false): void {
  const barLength = 20

  // 根据模式决定展示的数据
  const displayData: TimeCount[] = halfHourMode
    ? parsedData.hourData // 直接展示48点
    : TimeAggregator.aggregateToHour(parsedData.hourData) // 聚合为24点

  const title = halfHourMode ? '🕐 24小时分布（半小时粒度）:' : '🕐 24小时分布:'
  console.log(chalk.blue(title))

  const maxCount = Math.max(0, ...displayData.map((item: TimeCount) => item.count))

  if (maxCount === 0) {
    console.log('暂无提交数据')
    console.log()
  } else {
    displayData.forEach((hour: TimeCount) => {
      if (hour.count === 0) {
        return
      }

      const percentage = (hour.count / maxCount) * barLength
      const filledLength = Math.min(barLength, Math.max(1, Math.round(percentage)))
      const bar = '█'.repeat(filledLength) + ' '.repeat(barLength - filledLength)
      const countText = hour.count.toString().padStart(3)

      // 格式化时间显示：半小时模式显示 "09:30"，小时模式显示 "09"
      const timeLabel = halfHourMode ? hour.time.padStart(5) : hour.time.padStart(2)
      console.log(`${timeLabel}: ${bar} ${countText}`)
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
