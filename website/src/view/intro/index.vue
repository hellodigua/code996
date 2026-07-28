<template>
  <div class="intro">
    <div class="banner">
      <div class="banner-wrapper wrapper">
        <p class="logo-text">{{ t('intro.title') }}</p>
        <p class="p2">
          {{ t('intro.subtitle') }}
        </p>
        <a class="btn" :href="previewUrl">{{ t('common.viewDemo') }}</a>
      </div>
    </div>
    <div class="main wrapper">
      <div class="item">
        <div class="left">
          <div class="icon-mark">></div>
        </div>
        <article class="markdown-body">
          <div class="p1">{{ t('intro.howToUse.title') }}</div>
          <ul>
            <p>{{ t('intro.howToUse.nodeJsTip') }}</p>
            <div class="overflow-x command-line">
              <pre>{{ command }}</pre>
              <button
                type="button"
                :aria-label="t(`intro.howToUse.${copyStatus}`)"
                :title="t(`intro.howToUse.${copyStatus}`)"
                @click="copyCommand"
              >
                <svg v-if="copyStatus === 'copied'" aria-hidden="true" viewBox="0 0 24 24">
                  <path d="m5 12 4 4L19 6" />
                </svg>
                <svg v-else aria-hidden="true" viewBox="0 0 24 24">
                  <rect x="8" y="8" width="11" height="11" rx="2" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
              </button>
            </div>
          </ul>
        </article>
      </div>
      <div class="item">
        <div class="left">
          <div class="icon-mark">#</div>
        </div>
        <article class="markdown-body">
          <div class="p1">{{ t('intro.howItWorks.title') }}</div>
          <p>{{ t('intro.howItWorks.step1') }}</p>
          <p>{{ t('intro.howItWorks.step2') }}</p>
          <p>{{ t('intro.howItWorks.step3') }}</p>
        </article>
      </div>
      <div class="item">
        <div class="left">
          <div class="icon-mark">@</div>
        </div>
        <article class="markdown-body">
          <div class="p1">{{ t('intro.whatIsItFor.title') }}</div>
          <p>{{ t('intro.whatIsItFor.intro') }}</p>
          <p>{{ t('intro.whatIsItFor.point1') }}</p>
          <p>{{ t('intro.whatIsItFor.point2') }}</p>
          <p>{{ t('intro.whatIsItFor.point3') }}</p>
        </article>
      </div>
      <div class="item">
        <div class="left">
          <div class="icon-mark">@</div>
        </div>
        <article class="markdown-body">
          <div class="p1">{{ t('intro.safety.title') }}</div>
          <p>{{ t('intro.safety.point1') }}</p>
          <p>{{ t('intro.safety.point2') }}</p>
          <p>
            {{ t('intro.safety.point3') }}
            <a href="https://github.com/hellodigua/code996">{{ t('intro.safety.point3Link') }}</a>
            {{ t('intro.safety.point3End') }}
          </p>
        </article>
      </div>
      <div class="item">
        <div class="left">
          <div class="icon-mark">Q</div>
        </div>
        <article class="markdown-body">
          <div class="p1">{{ t('intro.faq.title') }}</div>
          <p class="p2">{{ t('intro.faq.q1') }}</p>
          <ul>
            <p>{{ t('intro.faq.q1a1') }}</p>
            <p>{{ t('intro.faq.q1a2') }}</p>
          </ul>
          <p class="p2">{{ t('intro.faq.q2') }}</p>
          <ul>
            <li>{{ t('intro.faq.q2a1') }}</li>
            <li>{{ t('intro.faq.q2a2') }}</li>
            <li>{{ t('intro.faq.q2a3') }}</li>
            <li>{{ t('intro.faq.q2a4') }}</li>
          </ul>
        </article>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { i18n } from '../../i18n'
import { copyText } from '../../utils/clipboard'

const { t } = useI18n()
const command = 'npx code996'
const copyStatus = ref<'copy' | 'copied' | 'copyFailed'>('copy')
const previewUrl = computed(() => {
  const language = i18n.global.locale.value === 'zh-CN' ? 'zh-CN' : 'en'
  return `./preview/?lang=${language}&from=website`
})

const copyCommand = async () => {
  copyStatus.value = (await copyText(command)) ? 'copied' : 'copyFailed'

  window.setTimeout(() => {
    copyStatus.value = 'copy'
  }, 2000)
}
</script>
