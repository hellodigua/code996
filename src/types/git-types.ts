/**
 * 时间统计粒度
 */
export type TimeGranularity = 'hour' | 'half-hour'

export interface GitLogOptions {
  path: string
  since?: string
  until?: string
  silent?: boolean // 静默模式，不打印日志
  authorPattern?: string // 作者过滤正则（包含特定作者）
  ignoreAuthor?: string // 排除作者正则（排除特定作者，如 bot|jenkins）
  ignoreMsg?: string // 排除提交消息正则（排除特定消息，如 merge|lint）
}

export interface GitLogData {
  byHour: TimeCount[] // 时间分布数据（48个半小时点）
  byDay: TimeCount[]
  totalCommits: number
  dailyFirstCommits?: DailyFirstCommit[]
  dayHourCommits?: DayHourCommit[]
  dailyLatestCommits?: DailyLatestCommit[]
  dailyCommitHours?: DailyCommitHours[]
  contributors?: number // 参与人数
  firstCommitDate?: string // 第一次提交日期
  lastCommitDate?: string // 最后一次提交日期
  granularity?: TimeGranularity // 时间粒度标识（默认 'half-hour'）
  timezoneData?: TimezoneData // 时区分布数据
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
  confidence: number // 置信度百分比 (0-100)
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
  minutesFromMidnight: number // 最晚提交距离午夜的分钟数 (0-1439)
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
  avgStartTime: string // 平均开始工作时间 (HH:mm)
  avgEndTime: string // 平均结束工作时间 (HH:mm)
  latestEndTime: string // 最晚结束时间 (HH:mm)
  totalCommits: number // 总提交数
  contributors: number // 参与人数
  workDays: number // 工作天数
  dataQuality: 'sufficient' | 'limited' | 'insufficient' // 数据质量标记
  confidence: 'high' | 'medium' | 'low' // 置信度等级
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

// ====== 以下是多仓库功能的新增类型 ======

/**
 * 仓库信息
 */
export interface RepoInfo {
  name: string
  path: string
}

/**
 * 仓库分析记录（用于对比表）
 */
export interface RepoAnalysisRecord {
  repo: RepoInfo
  data: GitLogData
  result: Result996
  status: 'success' | 'failed'
  error?: string
  classification?: any // 项目分类结果（ProjectClassificationResult）
}

/**
 * Analyze 命令的选项（同时用于多仓库分析）
 */
export interface AnalyzeOptions {
  since?: string
  until?: string
  allTime?: boolean
  year?: string
  self?: boolean
  hours?: string
  halfHour?: boolean // 是否以半小时粒度展示
  trend?: boolean // 是否显示月度趋势分析
  ignoreAuthor?: string // 排除作者正则
  ignoreMsg?: string // 排除提交消息正则
  timezone?: string // 指定时区进行分析 (例如: +0800, -0700)
  skipUserAnalysis?: boolean // 是否跳过团队工作模式分析
  maxUsers?: number // 最大分析用户数（默认30）
}

/**
 * 时区数据
 */
export interface TimezoneData {
  totalCommits: number
  timezones: Array<{ offset: string; count: number }>
}

/**
 * 跨时区分析结果
 */
export interface TimezoneAnalysisResult {
  isCrossTimezone: boolean // 是否为跨时区项目
  crossTimezoneRatio: number // 非主导时区的占比 (0-1)
  dominantTimezone: string | null // 主导时区，如 "+0800"
  dominantRatio: number // 主导时区占比 (0-1)
  sleepPeriodRatio: number // 睡眠时段（连续5小时最少）的提交占比 (0-1)
  confidence: number // 检测置信度 (0-100)
  warning?: string // 警告信息
  timezoneGroups?: Array<{ offset: string; count: number; ratio: number }> // 时区分组详情
}

// ====== 以下是团队工作模式分析的新增类型 ======

/**
 * 工作强度等级
 */
export type WorkIntensityLevel = 'normal' | 'moderate' | 'heavy'

/**
 * 个人工作模式
 */
export interface UserWorkPattern {
  author: string // 作者名
  email: string // 邮箱
  totalCommits: number // 提交数
  commitPercentage: number // 占比（百分比）
  timeDistribution: TimeCount[] // 个人的时间分布（24小时）
  workingHours?: WorkTimeDetectionResult // 个人的上下班时间（算法识别）
  // 基于每日首末commit的平均值
  avgStartTimeMean?: number // 平均上班时间（算术平均，小时数）
  avgStartTimeMedian?: number // 平均上班时间（中位数，小时数）
  avgEndTimeMean?: number // 平均下班时间（算术平均，小时数）
  avgEndTimeMedian?: number // 平均下班时间（中位数，小时数）
  validDays?: number // 有效天数（用于判断数据可靠性）
  index996?: number // 个人的996指数
  overtimeStats?: {
    workdayOvertime: number // 工作日加班提交数
    weekendOvertime: number // 周末加班提交数
    totalOvertime: number // 总加班提交数
  }
  intensityLevel?: WorkIntensityLevel // 工作强度等级
}

/**
 * 团队分析结果
 */
export interface TeamAnalysis {
  coreContributors: UserWorkPattern[] // 核心贡献者（过滤后）
  totalAnalyzed: number // 实际分析的用户数
  totalContributors: number // 总贡献者数
  filterThreshold: number // 过滤阈值（提交数）
  baselineEndHour: number // 团队基准下班时间（P50中位数）

  // 工作强度分布
  distribution: {
    normal: UserWorkPattern[] // 正常作息（基准下班时间之前）
    moderate: UserWorkPattern[] // 适度加班（基准+0到+2小时）
    heavy: UserWorkPattern[] // 严重加班（基准+2小时之后）
  }

  // 统计指标
  statistics: {
    median996: number // 中位数996指数
    mean996: number // 平均996指数
    range: [number, number] // 996指数范围 [最小, 最大]
    percentiles: {
      p25: number // 25%分位数
      p50: number // 50%分位数（中位数）
      p75: number // 75%分位数
      p90: number // 90%分位数
    }
  }

  // 健康度评估
  healthAssessment: {
    overallIndex: number // 项目整体996指数
    teamMedianIndex: number // 团队中位数996指数
    conclusion: string // 结论文本
    warning?: string // 警告信息
  }
}
