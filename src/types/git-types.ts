export interface GitLogOptions {
  path: string
  since?: string
  until?: string
  silent?: boolean // 静默模式，不打印日志
  authorPattern?: string // 作者过滤正则
}

export interface GitLogData {
  byHour: TimeCount[]
  byDay: TimeCount[]
  totalCommits: number
  dailyFirstCommits?: DailyFirstCommit[]
  dayHourCommits?: DayHourCommit[]
  dailyLatestCommits?: DailyLatestCommit[]
  dailyCommitHours?: DailyCommitHours[]
}

export interface TimeCount {
  time: string
  count: number
}

export interface WorkTimeDetectionResult {
  startHour: number
  endHour: number
  isReliable: boolean
  sampleCount: number
  detectionMethod: 'quantile-window' | 'default' | 'manual'
  confidence: number // 可信度百分比 (0-100)
  startHourRange?: {
    startHour: number
    endHour: number
  }
  endHourRange?: {
    startHour: number
    endHour: number
  }
  endDetectionMethod?: 'standard-shift' | 'backward-threshold' | 'default' | 'manual'
}

export interface ParsedGitData {
  hourData: TimeCount[]
  dayData: TimeCount[]
  totalCommits: number
  workHourPl: WorkTimePl
  workWeekPl: WorkWeekPl
  detectedWorkTime?: WorkTimeDetectionResult
  dailyFirstCommits?: DailyFirstCommit[]
  weekdayOvertime?: WeekdayOvertimeDistribution
  weekendOvertime?: WeekendOvertimeDistribution
  lateNightAnalysis?: LateNightAnalysis
}

export type WorkTimePl = [{ time: '工作' | '加班'; count: number }, { time: '工作' | '加班'; count: number }]

export type WorkWeekPl = [{ time: '工作日' | '周末'; count: number }, { time: '工作日' | '周末'; count: number }]

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface WorkTimeData {
  workHourPl: Array<{ time: string; count: number }>
  workWeekPl: Array<{ time: string; count: number }>
  hourData: TimeCount[]
}

export interface Result996 {
  index996: number
  index996Str: string
  /**
   * 加班率（百分比，数值本身代表 %，例如 8 表示 8 而不是 0.08）
   * 计算公式：ceil( ( x + (y * n) / (m + n) ) / (x + y) * 100 )
   *   x = 工作日加班时间段提交次数（工作日下班后）
   *   y = 工作日正常工作时间段提交次数（推断出的工作窗口内）
   *   m = 工作日所有提交次数
   *   n = 周末所有提交次数
   * 周末修正：将周末的工作按 (y * n)/(m + n) 折算为等效“加班提交”并与 x 相加，弱化周末少量零散提交的噪声。
   * 负值含义：初算加班率为 0 且样本小时数 < 9 时，表示工作量极低，会调用 getUn996Radio 推算“工作不饱和度”，返回一个负百分比（例如 -88 表示比标准 9 小时产能低 88%）。
   * 取值范围：正常 >= 0 且 <= 100；仅在低样本低工作量场景可能出现 < 0。
   * 展示规范：输出中统一追加 '%'；负值代表“工作不饱和”而非加班。
   */
  overTimeRadio: number
}

export interface DailyFirstCommit {
  date: string
  minutesFromMidnight: number
}

/**
 * 每日最晚提交时间
 */
export interface DailyLatestCommit {
  date: string
  hour: number // 最晚提交的小时 (0-23)
}

/**
 * 每日提交小时列表
 */
export interface DailyCommitHours {
  date: string
  hours: Set<number> // 该天所有提交的小时（去重，保留用于兼容旧逻辑：工作日加班提交次数统计）
  /** 当天首次提交距离午夜的分钟数（用于精确计算跨度） */
  firstMinutes?: number
  /** 当天最后一次提交距离午夜的分钟数（用于精确计算跨度与加班判定） */
  lastMinutes?: number
  /** 当天提交总次数（精确，不仅仅是不同小时的数量） */
  commitCount?: number
}

/**
 * 按星期几和小时的提交统计
 */
