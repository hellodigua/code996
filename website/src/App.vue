<template>
  <div class="app">
    <github-corner />
    <language-switcher />
    <div class="app-container">
      <router-view></router-view>
    </div>
    <common-footer />
  </div>
</template>

<script setup lang="ts">
import CommonFooter from './public/components/CommonFooter.vue'
import GithubCorner from './public/components/GithubCorner.vue'
import LanguageSwitcher from './public/components/LanguageSwitcher.vue'
</script>

<style lang="scss">
@use '@/public/styles/index.scss';
</style>
