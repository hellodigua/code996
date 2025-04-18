import { useRouter } from 'vue-router'
import { getHourResult } from './hour'
import { getWeekResult } from './week'
import { parseResult, parseWeekData } from './url-helper'
import { getRandomText } from './utils'
import { TimeCount, WorkTimeData, Result996 } from '../../../typings'

/**
 * 计算服务类
 * 整合所有与996指数计算相关的功能
 */
export class CalculateService {
  private hourData: TimeCount[] = []
  private weekData: TimeCount[] = []
  private timeRange: string[] = []
  private timeStr: string = ''
  private totalCount: number = 0

  /**
   * 从路由中初始化数据
   */
  public initFromRoute(): void {
    const router = useRouter()
    const { query } = router.currentRoute.value

    this.hourData = parseResult(query.hour as string)
    this.weekData = parseWeekData(parseResult(query.week as string))
    this.timeRange = (query.time as string).split('_')
    this.timeStr = `${this.timeRange[0]} ∼ ${this.timeRange[1]}`
    this.totalCount = this.hourData.reduce((total, item) => total + item.count, 0)
  }

  /**
   * 获取路由元信息
   */
  public getRoutesMeta() {
    return {
      hourData: this.hourData,
      weekData: this.weekData,
      timeRange: this.timeRange,
      timeStr: this.timeStr,
      totalCount: this.totalCount,
    }
  }

  /**
   * 计算996指数
   */
  public get996Index(data: WorkTimeData): Result996 {
    const { workHourPl, workWeekPl, hourData } = data

    // y: 正常工作时间的commit数量
    const y = workHourPl[0].count
    // x: 加班时间的commit数量
    const x = workHourPl[1].count
    // m: 工作日的commit数量
    const m = workWeekPl[0].count
    // n: 周末的commit数量
    const n = workWeekPl[1].count

    // 修正后的加班commit数量
    const overTimeAmendCount = (x + (y * n) / (m + n)).toFixed(0)
    const totalCount = y + x

    // 加班commit百分比
    let overTimeRadio = Math.ceil((Number(overTimeAmendCount) / totalCount) * 100)

    // 针对低加班且数据量不足的情况进行特殊处理
    if (overTimeRadio === 0 && hourData.length < 9) {
      overTimeRadio = this.getUn996Radio({ hourData, totalCount })
    }

    // 996指数 = 加班比例 * 3
    const index996 = overTimeRadio * 3

    // 判断是否为标准项目
    const isStandard = index996 < 200 && totalCount > 50

    // 根据996指数生成描述文字
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
   */
  private getUn996Radio({ hourData, totalCount }: { hourData: TimeCount[]; totalCount: number }): number {
    // 计算每小时平均commit数
    const averageCommit = totalCount / hourData.length
    // 模拟标准工作日（9小时）的commit总数
    const mockTotalCount = averageCommit * 9
    // 计算实际工作量与标准工作量的差异
    const radio = Math.ceil((totalCount / mockTotalCount) * 100) - 100

    return radio
  }

  /**
   * 校验数据有效性
   */
  public checkDataIsRight(params: {
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

  /**
   * 获取完整的分析结果
   */
  public getFullResult() {
    this.initFromRoute()

    const { hourData, weekData, totalCount } = this.getRoutesMeta()
    const { openingTime, closingTime, workHourPl } = getHourResult(hourData)
    const { workDayTypeValue, workWeekPl } = getWeekResult(weekData)
    const { index996, index996Str, overTimeRadio, isStandard } = this.get996Index({ workHourPl, workWeekPl, hourData })

    const MSG_TYPE = this.checkDataIsRight({ workHourPl, workWeekPl, index996, overTimeRadio })

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
      timeStr: this.timeStr,
      index996,
      index996Str,
      overTimeRadio,
      isStandard,
      MSG_TYPE,
    }
  }
}

// 导出计算服务实例
export const calculateService = new CalculateService()