export interface DayHourCommit {
  weekday: number // 1-7 (周一到周日)
  hour: number // 0-23
  count: number
}

/**
 * 工作日加班分布（周一到周五的下班后提交数）
 */
export interface WeekdayOvertimeDistribution {
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  peakDay?: string // 加班最多的一天
  peakCount?: number // 加班最多的次数
  /** 加班天数（存在至少一次下班后提交） */
  mondayDays?: number
  tuesdayDays?: number
  wednesdayDays?: number
  thursdayDays?: number
  fridayDays?: number
  /** 总的工作日加班天数 */
  totalOvertimeDays?: number
}

/**
 * 周末加班分布
 */
export interface WeekendOvertimeDistribution {
  saturdayDays: number // 周六加班天数
  sundayDays: number // 周日加班天数
  casualFixDays: number // 临时修复天数（跨度 < 阈值 或 提交数 < 阈值）
  realOvertimeDays: number // 真正加班天数（跨度>=spanThreshold 且 提交数>=commitThreshold）
  /** 周末活跃天数（出现过至少一次提交） */
  activeWeekendDays?: number
  /** 时间范围内的总周末天数（用于计算渗透率） */
  totalWeekendDays?: number
  /** 真正加班周末天数 / 总周末天数 * 100 */
  realOvertimeRate?: number
  /** 周末活跃天数 / 总周末天数 * 100 */
  weekendActivityRate?: number
}

/**
 * 深夜加班分析
 */
export interface LateNightAnalysis {
  evening: number // 下班后-21:00 晚间提交
  lateNight: number // 21:00-23:00 加班晚期
  midnight: number // 23:00-02:00 深夜加班
  dawn: number // 02:00-06:00 凌晨提交
  midnightDays: number // 有深夜/凌晨提交的天数
  totalWorkDays: number // 总工作日天数
  midnightRate: number // 深夜加班占比 (%)
  totalWeeks: number // 总周数
  totalMonths: number // 总月数
}

/**
 * 每日工作跨度数据
 */
export interface DailyWorkSpan {
  date: string // 日期 (YYYY-MM-DD)
  firstCommitMinutes: number // 首次提交距离午夜的分钟数
  lastCommitMinutes: number // 最后提交距离午夜的分钟数
  spanHours: number // 工作跨度（小时）
  commitCount: number // 当天提交数
}

/**
 * 月度趋势数据
 */
export interface MonthlyTrendData {
  month: string // 月份 (YYYY-MM)
  index996: number // 996指数
  avgWorkSpan: number // 平均工作跨度（小时）
  workSpanStdDev: number // 工作跨度标准差（小时）
  latestEndTime: string // 最晚下班时间 (HH:mm)
  totalCommits: number // 总提交数
  workDays: number // 工作天数
  dataQuality: 'sufficient' | 'limited' | 'insufficient' // 数据质量标记
}

/**
 * 趋势分析结果
 */
export interface TrendAnalysisResult {
  monthlyData: MonthlyTrendData[]
  timeRange: {
    since: string
    until: string
  }
  summary: {
    totalMonths: number
    avgIndex996: number
    avgWorkSpan: number
    trend: 'increasing' | 'decreasing' | 'stable' // 整体趋势
  }
}

/**
 * 作者统计数据
 */
export interface AuthorStats {
  name: string // 作者名字
  email: string // 作者邮箱
  totalCommits: number // 总提交数
  index996: number // 996指数
  index996Str: string // 996指数描述
  /**
   * 个人加班率（与 Result996.overTimeRadio 语义与公式一致）
   * 已按该作者的工作日 / 周末分布独立计算；数值为百分比（8 表示 8%）。
   * 低工作量且无加班样本时可能出现负值，表示工作不饱和度。
   */
  overTimeRadio: number
  workingHourCommits: number // 工作时间提交数
  overtimeCommits: number // 加班时间提交数
  weekdayCommits: number // 工作日提交数
  weekendCommits: number // 周末提交数
}

/**
 * 作者排名结果
 */
export interface AuthorRankingResult {
  authors: AuthorStats[]
  totalAuthors: number
  timeRange: {
    since?: string
    until?: string
  }
}
