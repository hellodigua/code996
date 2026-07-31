import { randomUUID } from 'crypto'
import path from 'path'
import { GitCollector } from '../git/git-collector'
import { GitParser } from '../git/git-parser'
import { ProjectClassifier } from '../core/project-classifier'
import { GitLogData, GitLogOptions, TimeCount } from '../types/git-types'
import { getPackageVersion } from '../utils/version'
import {
  AnonymousBenchmarkBundle,
  BenchmarkLabelConfidence,
  BenchmarkOptions,
  BenchmarkSchedule,
} from './benchmark-types'

interface BenchmarkRange {
  since?: string
  until?: string
  mode: AnonymousBenchmarkBundle['scope']['rangeMode']
}

const EXCLUDED_FIELDS = [
  'repository name and path',
  'source code and file names',
  'commit hash and message',
  'author name and email',
  'branch and remote names',
  'exact commit dates',
]

/**
 * 构建只包含匿名聚合数据的 benchmark 包。该函数不写文件、不联网上传。
 */
export async function buildAnonymousBenchmark(
  repoPath: string,
  options: BenchmarkOptions
): Promise<AnonymousBenchmarkBundle> {
  const collector = new GitCollector()
  const range = await resolveBenchmarkRange(collector, repoPath, options)
  const referenceWorkTime = parseReferenceHours(options.referenceHours)
  const teamSize = parsePositiveInteger(options.teamSize, 'team size')
  const schedule = parseSchedule(options.schedule)
  const labelConfidence = parseLabelConfidence(options.labelConfidence)

  const collectOptions: GitLogOptions = {
    path: repoPath,
    since: range.since,
    until: range.until,
    ignoreAuthor: options.ignoreAuthor,
    ignoreMsg: options.ignoreMsg,
    timezone: options.timezone,
    silent: true,
  }
  const rawData = await collector.collect(collectOptions)
  if (rawData.totalCommits === 0) {
    throw new Error('No commits matched the benchmark filters')
  }

  const holidayMode = shouldEnableHolidayMode(rawData, options)
  const automaticData = await GitParser.parseGitData(rawData, undefined, range.since, range.until, holidayMode)
  const referenceData = await GitParser.parseGitData(
    rawData,
    options.referenceHours,
    range.since,
    range.until,
    holidayMode
  )
  const automaticResult = GitParser.calculate996Index(automaticData)
  const referenceResult = GitParser.calculate996Index(referenceData)
  const automaticWorkTime = automaticData.detectedWorkTime
  const referenceDetectedWorkTime = referenceData.detectedWorkTime
  if (!automaticWorkTime || !referenceDetectedWorkTime) {
    throw new Error('Unable to calculate benchmark work-time results')
  }

  const classification = ProjectClassifier.classify(rawData, automaticData)
  const bundle: AnonymousBenchmarkBundle = {
    schemaVersion: '1',
    kind: 'code996-anonymous-benchmark',
    datasetId: randomUUID(),
    generator: {
      name: 'code996',
      version: getPackageVersion(),
      generatedOn: new Date().toISOString().slice(0, 10),
      commitTimeSource: 'committer',
    },
    privacy: {
      localOnly: true,
      requiresManualReview: true,
      containsSourceCode: false,
      containsIdentityData: false,
      excludedFields: EXCLUDED_FIELDS,
      aggregateDataWarning:
        'Aggregate timing patterns can still be sensitive. Open and review this JSON before sharing it.',
    },
    labels: {
      referenceWorkTime,
      schedule,
      teamSizeBucket: toCountBucket(teamSize),
      confidence: labelConfidence,
    },
    scope: {
      rangeMode: range.mode,
      sinceMonth: toMonth(range.since),
      untilMonth: toMonth(range.until),
      timezone: summarizeTimezone(rawData, options.timezone),
      holidayMode,
      excludesMergeCommits: true,
    },
    sample: {
      quality: rawData.totalCommits >= 50 ? 'sufficient' : 'limited',
      totalCommits: rawData.totalCommits,
      contributorCountBucket: toCountBucket(rawData.contributors ?? 0),
      halfHourlyDistribution: rawData.byHour,
      weekdayDistribution: rawData.byDay,
      weekdayHalfHourDistribution: aggregateWeekdayHalfHours(rawData),
      dailyFirstCommitDistribution: aggregateMinuteDistribution(rawData.dailyFirstCommits ?? []),
      dailyLatestCommitDistribution: aggregateMinuteDistribution(rawData.dailyLatestCommits ?? []),
    },
    classification: {
      projectType: classification.projectType,
      confidence: classification.confidence,
      workTimeRegularityScore: classification.dimensions.workTimeRegularity.score,
      weekendActivityRatio: classification.dimensions.weekendActivity.ratio,
      moonlightingDetected: classification.dimensions.moonlightingPattern.isActive,
    },
    results: {
      automatic: {
        workTime: automaticWorkTime,
        result996: automaticResult,
      },
      reference: {
        workTime: referenceDetectedWorkTime,
        result996: referenceResult,
      },
      comparison: {
        startErrorMinutes: Math.round((automaticWorkTime.startHour - referenceWorkTime.startHour) * 60),
        endErrorMinutes: Math.round((automaticWorkTime.endHour - referenceWorkTime.endHour) * 60),
        indexDelta: automaticResult.index996 - referenceResult.index996,
        overtimeRatioDelta: automaticResult.overTimeRadio - referenceResult.overTimeRadio,
      },
    },
  }

  assertAnonymousBenchmark(bundle, repoPath)
  return bundle
}

