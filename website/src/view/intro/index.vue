<template>
  <div class="intro">
    <div class="banner">
      <div class="banner-wrapper wrapper">
        <p class="logo-text">{{ t('intro.title') }}</p>
        <p class="p2">
          {{ t('intro.subtitle') }}
        </p>
        <span class="btn" @click="previewDemo">{{ t('common.viewDemo') }}</span>
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
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { i18n } from '../../i18n'
import { router } from '../../router'

const { t } = useI18n()
const command = 'npx code996'
const copyStatus = ref<'copy' | 'copied' | 'copyFailed'>('copy')

const copyCommand = async () => {
  try {
    await navigator.clipboard.writeText(command)
    copyStatus.value = 'copied'
  } catch {
    copyStatus.value = 'copyFailed'
  }

  window.setTimeout(() => {
    copyStatus.value = 'copy'
  }, 2000)
}

const previewDemo = () => {
  const currentLocale = i18n.global.locale.value
  const routeName = currentLocale === 'zh-CN' ? 'zh-result' : 'en-result'

  router.push({
    name: routeName,
    query: {
      time: '2021-01-01_2022-01-01',
      hour: '5_08,19_09,44_10,51_11,7_13,63_14,71_15,49_16,75_17,34_18,15_19,4_20,1_21,1_22',
      week: '50_1,119_2,108_3,96_4,65_5,1_6',
    },
  })
}
</script>
