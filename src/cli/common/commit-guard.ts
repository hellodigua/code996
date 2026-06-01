import chalk from 'chalk'
import { GitCollector } from '../../git/git-collector'
import { GitLogOptions } from '../../types/git-types'
import { t } from '../../i18n'

/** 校验样本体量是否足够，避免在 commit 太少时继续分析 */
export async function ensureCommitSamples(
  collector: GitCollector,
  gitOptions: GitLogOptions,
  minCount: number,
  sceneLabel: string,
  silent = false
): Promise<boolean> {
  const commitCount = await collector.countCommits(gitOptions)

  if (commitCount >= minCount) {
    return true
  }

  if (!silent) {
    console.log(chalk.yellow(t('guard.title')))
    console.log(chalk.yellow(t('guard.message', { scene: sceneLabel, count: commitCount, min: minCount })))
    console.log(chalk.yellow(t('guard.suggestion')))
  }

  return false
}
