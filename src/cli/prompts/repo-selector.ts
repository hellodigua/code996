import chalk from 'chalk'
import { RepoInfo } from '../../types/git-types'

/**
 * 交互式仓库选择器
 * @param repos 候选仓库列表
 * @returns 用户选择的仓库列表
 */
export async function promptRepoSelection(repos: RepoInfo[]): Promise<RepoInfo[]> {
  if (repos.length === 0) {
    return []
  }

  if (repos.length === 1) {
    console.log(chalk.blue('✅ 仅发现 1 个仓库，默认选中。'))
    return repos
  }

  // 动态导入 @inquirer/prompts
  const { checkbox } = await import('@inquirer/prompts')

  const choices = repos.map((repo) => ({
    name: `${repo.name} (${repo.path})`,
    value: repo,
  }))

  const selected = await checkbox({
    message: '请选择需要分析的仓库（空格选择，回车确认）',
    choices,
    pageSize: Math.min(10, choices.length),
    validate: (answer) => {
      if (answer.length === 0) {
        return '请至少选择一个仓库'
      }
      return true
    },
  })

  return selected
}
