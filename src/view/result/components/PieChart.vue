<template>
  <svg class="bar-chart" ref="bar"></svg>
</template>
<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import chartXkcd from 'chart.xkcd'
import { ChartData } from '../../../typings'

const props = defineProps({
  data: {
    type: Array as () => ChartData[],
    default: () => [],
  },
})

const bar = ref(null)

function init() {
  new chartXkcd.Pie(bar.value, {
    data: {
      labels: props.data.map((item: ChartData) => item.time),
      datasets: [
        {
          data: props.data.map((item: ChartData) => item.count),
        },
      ],
    },
    options: {
      backgroundColor: '#212121',
      strokeColor: '#fff',
    },
  })
}

onMounted(() => {
  nextTick(() => {
    init()
  })
})
</script>
<style lang="scss" scoped></style>
