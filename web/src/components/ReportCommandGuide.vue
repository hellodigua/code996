<template>
  <section class="report-command-guide" aria-labelledby="report-command-title">
    <h3 id="report-command-title">{{ t('notices.commandsTitle') }}</h3>

    <details class="report-command-details report-options-details">
      <summary id="report-options-title">
        <span aria-hidden="true">01</span><strong>{{ t('notices.optionsTitle') }}</strong>
      </summary>
      <div class="report-command-content">
        <p>{{ t('notices.optionsDescription') }}</p>
        <ul class="report-option-list">
          <li v-for="item in commandOptions" :key="item.command">
            <code>{{ item.command }}</code>
            <span>{{ t(item.descriptionKey) }}</span>
          </li>
        </ul>
      </div>
    </details>

    <details class="report-command-details report-recipes-details">
      <summary id="report-recipes-title">
        <span aria-hidden="true">02</span><strong>{{ t('notices.recipesTitle') }}</strong>
      </summary>
      <div class="report-command-content">
        <p>{{ t('notices.recipesDescription') }}</p>
        <ul class="report-recipe-list">
          <li v-for="item in commandRecipes" :key="item.command">
            <div class="report-recipe-command">
              <code>{{ item.command }}</code>
              <button
                type="button"
                :class="`is-${copyStatus(item.command)}`"
                :aria-label="t('notices.copyCommand', { command: item.command })"
                aria-live="polite"
                @click="copyCommand(item.command)"
              >
                {{ copyButtonText(item.command) }}
              </button>
            </div>
            <p>{{ t(item.descriptionKey) }}</p>
          </li>
        </ul>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useWebI18n } from '@/i18n'

type CopyStatus = 'idle' | 'copied' | 'failed'

const { t } = useWebI18n()
const commandOptions = [
  { command: 'code996 [paths...] [options]', descriptionKey: 'notices.options.usage' },
  { command: 'code996 help', descriptionKey: 'notices.options.help' },
  { command: '-v, --version', descriptionKey: 'notices.options.version' },
  { command: '-s, --since <date>', descriptionKey: 'notices.options.since' },
  { command: '-u, --until <date>', descriptionKey: 'notices.options.until' },
  { command: '-y, --year <year>', descriptionKey: 'notices.options.year' },
  { command: '--all-time', descriptionKey: 'notices.options.allTime' },
  { command: '--self', descriptionKey: 'notices.options.self' },
  { command: '-H, --hours <range>', descriptionKey: 'notices.options.hours' },
  { command: '--half-hour', descriptionKey: 'notices.options.halfHour' },
  { command: '--ignore-author <regex>', descriptionKey: 'notices.options.ignoreAuthor' },
  { command: '--ignore-msg <regex>', descriptionKey: 'notices.options.ignoreMsg' },
  { command: '--timezone <offset>', descriptionKey: 'notices.options.timezone' },
  { command: '--cn', descriptionKey: 'notices.options.cn' },
  { command: '--skip-user-analysis', descriptionKey: 'notices.options.skipUserAnalysis' },
  { command: '--max-users <number>', descriptionKey: 'notices.options.maxUsers' },
  { command: '--lang <locale>', descriptionKey: 'notices.options.lang' },
  { command: '--open', descriptionKey: 'notices.options.open' },
  { command: '--json', descriptionKey: 'notices.options.json' },
  { command: '--md', descriptionKey: 'notices.options.md' },
  { command: '--output [path]', descriptionKey: 'notices.options.output' },
] as const

const commandRecipes = [
  { command: 'npx code996', descriptionKey: 'notices.recipes.current' },
  { command: 'npx code996 --open', descriptionKey: 'notices.recipes.open' },
  { command: 'npx code996 "/path/to/repo" --open', descriptionKey: 'notices.recipes.repo' },
  { command: 'npx code996 -y 2025 --open', descriptionKey: 'notices.recipes.year' },
  { command: 'npx code996 --all-time --open', descriptionKey: 'notices.recipes.allTime' },
  { command: 'npx code996 --self -y 2025 --open', descriptionKey: 'notices.recipes.self' },
  { command: 'npx code996 --hours 9-18 -y 2025 --open', descriptionKey: 'notices.recipes.hours' },
  {
    command: 'npx code996 "/path/to/repo-a" "/path/to/repo-b" -y 2025 --open',
    descriptionKey: 'notices.recipes.multi',
  },
  { command: 'npx code996 -y 2025 --json --output report.json', descriptionKey: 'notices.recipes.json' },
  { command: 'npx code996 -y 2025 --md --output report.md', descriptionKey: 'notices.recipes.md' },
] as const

const copyFeedback = ref<{ command: string; status: CopyStatus }>({ command: '', status: 'idle' })
let resetTimer: ReturnType<typeof setTimeout> | undefined

function copyStatus(command: string): CopyStatus {
  return copyFeedback.value.command === command ? copyFeedback.value.status : 'idle'
}

function copyButtonText(command: string): string {
  const status = copyStatus(command)
  if (status === 'copied') return t('notices.copied')
  if (status === 'failed') return t('notices.copyFailed')
  return t('notices.copy')
}

/** file:// 页面可能无法使用 Clipboard API，因此保留选区复制作为降级方案。 */
function copyWithSelection(command: string): boolean {
  const activeElement = document.activeElement
  const textarea = document.createElement('textarea')
  textarea.value = command
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
    if (activeElement instanceof HTMLElement) activeElement.focus()
  }
}

async function copyCommand(command: string): Promise<void> {
  let copied = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(command)
      copied = true
    }
  } catch {
    copied = false
  }

  if (!copied) copied = copyWithSelection(command)
  copyFeedback.value = { command, status: copied ? 'copied' : 'failed' }

  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    copyFeedback.value = { command: '', status: 'idle' }
  }, 1800)
}

onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer)
})
</script>
