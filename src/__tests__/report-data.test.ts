import { ProjectClassificationResult, ProjectType } from '../core/project-classifier'
import { buildMultiRepoOutput, buildSingleRepoOutput } from '../cli/output/json-formatter'
import {
  GitLogData,
  ParsedGitData,
  RepoAnalysisRecord,
  Result996,
  TeamAnalysis,
  TimezoneAnalysisResult,
} from '../types/git-types'

const result: Result996 = {
  index996: 72,
  index996DescriptionKey: 'bad',
  overTimeRadio: 24,
}

const rawData: GitLogData = {
  byHour: [{ time: '09:00', count: 8 }],
  byDay: [{ time: '1', count: 8 }],
  totalCommits: 80,
  contributors: 4,
}

const parsedData: ParsedGitData = {
  hourData: [{ time: '09:00', count: 8 }],
  dayData: [{ time: '1', count: 8 }],
  totalCommits: 80,
  workHourPl: [
    { time: 'work', count: 60 },
    { time: 'overtime', count: 20 },
  ],
  workWeekPl: [
    { time: 'weekday', count: 70 },
    { time: 'weekend', count: 10 },
  ],
  weekdayOvertime: {
    monday: 2,
    tuesday: 6,
    wednesday: 1,
    thursday: 3,
    friday: 4,
    peakDay: '周二',
    peakCount: 6,
  },
}

const classification: ProjectClassificationResult = {
  projectType: ProjectType.CORPORATE,
  confidence: 88,
  dimensions: {
    workTimeRegularity: {
      score: 75,
      description: 'regular',
      details: {
        morningUptrend: true,
        afternoonPeak: true,
        eveningDowntrend: true,
        nightLowActivity: true,
      },
    },
    weekendActivity: { ratio: 0.1, description: 'low' },
    moonlightingPattern: {
      isActive: false,
      eveningToMorningRatio: 0.2,
      nightRatio: 0.1,
      description: 'none',
    },
    contributorsCount: { count: 4, description: 'team' },
  },
  reasoning: 'regular work pattern',
}

const timezoneAnalysis: TimezoneAnalysisResult = {
  isCrossTimezone: false,
  crossTimezoneRatio: 0,
  dominantTimezone: '+0800',
  dominantRatio: 1,
  sleepPeriodRatio: 0,
  confidence: 80,
}

const contributor = {
  author: 'Alice',
  email: 'alice@example.com',
  totalCommits: 60,
  commitPercentage: 75,
  timeDistribution: [],
  avgStartTimeMedian: 9,
  avgEndTimeMedian: 20.5,
  validDays: 20,
  index996: 78,
  overtimeStats: { workdayOvertime: 12, weekendOvertime: 4, totalOvertime: 16 },
  intensityLevel: 'heavy' as const,
}

const teamAnalysis: TeamAnalysis = {
  coreContributors: [contributor],
  totalAnalyzed: 1,
  totalContributors: 4,
  filterThreshold: 20,
  baselineEndHour: 20.5,
  distribution: { normal: [], moderate: [], heavy: [contributor] },
  statistics: {
    median996: 78,
    mean996: 78,
    range: [78, 78],
    percentiles: { p25: 78, p50: 78, p75: 78, p90: 78 },
  },
  healthAssessment: {
    overallIndex: 72,
    teamMedianIndex: 78,
    conclusion: 'high intensity',
    warning: 'sustained overtime',
  },
}

describe('ReportData', () => {
  test('单仓库输出使用正式 Schema，并携带项目、节假日和时区元数据', () => {
    const report = buildSingleRepoOutput({
      result,
      parsedData,
      rawData,
      teamAnalysis: null,
      trendResult: null,
      options: {},
      since: '2025-01-01',
      until: '2025-12-31',
      rangeMode: 'custom',
      path: '/workspace/demo',
      classification,
      holidayMode: true,
      timezoneAnalysis,
    })

    expect(report.schemaVersion).toBe('1')
    expect(report.project).toMatchObject({ type: 'corporate', confidence: 88 })
    expect(report.holidayMode).toBe(true)
    expect(report.timezone).toEqual(timezoneAnalysis)
    expect(report.core.rating).toBe('bad')
    expect(report.weekdayOvertime?.peakDay).toBe('tuesday')
  })

  test('保留 CLI 项目分类依据与完整团队分析，而不是只输出摘要字段', () => {
    const report = buildSingleRepoOutput({
      result,
      parsedData,
      rawData,
      teamAnalysis,
      trendResult: null,
      options: {},
      path: '/workspace/demo',
      classification,
      holidayMode: false,
      timezoneAnalysis,
    })

    expect(report.project).toMatchObject({
      type: 'corporate',
      dimensions: {
        workTimeRegularity: { score: 75 },
        weekendActivity: { ratio: 0.1 },
        moonlightingPattern: { isActive: false },
        contributorsCount: { count: 4 },
      },
    })
    expect(report.team).toMatchObject({
      totalAnalyzed: 1,
      totalContributors: 4,
      filterThreshold: 20,
      baselineEndHour: 20.5,
      distribution: { normal: 0, moderate: 0, heavy: 1 },
      statistics: { median996: 78, mean996: 78, range: [78, 78] },
      healthAssessment: { overallIndex: 72, teamMedianIndex: 78 },
      contributors: [
        {
          author: 'Alice',
          avgStartTimeMedian: 9,
          avgEndTimeMedian: 20.5,
          validDays: 20,
          index996: 78,
        },
      ],
    })
  })

  test('多仓库输出保留成功和失败仓库，供 Web 展示完整状态', () => {
    const records: RepoAnalysisRecord[] = [
      {
        repo: { name: 'success', path: '/workspace/success' },
        data: { ...rawData, firstCommitDate: '2025-01-01', lastCommitDate: '2025-12-31' },
        result,
        status: 'success',
        classification,
      },
      {
        repo: { name: 'failed', path: '/workspace/failed' },
        data: { byHour: [], byDay: [], totalCommits: 0 },
        result: { index996: 0, index996DescriptionKey: 'ok', overTimeRadio: 0 },
        status: 'failed',
        error: 'not a git repository',
      },
    ]

    const report = buildMultiRepoOutput({
      result,
      parsedData,
      mergedData: rawData,
      repoRecords: records,
      teamAnalysis: null,
      trendResult: null,
      options: {},
      since: '2025-01-01',
      until: '2025-12-31',
      rangeMode: 'custom',
      holidayMode: false,
      timezoneAnalysis: null,
    })

    expect(report.schemaVersion).toBe('1')
    expect(report.multiRepo?.repos).toHaveLength(2)
    expect(report.multiRepo?.repos[0]).toMatchObject({
      name: 'success',
      status: 'success',
      contributors: 4,
      project: { type: 'corporate', confidence: 88 },
    })
    expect(report.multiRepo?.repos[1]).toMatchObject({
      name: 'failed',
      status: 'failed',
      error: 'not a git repository',
      core: null,
    })
  })
})
