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
  hours: Set<number> // 该天所有提交的小时（去重）
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
}

/**
 * 周末加班分布
 */
export interface WeekendOvertimeDistribution {
  saturdayDays: number // 周六加班天数
  sundayDays: number // 周日加班天数
  casualFixDays: number // 临时修复天数（提交1-2次）
  realOvertimeDays: number // 真正加班天数（提交>=3次）
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
  overTimeRadio: number // 加班比例
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
