<template>
  <section v-if="timezone" class="report-section" data-testid="timezone-analysis">
    <div class="section-heading">
      <div>
        <p class="section-kicker">TIMEZONE</p>
        <h2>{{ t('details.timezone.title') }}</h2>
      </div>
      <p>
        {{ t(timezone.isCrossTimezone ? 'details.timezone.crossDetected' : 'details.timezone.singleDetected') }}
      </p>
    </div>
    <div class="evidence-ledger context-detail-ledger">
      <div>
        <span>{{ t('details.timezone.dominant') }}</span>
        <strong class="text-value">{{ timezone.dominantTimezone || '–' }}</strong>
        <small>{{ percentage(timezone.dominantRatio * 100) }}%</small>
      </div>
      <div>
        <span>{{ t('details.timezone.crossRatio') }}</span>
        <strong>{{ percentage(timezone.crossTimezoneRatio * 100) }}%</strong>
      </div>
      <div>
        <span>{{ t('details.timezone.sleepRatio') }}</span>
        <strong>{{ percentage(timezone.sleepPeriodRatio * 100) }}%</strong>
      </div>
      <div>
        <span>{{ t('details.timezone.confidence') }}</span>
        <strong>{{ percentage(timezone.confidence) }}%</strong>
      </div>
    </div>
    <div v-if="timezone.timezoneGroups?.length" class="timezone-groups">
      <div v-for="group in timezone.timezoneGroups" :key="group.offset">
        <span>{{ group.offset }}</span>
        <span class="row-track"><i :style="{ width: `${group.ratio * 100}%` }" /></span>
        <strong>{{ group.count }} / {{ percentage(group.ratio * 100) }}%</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportData } from '../../../src/report/report-data'
import { useWebI18n } from '@/i18n'
import { percentage } from '@/report/formatters'

const props = defineProps<{ report: ReportData }>()
const { t } = useWebI18n()
const timezone = computed(() => props.report.timezone)
</script>
