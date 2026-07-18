<template>
  <div class="table-box">
    <table class="container table">
      <thead>
        <tr>
          <th class="l">{{ t('result.table.timeType') }}</th>
          <th v-for="item in tableData" :class="getActive(item.index996)">{{ item.type }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in tableConfig">
          <td class="l">{{ row.label }}</td>
          <td v-for="item in tableData" :class="getActive(item.index996)">{{ item[row.key] }}{{ row.unit }}</td>
        </tr>
      </tbody>
    </table>
    <p class="tips">{{ t('result.table.highlightTip') }}</p>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getTableCore } from '../core/table'

const { t } = useI18n()
const { tableConfig, tableData, index996, isStandard } = getTableCore()

const getActive = (index: number) => {
  return index996 === index && isStandard ? 'active' : ''
}
</script>
<style lang="scss" scoped></style>
