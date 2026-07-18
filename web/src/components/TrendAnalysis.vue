<template>
  <section class="report-section" data-testid="trend-analysis">
    <div class="section-heading">
      <div>
        <p class="section-kicker">MONTH BY MONTH</p>
        <h2>{{ t('result.trendTitle') }}</h2>
      </div>
      <p>{{ t('result.trendDirection', { direction: t(`trend.${trend.summary.trend}`) }) }}</p>
    </div>

    <div class="evidence-ledger trend-summary">
      <div>
        <span>{{ t('details.trend.period') }}</span>
        <strong class="text-value">{{ trend.timeRange.since }} — {{ trend.timeRange.until }}</strong>
      </div>
      <div>
        <span>{{ t('details.trend.months') }}</span>
        <strong>{{ trend.summary.totalMonths }}</strong>
      </div>
      <div>
        <span>{{ t('details.trend.averageIndex') }}</span>
        <strong>{{ decimal(trend.summary.avgIndex996) }}</strong>
      </div>
      <div>
        <span>{{ t('details.trend.averageSpan') }}</span>
        <strong>{{ decimal(trend.summary.avgWorkSpan) }}h</strong>
      </div>
    </div>

    <div class="table-scroll">
      <table class="trend-table">
        <thead>
          <tr>
            <th>{{ t('details.trend.month') }}</th>
            <th>{{ t('result.index996') }}</th>
            <th>{{ t('details.trend.workSpan') }}</th>
            <th>{{ t('details.trend.start') }}</th>
            <th>{{ t('details.trend.end') }}</th>
            <th>{{ t('details.trend.latestEnd') }}</th>
            <th>{{ t('details.trend.commits') }}</th>
            <th>{{ t('result.contributors') }}</th>
            <th>{{ t('details.trend.workDays') }}</th>
            <th>{{ t('details.trend.quality') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="month in trend.monthlyData" :key="month.month" :class="`quality-${month.confidence}`">
            <td>{{ month.month }}</td>
            <td class="signal-value">{{ month.totalCommits ? decimal(month.index996) : '–' }}</td>
            <td>
              {{ month.totalCommits ? `${decimal(month.avgWorkSpan)}h` : '–' }}
              <small v-if="month.totalCommits" class="cell-note">±{{ decimal(month.workSpanStdDev) }}h</small>
            </td>
            <td>{{ month.avgStartTime }}</td>
            <td>{{ month.avgEndTime }}</td>
            <td>{{ month.latestEndTime }}</td>
            <td>{{ month.totalCommits }}</td>
            <td>{{ month.contributors }}</td>
            <td>{{ month.workDays }}</td>
            <td>
              <span
                class="quality-indicator"
                :class="`is-${month.confidence}`"
                role="img"
                :aria-label="qualityDescription(month)"
                :title="qualityDescription(month)"
              >
                <span class="quality-signal" aria-hidden="true">
                  <i
                    v-for="level in 3"
                    :key="level"
                    :class="{ 'is-active': level <= confidenceLevels[month.confidence] }"
                  ></i>
                </span>
                <span>{{ t(`details.quality.${month.dataQuality}`) }}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="table-legend">{{ t('details.trend.legend') }}</p>
  </section>
</template>

<script setup lang="ts">
import type { ReportData } from '../../../src/report/report-data'
import { useWebI18n } from '@/i18n'

defineProps<{ trend: NonNullable<ReportData['trend']> }>()
const { t } = useWebI18n()
const decimal = (value: number) => value.toFixed(1)
type TrendMonth = NonNullable<ReportData['trend']>['monthlyData'][number]
const confidenceLevels: Record<TrendMonth['confidence'], number> = { low: 1, medium: 2, high: 3 }
const qualityDescription = (month: TrendMonth) =>
  t('details.trend.qualitySummary', {
    quality: t(`details.quality.${month.dataQuality}`),
    confidence: t(`details.confidence.${month.confidence}`),
  })
</script>