/** 输出前的最后一道隐私防线。 */
export function assertAnonymousBenchmark(bundle: AnonymousBenchmarkBundle, repoPath: string): void {
  const forbiddenPaths = Array.from(
    new Set([repoPath, path.resolve(repoPath)].map((value) => normalizePath(value)).filter((value) => value.length > 1))
  )
  const forbiddenKeys = new Set([
    'repository',
    'repo',
    'path',
    'author',
    'email',
    'message',
    'hash',
    'branch',
    'remote',
    'file',
    'filename',
  ])

  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      const normalizedValue = normalizePath(value)
      if (forbiddenPaths.some((forbiddenPath) => normalizedValue.includes(forbiddenPath))) {
        throw new Error('Privacy audit found the repository path in benchmark output')
      }
      return
    }
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key.toLowerCase())) {
        throw new Error(`Privacy audit rejected forbidden field: ${key}`)
      }
      visit(child)
    }
  }
  visit(bundle)
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '')
}

function parseReferenceHours(value: string): { startHour: number; endHour: number } {
  const parts = value.split('-')
  if (parts.length !== 2) throw new Error('Reference hours must use START-END, for example 9.5-18.5')

  const startHour = Number(parts[0])
  const endHour = Number(parts[1])
  if (
    !Number.isFinite(startHour) ||
    !Number.isFinite(endHour) ||
    startHour < 0 ||
    startHour > 23 ||
    endHour <= startHour ||
    endHour > 24
  ) {
    throw new Error(`Invalid reference hours: ${value}`)
  }
  return { startHour, endHour }
}

