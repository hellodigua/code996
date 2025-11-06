import { TimeCount } from '../types/git-types'

export type EndHourDetectionMethod = 'backward-threshold' | 'default'

export interface EndHourWindow {
  endHour: number
  range: { startHour: number; endHour: number }
  method: EndHourDetectionMethod
}

/**
 * 识别下班时间区间（从晚间回溯，尽量贴近实际加班结束点）
 */
export function detectEndHourWindow(hourData: TimeCount[], startHour: number, standardEndHour: number): EndHourWindow {
  const defaultEndHour = Math.min(standardEndHour, 24)
  const defaultRangeStart = Math.max(0, Math.floor(defaultEndHour - 1))

  if (!hourData || hourData.length === 0) {
    return buildFallbackWindow(defaultRangeStart)
  }

  const sortedHours = hourData
    .map((item) => ({
      hour: parseInt(item.time, 10),
      count: item.count,
    }))
    .filter((item) => !Number.isNaN(item.hour) && item.hour >= 0 && item.hour <= 23)
    .sort((a, b) => a.hour - b.hour)

  if (sortedHours.length === 0) {
    return buildFallbackWindow(defaultRangeStart)
  }

  const totalCommits = sortedHours.reduce((sum, { count }) => sum + Math.max(0, count), 0)

  if (totalCommits <= 0) {
    return buildFallbackWindow(defaultRangeStart)
  }

  const peakCount = sortedHours.reduce((max, item) => Math.max(max, item.count), 0)
  const activityThreshold = Math.max(1, Math.floor(peakCount * 0.3))

  let lastActiveHour: number | null = null
  for (let hour = 23; hour >= 0; hour--) {
    const count = findHourCount(sortedHours, hour)
    if (count >= activityThreshold) {
      lastActiveHour = hour
      break
    }
  }

  const quantileHourRaw = findHourAtQuantile(sortedHours, totalCommits, 0.85)
  const quantileHour = quantileHourRaw !== null ? Math.floor(quantileHourRaw) : null

  const floorStartHour = Math.max(0, Math.floor(startHour))
  const defaultLowerBound = Math.max(0, Math.floor(defaultEndHour - 1))

  let lowerBound = defaultLowerBound
  if (lastActiveHour !== null) {
    lowerBound = Math.min(lowerBound, lastActiveHour)
  }
  lowerBound = Math.max(lowerBound, floorStartHour)

  let upperBound = lastActiveHour ?? Math.max(Math.floor(defaultEndHour), lowerBound)
  if (upperBound < lowerBound) {
    upperBound = lowerBound
  }

  let candidate: number
  if (lastActiveHour !== null) {
    candidate = lastActiveHour
  } else if (quantileHour !== null) {
    candidate = quantileHour
  } else {
    candidate = Math.floor(defaultEndHour)
  }
  candidate = Math.min(Math.max(candidate, lowerBound), upperBound)

  let rangeStartHour = candidate
  let rangeEndHour = Math.min(rangeStartHour + 1, 24)

  if (rangeEndHour <= rangeStartHour) {
    rangeStartHour = Math.max(0, Math.min(rangeStartHour, 23))
    rangeEndHour = Math.min(rangeStartHour + 1, 24)
  }

  return {
    endHour: rangeEndHour,
    range: { startHour: rangeStartHour, endHour: rangeEndHour },
    method: lastActiveHour !== null ? 'backward-threshold' : 'default',
  }
}

function buildFallbackWindow(rangeStart: number): EndHourWindow {
  const start = rangeStart
  const end = Math.min(rangeStart + 1, 24)
  return {
    endHour: end,
    range: { startHour: start, endHour: end },
    method: 'default',
  }
}

function findHourCount(hourData: Array<{ hour: number; count: number }>, targetHour: number): number {
  const record = hourData.find((item) => item.hour === targetHour)
  return record ? record.count : 0
}

function findHourAtQuantile(
  hourData: Array<{ hour: number; count: number }>,
  totalCommits: number,
  quantile: number
): number | null {
  if (!hourData || hourData.length === 0 || totalCommits <= 0) {
    return null
  }

  const target = Math.min(Math.max(quantile, 0), 1)
  let cumulative = 0

  for (const { hour, count } of hourData) {
    const safeCount = Math.max(0, count)
    if (safeCount === 0) {
      continue
    }

    const prevRatio = cumulative / totalCommits
    cumulative += safeCount
    const currentRatio = cumulative / totalCommits

    if (currentRatio >= target) {
      const ratioInHour = target - prevRatio
      if (ratioInHour <= 0) {
        return hour
      }
      const portion = Math.min(1, Math.max(0, (ratioInHour * totalCommits) / safeCount))
      return hour + portion
    }
  }

  const last = hourData[hourData.length - 1]
  return last ? last.hour : null
}
