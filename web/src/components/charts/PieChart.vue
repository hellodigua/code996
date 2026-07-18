<template>
  <BaseChart :data="data" chart-type="Pie" :label="label" />
</template>

<script setup lang="ts">
import BaseChart from './BaseChart.vue'
import type { ChartData } from '@/types'

defineProps<{ data: ChartData[]; label: string }>()
</script>