function parsePositiveInteger(value: string, label: string): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer`)
  return number
}

function parseSchedule(value: BenchmarkSchedule | undefined): BenchmarkSchedule {
  const result = value ?? 'fixed'
  if (!['fixed', 'flexible', 'shift', 'unknown'].includes(result)) {
    throw new Error(`Invalid schedule: ${result}`)
  }
  return result
}

function parseLabelConfidence(value: BenchmarkLabelConfidence | undefined): BenchmarkLabelConfidence {
  const result = value ?? 'high'
  if (!['high', 'medium', 'low'].includes(result)) {
    throw new Error(`Invalid label confidence: ${result}`)
  }
  return result
}

function toCountBucket(count: number): string {
  if (count <= 0) return 'unknown'
  if (count <= 1) return '1'
  if (count <= 5) return '2-5'
  if (count <= 10) return '6-10'
  if (count <= 30) return '11-30'
  if (count <= 100) return '31-100'
  return '100+'
}

function toMonth(date: string | undefined): string | undefined {
  return date?.slice(0, 7)
}

function aggregateMinuteDistribution(items: Array<{ minutesFromMidnight: number }>): TimeCount[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const bounded = Math.max(0, Math.min(item.minutesFromMidnight, 1439))
    const hour = Math.floor(bounded / 60)
    const minute = bounded % 60 < 30 ? 0 : 30
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    counts.set(time, (counts.get(time) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([time, count]) => ({ time, count }))
    .sort((left, right) => left.time.localeCompare(right.time))
}

function aggregateWeekdayHalfHours(
  rawData: GitLogData
): AnonymousBenchmarkBundle['sample']['weekdayHalfHourDistribution'] {
  const counts = new Map<string, number>()
  for (const item of rawData.dayHourCommits ?? []) {
    const minute = (item.minute ?? 0) < 30 ? 0 : 30
    const time = `${String(item.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    const key = `${item.weekday}|${time}`
    counts.set(key, (counts.get(key) ?? 0) + item.count)
  }
  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [weekday, time] = key.split('|')
      return { weekday: Number(weekday), time, count }
    })
    .sort((left, right) => left.weekday - right.weekday || left.time.localeCompare(right.time))
}

function summarizeTimezone(
  rawData: GitLogData,
  filteredTimezone?: string
): AnonymousBenchmarkBundle['scope']['timezone'] {
  if (filteredTimezone) return { mode: 'filtered', offset: filteredTimezone, dominantRatio: 1 }

  const dominant = rawData.timezoneData?.timezones[0]
  const total = rawData.timezoneData?.totalCommits ?? 0
  if (!dominant || total <= 0) return { mode: 'unknown' }

  return {
    mode: 'dominant',
    offset: dominant.offset,
    dominantRatio: Number((dominant.count / total).toFixed(3)),
  }
}

function shouldEnableHolidayMode(rawData: GitLogData, options: BenchmarkOptions): boolean {
  if (options.cn) return true
  const dominant = rawData.timezoneData?.timezones[0]
  const total = rawData.timezoneData?.totalCommits ?? 0
  return !!dominant && dominant.offset === '+0800' && total > 0 && dominant.count / total >= 0.5
}

async function resolveBenchmarkRange(
  collector: GitCollector,
  repoPath: string,
  options: BenchmarkOptions
): Promise<BenchmarkRange> {
  const selectedModes = [
    options.allTime ? 'allTime' : undefined,
    options.year ? 'year' : undefined,
    options.since || options.until ? 'custom' : undefined,
  ].filter(Boolean)
  if (selectedModes.length > 1) {
    throw new Error('Use only one time range mode: --all-time, --year, or --since/--until')
  }

  if (options.allTime) return { mode: 'all-time' }
  if (options.year) {
    const match = /^(\d{4})(?:-(\d{4}))?$/.exec(options.year.trim())
    if (!match) throw new Error('Year must be YYYY or YYYY-YYYY')
    const startYear = Number(match[1])
    const endYear = Number(match[2] ?? match[1])
    if (startYear < 1970 || endYear < startYear) throw new Error(`Invalid year range: ${options.year}`)
    return {
      since: `${startYear}-01-01`,
      until: `${endYear}-12-31`,
      mode: 'year',
    }
  }
  if (options.since || options.until) {
    if (!options.since || !options.until) {
      throw new Error('--since and --until must be provided together for reproducible benchmark data')
    }
    return { since: options.since, until: options.until, mode: 'custom' }
  }

  const until = await collector.getLastCommitDate({ path: repoPath })
  if (!until) throw new Error('Unable to determine the last commit date')
  const untilDate = new Date(`${until}T00:00:00Z`)
  const sinceDate = new Date(untilDate)
  sinceDate.setUTCDate(sinceDate.getUTCDate() - 365)
  return {
    since: sinceDate.toISOString().slice(0, 10),
    until,
    mode: 'auto-last-commit',
  }
}
