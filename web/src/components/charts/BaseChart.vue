<template>
  <div ref="chartViewport" class="chart-viewport">
    <svg ref="chartElement" class="chart" role="img" :aria-label="label" />
  </div>
</template>

<script setup lang="ts">
import chartXkcd from 'chart.xkcd'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ChartData } from '@/types'

const props = withDefaults(
  defineProps<{
    data: ChartData[]
    chartType: 'Bar' | 'Pie'
    label: string
    wide?: boolean
    options?: {
      backgroundColor?: string
      strokeColor?: string
      unxkcdify?: boolean
    }
  }>(),
  {
    data: () => [],
    options: () => ({
      backgroundColor: '#2a2a2a',
      strokeColor: '#f2f2ee',
    }),
    wide: false,
  }
)

const chartViewport = ref<HTMLElement | null>(null)
const chartElement = ref<SVGElement | null>(null)
let resizeObserver: ResizeObserver | undefined
let lastWidth = 0

const createChart = (ChartConstructor: typeof chartXkcd.Bar, element: SVGElement) => {
  new ChartConstructor(element, {
    data: {
      labels: props.data.map((item) => item.time),
      datasets: [{ data: props.data.map((item) => item.count) }],
    },
    options: props.options,
  })
}

const renderChart = () => {
  if (!chartElement.value || !chartViewport.value) return

  const width = chartViewport.value.clientWidth
  if (width <= 0) return
  lastWidth = width

  const ChartConstructor = chartXkcd[props.chartType]
  if (!props.wide) {
    createChart(ChartConstructor, chartElement.value)
    return
  }

  const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
  const targetHeight = Math.min(400, Math.max(260, Math.round(width / 2.6)))
  let heightOverridden = false

  try {
    // chart.xkcd 没有高度参数，只会读取 window.innerHeight。构造期间临时提供目标高度，
    // 让库真正按宽屏尺寸重算坐标，而不是用 CSS 压缩已经生成的文字和线条。
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: targetHeight,
    })
    heightOverridden = true
  } catch {
    // 极少数环境不允许覆盖该只读属性，此时回退到库的自然比例，至少保证内容不失真。
  }

  try {
    createChart(ChartConstructor, chartElement.value)
  } finally {
    if (heightOverridden) {
      if (originalInnerHeight) {
        Object.defineProperty(window, 'innerHeight', originalInnerHeight)
      } else {
        Reflect.deleteProperty(window, 'innerHeight')
      }
    }
  }
}

onMounted(async () => {
  await nextTick()
  renderChart()

  if (typeof ResizeObserver === 'undefined' || !chartViewport.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    // chart.xkcd 只在初始化时读取父容器宽度，布局变化后需要主动重绘，避免 SVG 被卡片裁切。
    if (Math.abs(entry.contentRect.width - lastWidth) > 1) renderChart()
  })
  resizeObserver.observe(chartViewport.value)
})

watch(
  () => [props.data, props.options, props.wide],
  async () => {
    await nextTick()
    renderChart()
  },
  { deep: true }
)

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>
