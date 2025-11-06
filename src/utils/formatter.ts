import chalk from 'chalk'
import { ParsedGitData } from '../types/git-types'

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

  return `${displayClock}（推测区间：${rangeStartClock}-${rangeEndClock}）`
}

/** 格式化下班时间展示，括号中显示推测区间 */
export function formatEndClock(detection: ParsedGitData['detectedWorkTime']): string {
  if (!detection) {
    return '—'
  }

  const range = detection.endHourRange
  const thresholdHour = (detection.startHour ?? 0) + 9

  if (!range) {
    const fallbackHour = Math.max(thresholdHour, detection.endHour ?? thresholdHour)
    return formatMinutesToClock(Math.round(fallbackHour * 60))
  }

  let displayHour: number

  if (range.startHour >= thresholdHour) {
    displayHour = range.startHour
  } else {
    displayHour = range.endHour
  }

  const displayClock = formatMinutesToClock(Math.round(displayHour * 60))
  const rangeStart = formatMinutesToClock(Math.round(range.startHour * 60))
  const rangeEnd = formatMinutesToClock(Math.round(range.endHour * 60))

  return `${displayClock}（推测区间：${rangeStart}-${rangeEnd}）`
}

/** 根据指数区间返回对应的颜色函数 */
export function getIndexColor(index: number): (text: string) => string {
  if (index <= 10) return chalk.green
  if (index <= 50) return chalk.yellow
  if (index <= 90) return chalk.keyword('orange')
  if (index <= 110) return chalk.red
  return chalk.magenta
}

