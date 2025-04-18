<template>
  <svg class="chart" ref="chartRef"></svg>
</template>
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, defineProps, defineExpose } from 'vue'
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

  // 确保在创建新实例前清理旧实例
  cleanup()

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

// 清理图表实例
function cleanup() {
  if (chartInstance) {
    // 清理图表实例的引用
    chartInstance = null

    // 清理DOM内容，确保没有残留的SVG元素
    if (chartRef.value) {
      while (chartRef.value.firstChild) {
        chartRef.value.removeChild(chartRef.value.firstChild)
      }
    }
  }
}

onMounted(() => {
  nextTick(() => {
    init()
  })
})

// 在组件卸载前清理资源
onBeforeUnmount(() => {
  cleanup()
})

defineExpose({
  chartInstance,
  init, // 暴露init方法，允许外部手动刷新图表
  cleanup, // 暴露cleanup方法，允许外部手动清理
})
</script>
<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
