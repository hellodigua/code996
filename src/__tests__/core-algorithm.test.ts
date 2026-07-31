import { GitParser } from '../git/git-parser'
import { OvertimeAnalyzer } from '../core/overtime-analyzer'
import { WorkTimeAnalyzer } from '../core/work-time-analyzer'
import { GitLogData, TimeCount, WorkTimeDetectionResult } from '../types/git-types'

function halfHourDistribution(counts: Record<string, number>): TimeCount[] {
  const result: TimeCount[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      result.push({ time, count: counts[time] ?? 0 })
    }
  }
  return result
}

function rawData(byHour: TimeCount[]): GitLogData {
  const totalCommits = byHour.reduce((sum, item) => sum + item.count, 0)
  return {
    byHour,
    byDay: [
      { time: '1', count: totalCommits },
      ...Array.from({ length: 6 }, (_, index) => ({ time: String(index + 2), count: 0 })),
    ],
    totalCommits,
  }
}

describe('核心算法时间边界', () => {
  test('9:30-18:30 保留半小时边界，结束时刻本身算加班', () => {
    const workTime: WorkTimeDetectionResult = {
      startHour: 9.5,
      endHour: 18.5,
      isReliable: true,
      sampleCount: -1,
      detectionMethod: 'manual',
      confidence: 100,
    }

    expect(WorkTimeAnalyzer.isWorkingTime('09:00', workTime)).toBe(false)
    expect(WorkTimeAnalyzer.isWorkingTime('09:30', workTime)).toBe(true)
    expect(WorkTimeAnalyzer.isWorkingTime('18:00', workTime)).toBe(true)
    expect(WorkTimeAnalyzer.isWorkingTime('18:30', workTime)).toBe(false)
  })

  test('自动识别将标准工时结束与提交活动结束分开', () => {
    const byHour = halfHourDistribution({
      '09:30': 20,
      '12:00': 15,
      '15:00': 15,
      '18:30': 10,
      '21:00': 10,
    })
    const dailyFirstCommits = Array.from({ length: 100 }, () => ({
      date: '2025-01-06',
      minutesFromMidnight: 9 * 60 + 30,
    }))

    const detected = WorkTimeAnalyzer.detectWorkingHours(byHour, dailyFirstCommits)

    expect(detected.startHour).toBe(9.5)
    expect(detected.endHour).toBe(18.5)
    expect(detected.observedEndHour).toBeGreaterThan(detected.endHour)
    expect(detected.isReliable).toBe(true)
  })

  test('工作日加班按分钟判断半小时结束边界', () => {
    const result = OvertimeAnalyzer.calculateWeekdayOvertime(
      [
        { weekday: 1, hour: 18, minute: 0, count: 2 },
        { weekday: 1, hour: 18, minute: 30, count: 3 },
      ],
      {
        startHour: 9.5,
        endHour: 18.5,
        isReliable: true,
        sampleCount: -1,
        detectionMethod: 'manual',
        confidence: 100,
      }
    )

    expect(result.monday).toBe(3)
  })

  test('低置信度自动工时提供场景区间，手动工时保持单值', async () => {
    const distribution = halfHourDistribution({
      '09:00': 10,
      '09:30': 10,
      '18:00': 10,
      '18:30': 10,
      '19:00': 10,
    })

    const automatic = await GitParser.parseGitData(rawData(distribution), undefined, undefined, undefined, false)
    const automaticResult = GitParser.calculate996Index(automatic)
    expect(automatic.detectedWorkTime?.isReliable).toBe(false)
    expect(automaticResult.uncertainty?.scenarios.length).toBeGreaterThanOrEqual(3)
    expect(automaticResult.uncertainty?.minIndex996).toBeLessThanOrEqual(automaticResult.uncertainty?.maxIndex996 ?? 0)

    const manual = await GitParser.parseGitData(rawData(distribution), '9.5-18.5', undefined, undefined, false)
    const manualResult = GitParser.calculate996Index(manual)
    expect(manual.workHourPl).toEqual([
      { time: 'work', count: 20 },
      { time: 'overtime', count: 30 },
    ])
    expect(manualResult.uncertainty).toBeUndefined()
  })
})
