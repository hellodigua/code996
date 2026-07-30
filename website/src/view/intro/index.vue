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
          <div v-for="item in usageCommands" :key="item.key" class="usage-method">
            <p class="usage-method-title">{{ item.title }}</p>
            <p>{{ item.tip }}</p>
            <div v-for="snippet in item.snippets" :key="snippet.key" class="usage-snippet">
              <div class="overflow-x command-line" :class="{ 'command-line--prompt': snippet.key === 'prompt' }">
                <pre>{{ snippet.content }}</pre>
                <button
                  type="button"
                  :aria-label="`${item.title} ${t(`intro.howToUse.${copyStatus[snippet.key]}`)}`"
                  :title="t(`intro.howToUse.${copyStatus[snippet.key]}`)"
                  @click="copyCommand(snippet.key, snippet.content)"
                >
                  <svg v-if="copyStatus[snippet.key] === 'copied'" aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                  <svg v-else aria-hidden="true" viewBox="0 0 24 24">
                    <rect x="8" y="8" width="11" height="11" rx="2" />
                    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0 2 2v8a2 2 0 0 0 2 2h2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
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
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { i18n } from '../../i18n'
import { copyText } from '../../utils/clipboard'

const { t } = useI18n()
type CommandKey = 'cli' | 'prompt'
type CopyStatus = 'copy' | 'copied' | 'copyFailed'
interface UsageSnippet {
  key: CommandKey
  content: string
}
interface UsageMethod {
  key: 'cli' | 'ai'
  title: string
  tip: string
  snippets: UsageSnippet[]
}

const usageCommands = computed<UsageMethod[]>(() => [
  {
    key: 'cli' as const,
    title: t('intro.howToUse.cliTitle'),
    tip: t('intro.howToUse.cliTip'),
    snippets: [{ key: 'cli' as const, content: 'npx code996' }],
  },
  {
    key: 'ai' as const,
    title: t('intro.howToUse.skillTitle'),
    tip: t('intro.howToUse.promptTip'),
    snippets: [
      {
        key: 'prompt' as const,
        content: t('intro.howToUse.prompt'),
      },
    ],
  },
])
const copyStatus = reactive<Record<CommandKey, CopyStatus>>({
  cli: 'copy',
  prompt: 'copy',
})
const previewUrl = computed(() => {
  const language = i18n.global.locale.value === 'zh-CN' ? 'zh-CN' : 'en'
  return `./preview/?lang=${language}&from=website`
})

const copyCommand = async (key: CommandKey, command: string) => {
  copyStatus[key] = (await copyText(command)) ? 'copied' : 'copyFailed'

  window.setTimeout(() => {
    copyStatus[key] = 'copy'
  }, 2000)
}
</script>
