<template>
  <section class="report-section diagnostic-section" data-testid="diagnostic-insights">
    <div class="section-heading">
      <div>
        <p class="section-kicker">FINDINGS</p>
        <h2>{{ t('details.diagnostics.title') }}</h2>
      </div>
    </div>

    <ul class="finding-list">
      <li v-for="finding in findings" :key="finding.text" :class="`is-${finding.tone}`">
        <span>{{ finding.marker }}</span>
        <p>{{ finding.text }}</p>
      </li>
    </ul>

    <div v-if="report.workTime" class="evidence-ledger work-time-ledger">
      <div>
        <span>{{ t('details.workTime.start') }}</span>
        <strong>{{ formatClock(report.workTime.startHour) }}</strong>
        <small v-if="report.workTime.startHourRange">
          {{ formatRange(report.workTime.startHourRange) }}
        </small>
      </div>
      <div>
        <span>{{ t('details.workTime.end') }}</span>
        <strong>{{ formatClock(report.workTime.endHour) }}</strong>
        <small v-if="report.workTime.endHourRange">
          {{ formatRange(report.workTime.endHourRange) }}
        </small>
      </div>
      <div>
        <span>{{ t('details.workTime.confidence') }}</span>
        <strong>{{ percentage(report.workTime.confidence) }}%</strong>
        <small>{{ t('details.workTime.samples', { count: report.workTime.sampleCount }) }}</small>
      </div>
      <div>
        <span>{{ t('details.workTime.method') }}</span>
        <strong class="text-value">{{ t(`details.workTime.methods.${report.workTime.detectionMethod}`) }}</strong>
        <small>{{ reliabilityLabel }}</small>
      </div>
    </div>

    <p v-if="workTimeSpan > 9" class="inline-warning">
      {{ t('details.workTime.capNotice', { hours: workTimeSpan.toFixed(1) }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportData, ReportWorkTime } from '../../../src/report/report-data'
import { useWebI18n } from '@/i18n'
import { formatClock, percentage } from '@/report/formatters'

const props = defineProps<{ report: ReportData }>()
const { t } = useWebI18n()

type FindingTone = 'neutral' | 'warning' | 'danger' | 'positive'

const findings = computed(() => {
  const items: Array<{ marker: string; tone: FindingTone; text: string }> = []
  const index = props.report.core.index996
  const indexTone: FindingTone = index > 100 ? 'danger' : index > 48 ? 'warning' : index <= 21 ? 'positive' : 'neutral'
  items.push({
    marker: index > 130 ? '!!' : index > 63 ? '!' : index <= 21 ? 'OK' : 'i',
    tone: indexTone,
    text: t('details.diagnostics.index', {
      rating: t(`rating.${props.report.core.rating}`),
      ratio: percentage(props.report.core.overTimeRatio),
    }),
  })

  const weekday = props.report.weekdayOvertime
  if (weekday?.peakDay && (weekday.peakCount || 0) > 20) {
    items.push({
      marker: (weekday.peakCount || 0) > 50 ? '!!' : '!',
      tone: (weekday.peakCount || 0) > 50 ? 'danger' : 'warning',
      text: t((weekday.peakCount || 0) > 50 ? 'details.diagnostics.weekdayHeavy' : 'details.diagnostics.weekdaySome', {
        day: t(`weekday.${weekday.peakDay}`),
        count: weekday.peakCount || 0,
      }),
    })
  }

  const weekend = props.report.weekendOvertime
  if (weekend) {
    const days = weekend.realOvertimeDays
    const key =
      days > 15
        ? 'details.diagnostics.weekendSevere'
        : days > 8
          ? 'details.diagnostics.weekendWarn'
          : days > 0
            ? 'details.diagnostics.weekendOccasional'
            : weekend.casualFixDays > 0
              ? 'details.diagnostics.weekendNone'
              : null
    if (key) {
      items.push({
        marker: days > 15 ? '!!' : days > 8 ? '!' : 'i',
        tone: days > 15 ? 'danger' : days > 8 ? 'warning' : 'neutral',
        text: t(key, { days: days || weekend.casualFixDays }),
      })
    }
  }

  const lateNight = props.report.lateNight
  if (lateNight) {
    const totalLateNight = lateNight.midnight + lateNight.dawn
    if (totalLateNight > 0) {
      const key =
        totalLateNight > 20
          ? 'details.diagnostics.lateFrequent'
          : totalLateNight > 10
            ? 'details.diagnostics.latePresent'
            : 'details.diagnostics.lateOccasional'
      items.push({
        marker: totalLateNight > 20 ? '!!' : totalLateNight > 10 ? '!' : 'i',
        tone: totalLateNight > 20 ? 'danger' : totalLateNight > 10 ? 'warning' : 'neutral',
        text: t(key, { days: totalLateNight }),
      })
    }
    if (lateNight.midnightRate > 10) {
      items.push({
        marker: '!!',
        tone: 'danger',
        text: t('details.diagnostics.lateRisk', { rate: percentage(lateNight.midnightRate) }),
      })
    }
  }
  return items
})

const workTimeSpan = computed(() => {
  const workTime = props.report.workTime
  return workTime ? workTime.endHour - workTime.startHour : 0
})
const reliabilityLabel = computed(() =>
  t(props.report.workTime?.isReliable ? 'details.workTime.reliable' : 'details.workTime.unreliable')
)

function formatRange(range: NonNullable<ReportWorkTime['startHourRange']>): string {
  return t('details.workTime.range', { start: formatClock(range.startHour), end: formatClock(range.endHour) })
}
</script>
