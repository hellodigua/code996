import {
  AnalyzeOptions,
  GitLogData,
  ParsedGitData,
  Result996,
  RepoAnalysisRecord,
  ReportProjectSummary,
  StructuredOutput,
  TeamAnalysis,
  TrendAnalysisResult,
} from '../../types/git-types'
import { ProjectClassificationResult } from '../../core/project-classifier'
import { getPackageVersion } from '../../utils/version'
import { getLocale } from '../../i18n'

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

interface SingleRepoContext {
  result: Result996
  parsedData: ParsedGitData
  rawData: GitLogData
  teamAnalysis: TeamAnalysis | null
  trendResult?: TrendAnalysisResult | null
  options: AnalyzeOptions
  since?: string
  until?: string
  rangeMode?: string
  path: string
  classification: ProjectClassificationResult
  holidayMode: boolean
  timezoneAnalysis: StructuredOutput['timezone']
}

interface MultiRepoContext {
  result: Result996
  parsedData: ParsedGitData
  mergedData: GitLogData
  repoRecords: RepoAnalysisRecord[]
  teamAnalysis: TeamAnalysis | null
  trendResult?: TrendAnalysisResult | null
  options: AnalyzeOptions
  since?: string
  until?: string
  rangeMode?: string
  holidayMode: boolean
  timezoneAnalysis: StructuredOutput['timezone']
}

function buildMeta(
  repos: string[],
  options: AnalyzeOptions,
  since?: string,
  until?: string,
  rangeMode?: string
): StructuredOutput['meta'] {
  return {
    version: getPackageVersion(),
    repos,
    since,
    until,
    rangeMode,
    locale: getLocale(),
    options: {
      self: options.self,
      allTime: options.allTime,
      hours: options.hours,
      ignoreAuthor: options.ignoreAuthor,
      ignoreMsg: options.ignoreMsg,
      timezone: options.timezone,
      halfHour: options.halfHour,
      cn: options.cn,
      skipUserAnalysis: options.skipUserAnalysis,
    },
  }
}

function buildCore(result: Result996, totalCommits: number): StructuredOutput['core'] {
  return {
    index996: result.index996,
    rating: result.index996DescriptionKey,
    overTimeRatio: result.overTimeRadio,
    totalCommits,
  }
}

function buildHourlyDistribution(
  parsedData: ParsedGitData,
  halfHour?: boolean
): StructuredOutput['hourlyDistribution'] {
  if (halfHour) {
    // 保留 48 个半小时点，time 格式已是 "09:30"
    return parsedData.hourData.map(({ time, count }) => ({ hour: time, count }))
  }
  // 默认：聚合为 24 整点
  const hourMap = new Map<string, number>()
  for (const { time, count } of parsedData.hourData) {
    const hour = time.slice(0, 2)
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + count)
  }
  return Array.from(hourMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({ hour, count }))
}

function buildWeekdayDistribution(parsedData: ParsedGitData): StructuredOutput['weekdayDistribution'] {
  return parsedData.dayData.map(({ count }, idx) => ({
    day: DAY_NAMES[idx] ?? `day${idx}`,
    count,
  }))
}

function buildWeekdayOvertime(parsedData: ParsedGitData): StructuredOutput['weekdayOvertime'] {
  const overtime = parsedData.weekdayOvertime
  if (!overtime) return null

  // 不复用分析层已经翻译过的 peakDay，并避免零加班时把周一误判为高峰。
  const counts = {
    monday: overtime.monday,
    tuesday: overtime.tuesday,
    wednesday: overtime.wednesday,
    thursday: overtime.thursday,
    friday: overtime.friday,
  }
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
  const peakDay = weekdays.reduce((peak, day) => (counts[day] > counts[peak] ? day : peak), weekdays[0])
  const peakCount = counts[peakDay]

  return {
    ...counts,
    // ReportData 只在确有加班时提供语言中性的峰值，供 Web 自行切换语言。
    ...(peakCount > 0 ? { peakDay, peakCount } : {}),
  }
}

function buildTeam(teamAnalysis: TeamAnalysis | null): StructuredOutput['team'] {
  if (!teamAnalysis) return null
  return {
    contributors: teamAnalysis.coreContributors.map((contributor) => ({
      author: contributor.author,
      email: contributor.email,
      totalCommits: contributor.totalCommits,
      commitPercentage: contributor.commitPercentage,
      workingHours: contributor.workingHours,
      avgStartTimeMedian: contributor.avgStartTimeMedian,
      avgEndTimeMedian: contributor.avgEndTimeMedian,
      validDays: contributor.validDays,
      index996: contributor.index996,
      overtimeStats: contributor.overtimeStats,
      intensityLevel: contributor.intensityLevel,
    })),
    totalAnalyzed: teamAnalysis.totalAnalyzed,
    totalContributors: teamAnalysis.totalContributors,
    filterThreshold: teamAnalysis.filterThreshold,
    baselineEndHour: teamAnalysis.baselineEndHour,
    distribution: {
      normal: teamAnalysis.distribution.normal.length,
      moderate: teamAnalysis.distribution.moderate.length,
      heavy: teamAnalysis.distribution.heavy.length,
    },
    statistics: teamAnalysis.statistics,
    // 结论和警告原本是 CLI 运行时已翻译文本，Web 根据这些语言中性数值自行生成双语文案。
    healthAssessment: {
      overallIndex: teamAnalysis.healthAssessment.overallIndex,
      teamMedianIndex: teamAnalysis.healthAssessment.teamMedianIndex,
    },
  }
}

