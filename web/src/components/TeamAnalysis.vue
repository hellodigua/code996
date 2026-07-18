<template>
  <section class="report-section team-section" data-testid="team-analysis">
    <div class="section-heading">
      <div>
        <p class="section-kicker">TEAM SAMPLE</p>
        <h2>{{ t('result.teamTitle') }}</h2>
      </div>
      <p>
        {{
          t('details.team.source', {
            analyzed: team.totalAnalyzed ?? team.contributors.length,
            total: team.totalContributors ?? team.contributors.length,
            threshold: team.filterThreshold ?? 0,
          })
        }}
      </p>
    </div>

    <div class="team-analysis-grid">
      <article class="ledger-card">
        <p class="section-kicker">FIRST COMMIT</p>
        <h3>{{ t('details.team.startDistribution') }}</h3>
        <dl class="compact-ledger">
          <div v-for="row in startPercentiles" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ formatClock(row.value) }}</dd>
          </div>
        </dl>
      </article>

      <article class="ledger-card">
        <p class="section-kicker">LAST COMMIT</p>
        <h3>{{ t('details.team.endDistribution') }}</h3>
        <dl class="compact-ledger">
          <div v-for="row in endPercentiles" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ formatClock(row.value) }}</dd>
          </div>
        </dl>
        <p v-if="team.baselineEndHour !== undefined" class="card-note">
          {{ t('details.team.baseline', { time: formatClock(team.baselineEndHour) }) }}
        </p>
      </article>

      <article class="ledger-card">
        <p class="section-kicker">INDEX DISTRIBUTION</p>
        <h3>{{ t('details.team.intensityDistribution') }}</h3>
        <dl class="compact-ledger intensity-ledger">
          <div v-for="bucket in intensityBuckets" :key="bucket.key">
            <dt>{{ t(`details.team.intensity.${bucket.key}`) }}</dt>
            <dd>{{ bucket.count }} / {{ percentage(bucket.ratio) }}%</dd>
          </div>
        </dl>
        <p v-if="team.statistics" class="card-note">
          {{
            t('details.team.indexRange', {
              min: decimal(team.statistics.range[0]),
              max: decimal(team.statistics.range[1]),
              median: decimal(team.statistics.median996),
            })
          }}
        </p>
      </article>

      <article v-if="team.healthAssessment" class="ledger-card health-card">
        <p class="section-kicker">HEALTH CHECK</p>
        <h3>{{ t('details.team.health') }}</h3>
        <dl class="compact-ledger">
          <div>
            <dt>{{ t('details.team.overallIndex') }}</dt>
            <dd>{{ decimal(team.healthAssessment.overallIndex) }}</dd>
          </div>
          <div>
            <dt>{{ t('details.team.medianIndex') }}</dt>
            <dd>{{ decimal(team.healthAssessment.teamMedianIndex) }}</dd>
          </div>
        </dl>
        <p class="health-conclusion">{{ healthConclusion }}</p>
        <p v-for="warning in healthWarnings" :key="warning" class="inline-warning">{{ warning }}</p>
      </article>
    </div>

    <div class="table-scroll">
      <table class="team-table">
        <thead>
          <tr>
            <th>{{ t('result.contributor') }}</th>
            <th>{{ t('details.team.commits') }}</th>
            <th>{{ t('result.commitShare') }}</th>
            <th>{{ t('details.team.medianStart') }}</th>
            <th>{{ t('details.team.medianEnd') }}</th>
            <th>{{ t('details.team.validDays') }}</th>
            <th>{{ t('result.index996') }}</th>
            <th>{{ t('details.team.workdayOvertime') }}</th>
            <th>{{ t('details.team.weekendOvertime') }}</th>
            <th>{{ t('result.overtimeCommits') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in team.contributors" :key="`${member.email}-${member.author}`">
            <td>{{ member.author }}</td>
            <td>{{ member.totalCommits }}</td>
            <td>{{ percentage(member.commitPercentage) }}%</td>
            <td>{{ formatClock(member.avgStartTimeMedian) }}</td>
            <td>{{ formatClock(member.avgEndTimeMedian) }}</td>
            <td>{{ member.validDays ?? '–' }}</td>
            <td class="signal-value">{{ member.index996 !== undefined ? decimal(member.index996) : '–' }}</td>
            <td>{{ member.overtimeStats?.workdayOvertime ?? '–' }}</td>
            <td>{{ member.overtimeStats?.weekendOvertime ?? '–' }}</td>
            <td>{{ member.overtimeStats?.totalOvertime ?? '–' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportTeamAnalysis } from '../../../src/report/report-data'
import { useWebI18n } from '@/i18n'
import { formatClock, percentage } from '@/report/formatters'

const props = defineProps<{ team: ReportTeamAnalysis }>()
const { t } = useWebI18n()
const decimal = (value: number) => value.toFixed(1)

function percentile(values: number[], target: number): number {
  if (!values.length) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const index = (target / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

function buildTimePercentiles(field: 'avgStartTimeMedian' | 'avgEndTimeMedian') {
  const values = props.team.contributors
    .map((contributor) => contributor[field])
    .filter((value): value is number => value !== undefined)
  return [
    { label: t('details.team.p25'), value: percentile(values, 25) },
    { label: t('details.team.p50'), value: percentile(values, 50) },
    { label: t('details.team.p75'), value: percentile(values, 75) },
  ]
}

const startPercentiles = computed(() => buildTimePercentiles('avgStartTimeMedian'))
const endPercentiles = computed(() => buildTimePercentiles('avgEndTimeMedian'))

const intensityBuckets = computed(() => {
  const indexes = props.team.contributors.map((member) => member.index996 ?? 0)
  const total = Math.max(1, indexes.length)
  return [
    { key: 'light', count: indexes.filter((index) => index < 40).length },
    { key: 'medium', count: indexes.filter((index) => index >= 40 && index < 60).length },
    { key: 'heavy', count: indexes.filter((index) => index >= 60 && index < 80).length },
    { key: 'veryHeavy', count: indexes.filter((index) => index >= 80).length },
  ].map((bucket) => ({ ...bucket, ratio: (bucket.count / total) * 100 }))
})

const healthConclusion = computed(() => {
  const median = props.team.healthAssessment?.teamMedianIndex ?? 0
  const key = median < 40 ? 'good' : median < 60 ? 'ok' : median < 80 ? 'warning' : 'bad'
  return t(`details.team.healthConclusion.${key}`)
})

const healthWarnings = computed(() => {
  const warnings: string[] = []
  const distribution = props.team.distribution
  if (distribution) {
    const total = distribution.normal + distribution.moderate + distribution.heavy
    const ratio = total ? distribution.heavy / total : 0
    if (distribution.heavy > 0 && ratio < 0.3) {
      warnings.push(t('details.team.heavyWarning', { count: distribution.heavy, ratio: percentage(ratio * 100) }))
    }
  }
  const health = props.team.healthAssessment
  if (health && health.overallIndex - health.teamMedianIndex > 20) {
    warnings.push(
      t('details.team.gapWarning', {
        overall: decimal(health.overallIndex),
        median: decimal(health.teamMedianIndex),
      })
    )
  }
  return warnings
})
</script>
