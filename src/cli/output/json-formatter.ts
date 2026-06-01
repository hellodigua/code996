import {
  AnalyzeOptions,
  GitLogData,
  ParsedGitData,
  Result996,
  RepoAnalysisRecord,
  StructuredOutput,
  TeamAnalysis,
  TrendAnalysisResult,
} from '../../types/git-types'
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
      ignoreAuthor: options.ignoreAuthor,
      ignoreMsg: options.ignoreMsg,
      timezone: options.timezone,
      halfHour: options.halfHour,
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

function buildHourlyDistribution(parsedData: ParsedGitData): StructuredOutput['hourlyDistribution'] {
  // hourData 是 48 个半小时点（"00:00", "00:30", ...），聚合为 24 整点
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
  // dayData 索引 0=周一, 1=周二, ..., 6=周日
  return parsedData.dayData.map(({ count }, idx) => ({
    day: DAY_NAMES[idx] ?? `day${idx}`,
    count,
  }))
}

function buildTeam(teamAnalysis: TeamAnalysis | null): StructuredOutput['team'] {
  if (!teamAnalysis) return null
  return { contributors: teamAnalysis.coreContributors }
}

function buildMultiRepo(repoRecords: RepoAnalysisRecord[]): StructuredOutput['multiRepo'] {
  const repos = repoRecords
    .filter((r) => r.status === 'success')
    .map((r) => ({
      name: r.repo.name,
      path: r.repo.path,
      core: { index996: r.result.index996, rating: r.result.index996DescriptionKey, overTimeRatio: r.result.overTimeRadio },
      totalCommits: r.data.totalCommits,
    }))
  return { repos }
}

export function buildSingleRepoOutput(ctx: SingleRepoContext): StructuredOutput {
  const { result, parsedData, rawData, teamAnalysis, trendResult, options, since, until, rangeMode, path } = ctx
  return {
    schemaVersion: 'experimental',
    meta: buildMeta([path], options, since, until, rangeMode),
    core: buildCore(result, rawData.totalCommits),
    workTime: parsedData.detectedWorkTime ?? null,
    hourlyDistribution: buildHourlyDistribution(parsedData),
    weekdayDistribution: buildWeekdayDistribution(parsedData),
    weekdayOvertime: parsedData.weekdayOvertime ?? null,
    weekendOvertime: parsedData.weekendOvertime ?? null,
    lateNight: parsedData.lateNightAnalysis ?? null,
    trend: trendResult ?? null,
    team: buildTeam(teamAnalysis),
    multiRepo: null,
  }
}

export function buildMultiRepoOutput(ctx: MultiRepoContext): StructuredOutput {
  const { result, parsedData, mergedData, repoRecords, teamAnalysis, trendResult, options, since, until } = ctx
  const repoPaths = repoRecords.filter((r) => r.status === 'success').map((r) => r.repo.path)
  return {
    schemaVersion: 'experimental',
    meta: buildMeta(repoPaths, options, since, until, 'custom'),
    core: buildCore(result, mergedData.totalCommits),
    workTime: parsedData.detectedWorkTime ?? null,
    hourlyDistribution: buildHourlyDistribution(parsedData),
    weekdayDistribution: buildWeekdayDistribution(parsedData),
    weekdayOvertime: parsedData.weekdayOvertime ?? null,
    weekendOvertime: parsedData.weekendOvertime ?? null,
    lateNight: parsedData.lateNightAnalysis ?? null,
    trend: trendResult ?? null,
    team: buildTeam(teamAnalysis),
    multiRepo: buildMultiRepo(repoRecords),
  }
}
