import { calculate996Index } from '../core/calculator'
import { WorkTimeData } from '../types/git-types'

/**
 * 测试场景1：正常有加班与周末修正的加班率计算
 * y = 30 (工作时间提交)，x = 10 (工作日加班提交)
 * m = 35 (工作日总提交)，n = 5 (周末总提交)
 * 修正：overTimeAmend = 10 + (30*5)/(35+5) = 10 + 150/40 = 13.75 → round = 14
 * 加班率：ceil(14 / (30+10) * 100) = ceil(35) = 35
 */
 test('加班率计算（含周末修正）与指数匹配', () => {
  const data: WorkTimeData = {
    workHourPl: [
      { time: '工作', count: 30 },
      { time: '加班', count: 10 },
    ],
    workWeekPl: [
      { time: '工作日', count: 35 },
      { time: '周末', count: 5 },
    ],
    hourData: Array.from({ length: 10 }).map((_, i) => ({ time: String(i), count: 4 })),
  }

  const result = calculate996Index(data)
  expect(result.overTimeRadio).toBe(35)
  expect(result.index996).toBe(105) // 35 * 3
 })

/**
 * 测试场景2：低工作量不饱和补偿（出现负值）
 * y = 1, x = 0, m = 1, n = 0 → 修正加班数 = 0 → 初算加班率 = 0
 * hourData.length = 1 (<9) 触发不饱和逻辑：
 * averageCommit = 1 / 1 = 1 → mockTotal = 9 → radio = ceil(1/9*100) - 100 = 12 - 100 = -88
 */
 test('低工作量不饱和返回负值加班率', () => {
  const data: WorkTimeData = {
    workHourPl: [
      { time: '工作', count: 1 },
      { time: '加班', count: 0 },
    ],
    workWeekPl: [
      { time: '工作日', count: 1 },
      { time: '周末', count: 0 },
    ],
    hourData: [{ time: '10', count: 1 }],
  }

  const result = calculate996Index(data)
  expect(result.overTimeRadio).toBe(-88)
  expect(result.index996).toBe(-264) // -88 * 3
 })

/**
 * 测试场景3：小数修正项的四舍五入与最终 ceil 行为
 * y = 20, x = 5, m = 22, n = 2
 * 修正：5 + (20*2)/(22+2) = 5 + 40/24 = 6.666.. → round = 7
 * 加班率：ceil(7 / (25) * 100) = ceil(28) = 28
 */
 test('周末修正项四舍五入与百分比取整', () => {
  const data: WorkTimeData = {
    workHourPl: [
      { time: '工作', count: 20 },
      { time: '加班', count: 5 },
    ],
    workWeekPl: [
      { time: '工作日', count: 22 },
      { time: '周末', count: 2 },
    ],
    hourData: Array.from({ length: 6 }).map((_, i) => ({ time: String(i), count: 5 })),
  }

  const result = calculate996Index(data)
  expect(result.overTimeRadio).toBe(28)
  expect(result.index996).toBe(84) // 28 * 3
 })
