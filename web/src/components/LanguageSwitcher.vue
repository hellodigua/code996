<template>
  <button
    class="language-switcher"
    type="button"
    data-testid="language-switcher"
    :aria-label="t('common.language')"
    @click="toggleLocale"
  >
    {{ languageLabel }}
  </button>
</template>

<script setup lang="ts">
import { useWebI18n } from '@/i18n'

const { languageLabel, t, toggleLocale } = useWebI18n()
</script>
