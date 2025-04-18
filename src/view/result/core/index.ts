import { useRouter } from 'vue-router'
import { getHourResult } from './hour'
import { getWeekResult } from './week'
import { parseResult, parseWeekData } from './url-helper'
import { getRandomText } from './utils'
import { TimeCount, WorkTimeData, Result996 } from '../../../typings'

/**
 * 获取路由元信息
 */
export function getRoutesMeta() {
  const router = useRouter()
  const { query } = router.currentRoute.value

  const hourData = parseResult(query.hour as string)
  const weekData = parseWeekData(parseResult(query.week as string))
  const timeRange = (query.time as string).split('_')
  const timeStr = `${timeRange[0]} ∼ ${timeRange[1]}`
  const totalCount = hourData.reduce((total, item) => total + item.count, 0)

  return {
    hourData,
    weekData,
    timeRange,
    timeStr,
    totalCount,
  }
}

/**
 * 获取分析结果
 */
export function getResult() {
  const { hourData, weekData, totalCount } = getRoutesMeta()
  const { openingTime, closingTime, workHourPl } = getHourResult(hourData)
  const { workDayTypeValue, workWeekPl } = getWeekResult(weekData)
  const { index996, index996Str, overTimeRadio, isStandard } = get996Index({ workHourPl, workWeekPl, hourData })

  const MSG_TYPE = checkDataIsRight({ workHourPl, workWeekPl, index996, overTimeRadio })

  const _openingTime = Number(openingTime?.time)
  const _closingTime = Number(closingTime?.time) % 12

  return {
    // 工作类型模板
    workingType: `${_openingTime || '?'}${_closingTime || '?'}${workDayTypeValue || '?'}`,
    workingTypeStr: `早 ${_openingTime || '?'} 晚 ${_closingTime || '?'} 一周 ${workDayTypeValue || '?'} 天`,
    openingTime,
    closingTime,
    workDayTypeValue,
    workHourPl,
    workWeekPl,
    totalCount,
    index996,
    index996Str,
    overTimeRadio,
    isStandard,
    MSG_TYPE,
  }
}

/**
 * 计算996指数
 */
export function get996Index({ workHourPl, workWeekPl, hourData }: WorkTimeData): Result996 {
  const y = workHourPl[0].count
  const x = workHourPl[1].count
  const m = workWeekPl[0].count
  const n = workWeekPl[1].count

  /**
   * 修正后的加班commit数量
   * 定义的每周加班时间：周一到周五的非工作时间+周末全天，因此以工作日加班时间为标准，进行数学修正
   * 定义：小时维度 x 加班时长 y 正常上班时长；天维度 m 工作日；n 周六周日
   */
  const overTimeAmendCount = (x + (y * n) / (m + n)).toFixed(0)
  const totalCount = y + x

  // 加班commit百分比
  let overTimeRadio = Math.ceil((overTimeAmendCount / totalCount) * 100)

  if (overTimeRadio === 0 && hourData.length < 9) {
    overTimeRadio = getUn996Radio({ hourData, totalCount })
  }

  // 996指数
  const index996 = overTimeRadio * 3

  // 是否为正常项目（开源项目计算不准确）
  const isStandard = index996 < 200 && totalCount > 50

  let index996Str = ''

  if (index996 <= 10) {
    index996Str = getRandomText(['令人羡慕的工作', '恭喜，你们没有福报', '你就是搬砖界的欧皇吧'])
  } else if (index996 > 10 && index996 <= 50) {
    index996Str = getRandomText(['你还有剩余价值'])
  } else if (index996 > 50 && index996 <= 90) {
    index996Str = getRandomText(['加油，老板的法拉利靠你了'])
  } else if (index996 > 90 && index996 <= 110) {
    index996Str = getRandomText(['你的福报已经修满了'])
  } else if (index996 > 110) {
    index996Str = getRandomText(['你们想必就是卷王中的卷王吧'])
  }

  return { index996, index996Str, overTimeRadio, isStandard }
}

/**
 * 计算不加班比例
 * 思路：周末一定是不加班的，周一到周五的工作时间一定是少于9h的
 * 因此模拟出上够9h的commit，然后算比例即可
 */
function getUn996Radio({ hourData, totalCount }: { hourData: TimeCount[]; totalCount: number }): number {
  const averageCommit = totalCount / hourData.length
  const mockTotalCount = averageCommit * 9
  const radio = Math.ceil((totalCount / mockTotalCount) * 100) - 100

  return radio
}

/**
 * 校验数据
 * 1. 项目数据伪造
 */
function checkDataIsRight(params: {
  workHourPl: Array<{ time: string; count: number }>
  workWeekPl: Array<{ time: string; count: number }>
  index996?: number
  overTimeRadio?: number
}): string {
  const { workHourPl, workWeekPl } = params
  let MSG_TYPE: string = ''

  const total1 = workHourPl[0].count + workHourPl[1].count
  const total2 = workWeekPl[0].count + workWeekPl[1].count

  if (total1 !== total2) {
    MSG_TYPE = 'commit_is_fake'
  }

  return MSG_TYPE
}
