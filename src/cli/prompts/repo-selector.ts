import chalk from 'chalk'
import path from 'path'
import { RepoInfo } from '../../types/git-types'
import { t } from '../../i18n'

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
    console.log(chalk.blue(`✅ ${t('prompt.singleRepo')}`))
    return repos
  }

  // 动态导入 @inquirer/prompts
  const { checkbox } = await import('@inquirer/prompts')

  // 获取当前工作目录，用于计算相对路径
  const cwd = process.cwd()

  const choices = repos.map((repo) => {
    // 计算相对路径，如果无法计算则使用原路径
    let displayPath: string
    try {
      const relativePath = path.relative(cwd, repo.path)
      // 如果相对路径比绝对路径短，则使用相对路径，否则使用绝对路径
      displayPath = relativePath.length < repo.path.length ? relativePath : repo.path
      // 如果相对路径是空字符串，表示就是当前目录
      if (displayPath === '') {
        displayPath = '.'
      }
    } catch {
      displayPath = repo.path
    }

    return {
      name: `${chalk.bold(repo.name)} ${chalk.gray(`(${displayPath})`)}`,
      value: repo,
    }
  })

  const selected = await checkbox({
    message: t('prompt.message'),
    choices,
    pageSize: Math.min(10, choices.length),
    validate: (answer) => {
      if (answer.length === 0) {
        return t('prompt.validate')
      }
      return true
    },
  })

  return selected
}
