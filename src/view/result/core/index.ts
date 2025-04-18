import { useRouter } from 'vue-router'
import { getHourResult } from './hour'
import { getWeekResult } from './week'
import { parseResult, parseWeekData } from './url-helper'
import { getRandomText } from './utils'
import { TimeCount, WorkTimeData, Result996 } from '../../../typings'

/**
 * 获取路由元信息
 * 从URL中解析出时间范围、小时数据和周数据
 * @returns 解析后的数据对象
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
 * 综合小时维度和天维度的数据，计算996指数和加班情况
 * @returns 分析结果对象，包含工作类型、工作时间、996指数等信息
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
    // 工作类型模板，格式为：上班时间 + 下班时间 + 工作天数
    workingType: `${_openingTime || '?'}${_closingTime || '?'}${workDayTypeValue || '?'}`,
    // 工作类型的可读描述
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
 * 这是项目的核心算法，用于评估项目的加班强度
 *
 * 计算逻辑说明：
 * 1. 首先计算出工作时间和加班时间的commit比例
 * 2. 考虑到周末工作应被视为加班，进行数学修正，使用加权计算保证合理性
 * 3. 计算加班commit比例，得出996指数
 * 4. 根据996指数进行分级描述
 *
 * 996指数含义：
 * - 0：不加班
 * - 100：标准996工作制（早9晚9，每周6天）
 * - >100：比996更严重的加班情况
 * - <0：工作不饱和，相对轻松
 *
 * @param param0 包含工作时间数据、加班时间数据和小时维度数据
 * @returns 包含996指数、描述文字、加班比例和是否为标准项目的对象
 */
export function get996Index({ workHourPl, workWeekPl, hourData }: WorkTimeData): Result996 {
  // y: 正常工作时间的commit数量
  const y = workHourPl[0].count
  // x: 加班时间的commit数量
  const x = workHourPl[1].count
  // m: 工作日的commit数量
  const m = workWeekPl[0].count
  // n: 周末的commit数量
  const n = workWeekPl[1].count

  /**
   * 修正后的加班commit数量
   * 定义的每周加班时间：周一到周五的非工作时间+周末全天，因此以工作日加班时间为标准，进行数学修正
   *
   * 计算公式解释：
   * x 代表工作日加班时间的commit数
   * y 代表工作日正常工作时间的commit数
   * (y * n) / (m + n) 是对周末工作时间的修正，使其与工作日正常比例一致
   * 将这两部分相加，得到修正后的加班commit总数
   */
  const overTimeAmendCount = (x + (y * n) / (m + n)).toFixed(0)
  const totalCount = y + x

  // 加班commit百分比
  let overTimeRadio = Math.ceil((overTimeAmendCount / totalCount) * 100)

  // 针对低加班且数据量不足的情况进行特殊处理
  if (overTimeRadio === 0 && hourData.length < 9) {
    overTimeRadio = getUn996Radio({ hourData, totalCount })
  }

  // 996指数 = 加班比例 * 3
  // 乘以3是为了放大差异，使得996工作制对应的指数约为100
  const index996 = overTimeRadio * 3

  // 判断是否为标准项目（排除开源项目和数据量过少的项目）
  const isStandard = index996 < 200 && totalCount > 50

  // 根据996指数生成有趣的描述文字
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
 * 用于处理工作量较少的项目
 *
 * 计算思路：
 * 1. 周末一定是不加班的，周一到周五的工作时间一定是少于9h的
 * 2. 根据现有的数据推算出一个标准工作量（9小时）
 * 3. 将实际工作量与标准工作量比较，计算工作饱和度
 * 4. 返回一个负值，表示工作不饱和的程度
 *
 * @param param0 包含小时数据和总commit数的对象
 * @returns 不加班比例（一个负值）
 */
function getUn996Radio({ hourData, totalCount }: { hourData: TimeCount[]; totalCount: number }): number {
  // 计算每小时平均commit数
  const averageCommit = totalCount / hourData.length
  // 模拟标准工作日（9小时）的commit总数
  const mockTotalCount = averageCommit * 9
  // 计算实际工作量与标准工作量的差异，并转为负值
  const radio = Math.ceil((totalCount / mockTotalCount) * 100) - 100

  return radio
}

/**
 * 校验数据有效性
 * 用于检测提交的数据是否存在异常或伪造
 *
 * 检验逻辑：
 * 比较小时维度和天维度的commit总数，如果不一致，则可能存在数据问题
 *
 * @param params 包含工作时间数据的对象
 * @returns 错误类型描述，如有问题则返回相应提示
 */
function checkDataIsRight(params: {
  workHourPl: Array<{ time: string; count: number }>
  workWeekPl: Array<{ time: string; count: number }>
  index996?: number
  overTimeRadio?: number
}): string {
  const { workHourPl, workWeekPl } = params
  let MSG_TYPE: string = ''

  // 检查小时维度和天维度的数据总量是否一致
  const total1 = workHourPl[0].count + workHourPl[1].count
  const total2 = workWeekPl[0].count + workWeekPl[1].count

  if (total1 !== total2) {
    MSG_TYPE = 'commit_is_fake'
  }

  return MSG_TYPE
}
