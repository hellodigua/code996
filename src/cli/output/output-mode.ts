import type { AnalyzeOptions } from '../../types/git-types'

export type OutputMode = 'terminal' | 'web' | 'json' | 'md'

/**
 * 统一决定报告出口。默认始终输出传统终端报告，只有显式参数才切换格式，
 * 避免在 SSH、CI 或 AI 编程工具中意外创建文件并打开浏览器。
 */
export function resolveOutputMode(options: AnalyzeOptions): OutputMode {
  if (options.json) return 'json'
  if (options.md) return 'md'
  if (options.web) return 'web'
  return 'terminal'
}
