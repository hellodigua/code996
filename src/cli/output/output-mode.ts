import type { AnalyzeOptions } from '../../types/git-types'

export type OutputMode = 'terminal' | 'json' | 'md'

export interface LocalWebReportBehavior {
  generate: boolean
  open: boolean
}

/**
 * 统一决定主要报告出口。默认仍输出传统终端报告，显式参数才切换主要格式。
 */
export function resolveOutputMode(options: AnalyzeOptions): OutputMode {
  if (options.json) return 'json'
  if (options.md) return 'md'
  return 'terminal'
}

/**
 * 默认终端模式会附带保存 HTML，但不打开浏览器；结构化输出保持无额外文件副作用。
 */
export function resolveLocalWebReportBehavior(options: AnalyzeOptions): LocalWebReportBehavior {
  const outputMode = resolveOutputMode(options)
  if (outputMode === 'json' || outputMode === 'md') return { generate: false, open: false }

  return {
    generate: true,
    open: options.open === true,
  }
}
