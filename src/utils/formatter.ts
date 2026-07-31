import chalk from 'chalk'
import { ParsedGitData } from '../types/git-types'
import { t } from '../i18n'

/** 将分钟数转换为 HH:MM 字符串，便于展示 */
export function formatMinutesToClock(minutes: number): string {
  const normalized = Math.max(0, minutes)
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

/** 格式化上班时间展示，括号中显示推测区间 */
export function formatStartClock(detection: ParsedGitData['detectedWorkTime']): string {
  if (!detection) {
    return '—'
  }

  const range = detection.startHourRange
  const startMinutes = Math.round((detection.startHour ?? 0) * 60)

  if (!range) {
    return formatMinutesToClock(startMinutes)
  }

  const displayHour = range.startHour
  const rangeStart = range.startHour
  const rangeEnd = range.endHour

  const displayClock = formatMinutesToClock(Math.round(displayHour * 60))
  const rangeStartClock = formatMinutesToClock(Math.round(rangeStart * 60))
  const rangeEndClock = formatMinutesToClock(Math.round(rangeEnd * 60))

  return t('workTime.startRange', {
    time: displayClock,
    start: rangeStartClock,
    end: rangeEndClock,
  })
}

/** 格式化下班时间展示，括号中显示推测区间 */
export function formatEndClock(detection: ParsedGitData['detectedWorkTime']): string {
  if (!detection) {
    return '—'
  }

  return formatMinutesToClock(Math.round(detection.endHour * 60))
}

/** 格式化提交活动实际延伸到的时间；它不是标准工时边界。 */
export function formatObservedEndClock(detection: ParsedGitData['detectedWorkTime']): string {
  if (!detection || detection.observedEndHour === undefined) {
    return '—'
  }

  return formatMinutesToClock(Math.round(detection.observedEndHour * 60))
}

/** 根据指数区间返回对应的颜色函数 */
export function getIndexColor(index: number): (text: string) => string {
  if (index <= 10) return chalk.green
  if (index <= 50) return chalk.yellow
  if (index <= 90) return chalk.keyword('orange')
  if (index <= 110) return chalk.red
  return chalk.magenta
}
