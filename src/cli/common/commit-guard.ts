import chalk from 'chalk'
import { GitCollector } from '../../git/git-collector'
import { GitLogOptions } from '../../types/git-types'

/** 校验样本体量是否足够，避免在 commit 太少时继续分析 */
export async function ensureCommitSamples(
  collector: GitCollector,
  gitOptions: GitLogOptions,
  minCount: number,
  sceneLabel: string
): Promise<boolean> {
  const commitCount = await collector.countCommits(gitOptions)

  if (commitCount >= minCount) {
    return true
  }

  console.log(chalk.yellow(' ⚠️ 样本不足 '))
  console.log(
    chalk.yellow(`当前${sceneLabel}范围内仅检测到 ${commitCount} 个 commit，低于可靠分析所需的 ${minCount} 个。`)
  )
  console.log(chalk.yellow('建议：扩大时间范围、取消作者过滤，或积累更多提交后再试。'))

  return false
}
