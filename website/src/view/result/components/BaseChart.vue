<template>
  <svg class="chart" ref="chartRef"></svg>
</template>
<script setup lang="ts">
import { ref, onMounted, nextTick, defineProps, defineExpose } from 'vue'
import chartXkcd from 'chart.xkcd'
import { ChartData } from '../../../typings'

const props = defineProps({
  data: {
    type: Array as () => ChartData[],
    default: () => [],
  },
  chartType: {
    type: String as () => 'Bar' | 'Pie',
    required: true,
  },
  options: {
    type: Object,
    default: () => ({
      backgroundColor: '#212121',
      strokeColor: '#fff',
    }),
  },
})

const chartRef = ref(null)
let chartInstance = null

function init() {
  if (!chartRef.value) return

  const ChartConstructor = chartXkcd[props.chartType]
  if (!ChartConstructor) {
    console.error(`图表类型 ${props.chartType} 不存在`)
    return
  }

  chartInstance = new ChartConstructor(chartRef.value, {
    data: {
      labels: props.data.map((item: ChartData) => item.time),
      datasets: [
        {
          data: props.data.map((item: ChartData) => item.count),
        },
      ],
    },
    options: props.options,
  })
}

onMounted(() => {
  nextTick(() => {
    init()
  })
})

defineExpose({
  chartInstance,
})
</script>
<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
