export type ReportProjectType = 'corporate' | 'open_source' | 'uncertain' | 'mixed'

export interface ReportProjectSummary {
  type: ReportProjectType
  confidence: number
  dimensions?: {
    workTimeRegularity: {
      score: number
      details?: {
        morningUptrend: boolean
        afternoonPeak: boolean
        eveningDowntrend: boolean
        nightLowActivity: boolean
      }
    }
    weekendActivity: { ratio: number }
    moonlightingPattern: {
      isActive: boolean
      eveningToMorningRatio: number
      nightRatio: number
    }
    contributorsCount: { count: number }
  }
}

export interface ReportWorkTime {
  startHour: number
  endHour: number
  isReliable: boolean
  sampleCount: number
  detectionMethod: 'quantile-window' | 'default' | 'manual'
  confidence: number
  startHourRange?: { startHour: number; endHour: number }
  endHourRange?: { startHour: number; endHour: number }
  endDetectionMethod?: 'standard-shift' | 'backward-threshold' | 'default' | 'manual'
}

export interface ReportTrendMonth {
  month: string
  index996: number
  avgWorkSpan: number
  workSpanStdDev: number
  avgStartTime: string
  avgEndTime: string
  latestEndTime: string
  totalCommits: number
  contributors: number
  workDays: number
  dataQuality: 'sufficient' | 'limited' | 'insufficient'
  confidence: 'high' | 'medium' | 'low'
}

export interface ReportContributor {
  author: string
  email: string
  totalCommits: number
  commitPercentage: number
  index996?: number
  overtimeStats?: {
    workdayOvertime: number
    weekendOvertime: number
    totalOvertime: number
  }
  intensityLevel?: 'normal' | 'moderate' | 'heavy'
  workingHours?: ReportWorkTime
  avgStartTimeMedian?: number
  avgEndTimeMedian?: number
  validDays?: number
}

export interface ReportTeamAnalysis {
  contributors: ReportContributor[]
  totalAnalyzed?: number
  totalContributors?: number
  filterThreshold?: number
  baselineEndHour?: number
  distribution?: {
    normal: number
    moderate: number
    heavy: number
  }
  statistics?: {
    median996: number
    mean996: number
    range: [number, number]
    percentiles: {
      p25: number
      p50: number
      p75: number
      p90: number
    }
  }
  healthAssessment?: {
    overallIndex: number
    teamMedianIndex: number
  }
}

/**
 * 所有报告渲染器共用的稳定数据契约。
 * 该文件保持浏览器安全，不得引入 Node.js 模块或 CLI 国际化实现。
 */
export interface ReportData {
  schemaVersion: '1'
  meta: {
    version: string
    repos: string[]
    since?: string
    until?: string
    rangeMode?: string
    locale: string
    options: {
      self?: boolean
      allTime?: boolean
      hours?: string
      ignoreAuthor?: string
      ignoreMsg?: string
      timezone?: string
      halfHour?: boolean
      cn?: boolean
      skipUserAnalysis?: boolean
    }
  }
  project: ReportProjectSummary | null
  holidayMode: boolean
  timezone: {
    isCrossTimezone: boolean
    crossTimezoneRatio: number
    dominantTimezone: string | null
    dominantRatio: number
    sleepPeriodRatio: number
    confidence: number
    warning?: string
    timezoneGroups?: Array<{ offset: string; count: number; ratio: number }>
  } | null
  core: {
    index996: number
    rating: string
    overTimeRatio: number
    totalCommits: number
  }
  workTime: ReportWorkTime | null
  hourlyDistribution: Array<{ hour: string; count: number }>
  weekdayDistribution: Array<{ day: string; count: number }>
  weekdayOvertime: {
    monday: number
    tuesday: number
    wednesday: number
    thursday: number
    friday: number
    peakDay?: string
    peakCount?: number
  } | null
  weekendOvertime: {
    saturdayDays: number
    sundayDays: number
    casualFixDays: number
    realOvertimeDays: number
  } | null
  lateNight: {
    evening: number
    lateNight: number
    midnight: number
    dawn: number
    midnightDays: number
    totalWorkDays: number
    midnightRate: number
    totalWeeks: number
    totalMonths: number
  } | null
  trend: {
    monthlyData: ReportTrendMonth[]
    timeRange: { since: string; until: string }
    summary: {
      totalMonths: number
      avgIndex996: number
      avgWorkSpan: number
      trend: 'increasing' | 'decreasing' | 'stable'
    }
  } | null
  team: ReportTeamAnalysis | null
  multiRepo: {
    repos: Array<{
      name: string
      path: string
      status: 'success' | 'failed'
      error?: string
      core: { index996: number; rating: string; overTimeRatio: number } | null
      totalCommits: number
      contributors?: number
      firstCommitDate?: string
      lastCommitDate?: string
      project: ReportProjectSummary | null
    }>
  } | null
}

/** @deprecated 使用 ReportData；保留别名以兼容现有输出模块。 */
export type StructuredOutput = ReportData
