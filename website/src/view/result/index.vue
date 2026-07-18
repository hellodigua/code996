<template>
  <div class="result">
    <div class="top-bar">
      <div class="wrapper">
        <span class="button back" @click="goBack">{{ t('common.back') }}</span>
        <h1>{{ t('nav.title') }}</h1>
      </div>
    </div>
    <div class="main wrapper">
      <div class="top-result container">
        <h1 v-if="result.isStandard">{{ t('result.title') }}</h1>
        <div class="result-line">
          <div class="score-box" v-if="result.isStandard">
            <div class="score-number">{{ result.index996 }}</div>
            <!-- <div class="subtitle">{{ result.index996Str }}</div> -->
          </div>
          <div class="content">
            <p v-if="result.isStandard">
              {{ t('result.workingType') }}
              <span class="p1">{{ result.workingType }}</span>
              <span class="p2">({{ result.workingTypeStr }})</span>
            </p>
            <p v-if="result.isStandard">
              {{ t('result.overtimeRatio') }}
              <span class="p1">{{ result.overTimeRadio }}%</span>
              <span class="p2" v-if="result.index996 < 0">{{ t('result.notSaturated') }}</span>
            </p>
            <p v-if="!result.isStandard">
              <span v-if="result.totalCount <= 50">{{ t('result.lowCommit') }}</span>
              <span v-else>{{ t('result.openSource') }}</span>
            </p>
            <p>
              {{ t('result.totalCommits') }}
              <span class="p1">{{ result.totalCount }}</span>
            </p>
            <p>
              {{ t('result.analysisTime') }}
              <span class="p1">{{ result.timeStr }}</span>
            </p>
          </div>
        </div>
        <p class="exp" v-if="result.isStandard">
          {{ t('result.indexExplanation') }}
          <a @click="scrollTo">{{ t('result.seeTable') }}</a>
        </p>
      </div>
      <div class="content container">
        <div class="section">
          <div class="item">
            <h2>{{ t('result.charts.hourDistribution') }}</h2>
            <bar-chart :data="hourResult" />
          </div>
          <div class="item" v-if="result.isStandard">
            <h2>{{ t('result.charts.hourRatio') }}</h2>
            <pie-chart :data="workHourRadio" />
          </div>
        </div>
        <div class="section">
          <div class="item">
            <h2>{{ t('result.charts.dayDistribution') }}</h2>
            <bar-chart :data="weekResult" />
          </div>
          <div class="item" v-if="result.isStandard">
            <h2>{{ t('result.charts.dayRatio') }}</h2>
            <pie-chart :data="workWeekRadio" />
          </div>
        </div>
      </div>
      <h2 id="compare-table">{{ t('result.compareTable') }}</h2>
      <compare-table />
      <div class="container">
        <h2 class="title">{{ t('result.notice.title') }}</h2>
        <p>{{ t('result.notice.point1') }}</p>
        <p>{{ t('result.notice.point2') }}</p>
        <p>{{ t('result.notice.point3') }}</p>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { i18n } from '../../i18n'
import { TimeCount } from '../../typings'
import { router } from '../../router'
import BarChart from './components/BarChart.vue'
import PieChart from './components/PieChart.vue'
import CompareTable from './components/CompareTable.vue'
import { getResult, getRoutesMeta } from './core'
import { checkUrlQueryAndRedirect } from './core/url-helper'

const { t } = useI18n()

const hourResult = ref<TimeCount[]>([])
const weekResult = ref<TimeCount[]>([])
const workHourRadio = ref<any[]>([])
const workWeekRadio = ref<any[]>([])
const result = ref<any>({})

function init() {
  const { hourData, weekData, timeStr, totalCount } = getRoutesMeta()
  const { workingType, workingTypeStr, index996, index996Str, overTimeRadio, isStandard, workHourPl, workWeekPl } =
    getResult()

  hourResult.value = [...hourData]
  weekResult.value = [...weekData]
  workHourRadio.value = [...workHourPl]
  workWeekRadio.value = [...workWeekPl]

  result.value = {
    workingType,
    workingTypeStr,
    totalCount,
    timeStr,
    index996,
    index996Str,
    overTimeRadio,
    isStandard,
  }
}

const scrollTo = () => {
  const el = document.getElementById('compare-table')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

const goBack = () => {
  const currentLocale = i18n.global.locale.value
  const routeName = currentLocale === 'zh-CN' ? 'zh-index' : 'en-index'
  router.push({ name: routeName })
}

checkUrlQueryAndRedirect()

onMounted(() => {
  init()
})
</script>
