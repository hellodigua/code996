export interface TimeCount {
  /**
   * commit 时间
   */
  time: string
  /**
   * commit 数量
   */
  count: number
}

export interface CalcTimeCount extends TimeCount {
  /**
   * 分数
   */
  score: number
}

export interface WorkTimeData {
  /**
   * 上下班时间数据
   */
  workHourPl: Array<{ time: string; count: number }>
  /**
   * 工作日数据
   */
  workWeekPl: Array<{ time: string; count: number }>
  /**
   * 小时数据
   */
  hourData: TimeCount[]
}

export interface Result996 {
  /**
   * 996指数
   */
  index996: number
  /**
   * 996指数描述文字
   */
  index996Str: string
  /**
   * 加班时间比例
   */
  overTimeRadio: number
  /**
   * 是否为标准项目（非开源项目）
   */
  isStandard: boolean
}

export interface ChartData {
  time: string
  count: number
}
