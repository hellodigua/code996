<template>
  <BaseChart :data="data" chartType="Bar" :options="chartOptions" />
</template>
<script setup lang="ts">
import { ChartData } from '../../../typings'
import BaseChart from './BaseChart.vue'

const props = defineProps({
  data: {
    type: Array as () => ChartData[],
    default: () => [],
  },
})

const chartOptions = {
  backgroundColor: '#212121',
  strokeColor: '#fff',
  unxkcdify: false,
}
</script>
<style lang="scss" scoped></style>
