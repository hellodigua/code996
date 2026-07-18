<template>
  <div class="footer">
    <div class="wrapper">
      <p>
        {{ t('common.switchMirror') }}
        <template v-for="item in mirrorList">
          <a :href="item.url">{{ item.label }}</a>
          <span>&nbsp;</span>
        </template>
      </p>
      <p>
        {{ t('common.madeWithLove') }}
        <a target="_blank" href="https://github.com/hellodigua">digua</a>
        <span>&nbsp;&nbsp;</span>
        <a target="_blank" href="https://github.com/hellodigua/code996">
          <img src="https://img.shields.io/github/stars/hellodigua/code996?style=social" alt="" />
        </a>
      </p>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

let url = window.location.href
let hash = window.location.hash

const mirrorList = [
  {
    host: 'github.io',
    url: `https://hellodigua.github.io/code996/${hash}`,
    label: 'GitHub',
  },
  {
    host: 'code996.vercel.app',
    url: `https://code996.vercel.app/${hash}`,
    label: 'Vercel',
  },
].filter((item) => !url.includes(item.host))
</script>