function buildProjectSummary(classification?: ProjectClassificationResult): ReportProjectSummary | null {
  if (!classification) return null
  return {
    type: classification.projectType,
    confidence: classification.confidence,
    dimensions: {
      workTimeRegularity: {
        score: classification.dimensions.workTimeRegularity.score,
        details: classification.dimensions.workTimeRegularity.details,
      },
      weekendActivity: { ratio: classification.dimensions.weekendActivity.ratio },
      moonlightingPattern: {
        isActive: classification.dimensions.moonlightingPattern.isActive,
        eveningToMorningRatio: classification.dimensions.moonlightingPattern.eveningToMorningRatio,
        nightRatio: classification.dimensions.moonlightingPattern.nightRatio,
      },
      contributorsCount: { count: classification.dimensions.contributorsCount.count },
    },
  }
}

function buildMultiProject(repoRecords: RepoAnalysisRecord[]): ReportProjectSummary | null {
  const projects = repoRecords
    .filter((record) => record.status === 'success' && record.classification)
    .map((record) => buildProjectSummary(record.classification))
    .filter((project): project is ReportProjectSummary => project !== null)

  if (projects.length === 0) return null

  const projectTypes = new Set(projects.map((project) => project.type))
  return {
    type: projectTypes.size === 1 ? projects[0].type : 'mixed',
    confidence: Math.round(projects.reduce((sum, project) => sum + project.confidence, 0) / projects.length),
  }
}

function buildMultiRepo(repoRecords: RepoAnalysisRecord[]): StructuredOutput['multiRepo'] {
  const repos = repoRecords.map((record) => ({
    name: record.repo.name,
    path: record.repo.path,
    status: record.status,
    error: record.error,
    core:
      record.status === 'success'
        ? {
            index996: record.result.index996,
            rating: record.result.index996DescriptionKey,
            overTimeRatio: record.result.overTimeRadio,
          }
        : null,
    totalCommits: record.data.totalCommits,
    contributors: record.data.contributors,
    firstCommitDate: record.data.firstCommitDate,
    lastCommitDate: record.data.lastCommitDate,
    project: buildProjectSummary(record.classification),
  }))
  if (repos.length === 0) return null
  return { repos }
}

export function buildSingleRepoOutput(ctx: SingleRepoContext): StructuredOutput {
  const {
    result,
    parsedData,
    rawData,
    teamAnalysis,
    trendResult,
    options,
    since,
    until,
    rangeMode,
    path,
    classification,
    holidayMode,
    timezoneAnalysis,
  } = ctx
  return {
    schemaVersion: '1',
    meta: buildMeta([path], options, since, until, rangeMode),
    project: buildProjectSummary(classification),
    holidayMode,
    timezone: timezoneAnalysis,
    core: buildCore(result, rawData.totalCommits),
    workTime: parsedData.detectedWorkTime ?? null,
    hourlyDistribution: buildHourlyDistribution(parsedData, options.halfHour),
    weekdayDistribution: buildWeekdayDistribution(parsedData),
    weekdayOvertime: buildWeekdayOvertime(parsedData),
    weekendOvertime: parsedData.weekendOvertime ?? null,
    lateNight: parsedData.lateNightAnalysis ?? null,
    trend: trendResult ?? null,
    team: buildTeam(teamAnalysis),
    multiRepo: null,
  }
}

export function buildMultiRepoOutput(ctx: MultiRepoContext): StructuredOutput {
  const {
    result,
    parsedData,
    mergedData,
    repoRecords,
    teamAnalysis,
    trendResult,
    options,
    since,
    until,
    rangeMode,
    holidayMode,
    timezoneAnalysis,
  } = ctx
  const repoPaths = repoRecords.filter((r) => r.status === 'success').map((r) => r.repo.path)
  return {
    schemaVersion: '1',
    meta: buildMeta(repoPaths, options, since, until, rangeMode),
    project: buildMultiProject(repoRecords),
    holidayMode,
    timezone: timezoneAnalysis,
    core: buildCore(result, mergedData.totalCommits),
    workTime: parsedData.detectedWorkTime ?? null,
    hourlyDistribution: buildHourlyDistribution(parsedData, options.halfHour),
    weekdayDistribution: buildWeekdayDistribution(parsedData),
    weekdayOvertime: buildWeekdayOvertime(parsedData),
    weekendOvertime: parsedData.weekendOvertime ?? null,
    lateNight: parsedData.lateNightAnalysis ?? null,
    trend: trendResult ?? null,
    team: buildTeam(teamAnalysis),
    multiRepo: buildMultiRepo(repoRecords),
  }
}
