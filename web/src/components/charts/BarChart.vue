<template>
  <BaseChart :data="data" chart-type="Bar" :label="label" :options="options" :wide="wide" />
</template>

<script setup lang="ts">
import BaseChart from './BaseChart.vue'
import type { ChartData } from '@/types'

withDefaults(defineProps<{ data: ChartData[]; label: string; wide?: boolean }>(), {
  wide: false,
})

const options = {
  backgroundColor: '#2a2a2a',
  strokeColor: '#f2f2ee',
  unxkcdify: false,
}
</script>
