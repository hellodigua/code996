<template>
  <section v-if="dimensions" class="report-section" data-testid="classification-evidence">
    <div class="section-heading classification-heading">
      <div>
        <p class="section-kicker">CLASSIFICATION</p>
        <h2>{{ t('details.classification.title') }}</h2>
      </div>
      <p>{{ t('details.classification.description') }}</p>
    </div>
    <div class="evidence-ledger context-detail-ledger">
      <div>
        <span>{{ t('details.classification.regularity') }}</span>
        <strong>{{ dimensions.workTimeRegularity.score }}/100</strong>
      </div>
      <div>
        <span>{{ t('details.classification.weekend') }}</span>
        <strong>{{ percentage(dimensions.weekendActivity.ratio * 100) }}%</strong>
      </div>
      <div>
        <span>{{ t('details.classification.moonlighting') }}</span>
        <strong class="text-value">
          {{ t(dimensions.moonlightingPattern.isActive ? 'common.detected' : 'common.notDetected') }}
        </strong>
        <small>
          {{
            t('details.classification.nightRatio', {
              value: percentage(dimensions.moonlightingPattern.nightRatio * 100),
            })
          }}
        </small>
      </div>
      <div>
        <span>{{ t('details.classification.contributorCount') }}</span>
        <strong>{{ dimensions.contributorsCount.count }}</strong>
      </div>
    </div>
    <div v-if="dimensions.workTimeRegularity.details" class="classification-signals">
      <span v-for="signal in regularitySignals" :key="signal.key" :class="{ 'is-active': signal.active }">
        {{ signal.active ? '■' : '□' }} {{ t(`details.classification.signals.${signal.key}`) }}
      </span>
      <span>
        {{
          t('details.classification.eveningMorningRatio', {
            value: percentage(dimensions.moonlightingPattern.eveningToMorningRatio * 100),
          })
        }}
      </span>
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
const dimensions = computed(() => props.report.project?.dimensions)
const regularitySignals = computed(() => {
  const details = dimensions.value?.workTimeRegularity.details
  if (!details) return []
  return Object.entries(details).map(([key, active]) => ({ key, active }))
})
</script>
