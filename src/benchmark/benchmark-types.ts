import { ProjectType } from '../core/project-classifier'
import { Result996, TimeCount, WorkTimeDetectionResult } from '../types/git-types'

export type BenchmarkSchedule = 'fixed' | 'flexible' | 'shift' | 'unknown'
export type BenchmarkLabelConfidence = 'high' | 'medium' | 'low' | 'unknown'

export interface BenchmarkOptions {
  since?: string
  until?: string
  year?: string
  allTime?: boolean
  referenceHours?: string
  teamSize?: string
  schedule?: BenchmarkSchedule
  labelConfidence?: BenchmarkLabelConfidence
  timezone?: string
  cn?: boolean
  ignoreAuthor?: string
  ignoreMsg?: string
  output?: string
  lang?: string
}

export interface AnonymousBenchmarkBundle {
  schemaVersion: '1'
  kind: 'code996-anonymous-benchmark'
  datasetId: string
  generator: {
    name: 'code996'
    version: string
    generatedOn: string
    commitTimeSource: 'committer'
  }
  privacy: {
    localOnly: true
    requiresManualReview: true
    containsSourceCode: false
    containsIdentityData: false
    excludedFields: string[]
    aggregateDataWarning: string
  }
  labels: {
    status: 'labeled' | 'unlabeled'
    referenceWorkTime?: {
      startHour: number
      endHour: number
    }
    schedule: BenchmarkSchedule
    teamSizeBucket: string
    confidence: BenchmarkLabelConfidence
  }
  scope: {
    rangeMode: 'all-time' | 'year' | 'custom' | 'auto-last-commit'
    sinceMonth?: string
    untilMonth?: string
    timezone: {
      mode: 'filtered' | 'dominant' | 'unknown'
      offset?: string
      dominantRatio?: number
    }
    holidayMode: boolean
    excludesMergeCommits: true
  }
  sample: {
    quality: 'sufficient' | 'limited'
    totalCommits: number
    contributorCountBucket: string
    halfHourlyDistribution: TimeCount[]
    weekdayDistribution: TimeCount[]
    weekdayHalfHourDistribution: Array<{
      weekday: number
      time: string
      count: number
    }>
    dailyFirstCommitDistribution: TimeCount[]
    dailyLatestCommitDistribution: TimeCount[]
  }
  classification: {
    projectType: ProjectType
    confidence: number
    workTimeRegularityScore: number
    weekendActivityRatio: number
    moonlightingDetected: boolean
  }
  results: {
    automatic: {
      workTime: WorkTimeDetectionResult
      result996: Result996
    }
    reference?: {
      workTime: WorkTimeDetectionResult
      result996: Result996
    }
    comparison?: {
      startErrorMinutes: number
      endErrorMinutes: number
      indexDelta: number
      overtimeRatioDelta: number
    }
  }
}
