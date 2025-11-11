import chalk from 'chalk'
import { GitCollector } from '../../git/git-collector'
import { AnalyzeOptions } from '../index'
import { GitLogOptions } from '../../types/git-types'

export interface BuiltAuthorFilter {
  pattern?: string
  infoLines: string[]
}

/**
 * 构建作者过滤正则（支持 --self / --author / --exclude-authors 组合）
 * 逻辑原则：
 * 1. 若提供 --author，则按名称或邮箱模糊匹配，可能匹配多个作者。
 * 2. 若仅提供 --self，则使用当前 git 用户。
 * 3. 若提供 --exclude-authors，则排除匹配到的作者，再对剩余作者构建 OR 模式。
 * 4. 同时使用 --author 与 --exclude-authors 时，仅对匹配到的作者执行排除。
 * 5. 若排除后无剩余作者，给出错误提示并退出。
 */
export async function buildAuthorFilter(
  collector: GitCollector,
  path: string,
  since: string | undefined,
  until: string | undefined,
  options: AnalyzeOptions
): Promise<BuiltAuthorFilter> {
  const infoLines: string[] = []

  // 如果没有任何过滤相关选项，直接返回
  if (!options.self && !options.author && !options.excludeAuthors) {
    return { pattern: undefined, infoLines }
  }

  // 获取全部作者（受时间范围限制，减少无关作者）
  const authorCollectOpts: GitLogOptions = {
    path,
    since,
    until,
    silent: true,
    authorPattern: undefined,
  }
  const allAuthors = await collector.getAllAuthors(authorCollectOpts)

  // 构建匹配函数（名称或邮箱大小写不敏感包含）
  const matchesKeyword = (authorValue: string, keyword: string) =>
    authorValue.toLowerCase().includes(keyword.toLowerCase())

  // 处理 --self 优先（若同时给出 --author，以 --author 为准并提示）
  let includedAuthors: Array<{ name: string; email: string }> = []

  if (options.author) {
    const keyword = options.author.trim().toLowerCase()
    includedAuthors = allAuthors.filter(
      (a) => matchesKeyword(a.name, keyword) || matchesKeyword(a.email, keyword)
    )

    if (includedAuthors.length === 0) {
      throw new Error(`未找到匹配作者: ${options.author}`)
    }
    infoLines.push(
      chalk.blue('🙋 作者过滤(匹配结果):') +
        ' ' +
        includedAuthors.map((a) => `${a.name} <${a.email}>`).join(', ')
    )

    if (options.self) {
      infoLines.push(chalk.gray('提示: 已同时指定 --self 与 --author，已使用 --author 优先。'))
    }
  } else if (options.self) {
    // 单纯 --self
    try {
      const selfInfo = await collector.resolveSelfAuthor(path)
      includedAuthors = allAuthors.filter(
        (a) => a.email === selfInfo.displayLabel.split('<')[1]?.replace('>', '') || a.name === selfInfo.displayLabel
      )
      // 若无法从列表中匹配，直接使用当前用户信息
      if (includedAuthors.length === 0) {
        includedAuthors = [{ name: selfInfo.displayLabel, email: selfInfo.pattern }]
      }
      infoLines.push(chalk.blue('🙋 作者过滤:') + ' ' + selfInfo.displayLabel)
    } catch (e) {
      throw new Error('启用 --self 需要配置 git user.name 或 user.email')
    }
  } else {
    // 无 --self / --author，仅有 --exclude-authors
    includedAuthors = [...allAuthors]
    infoLines.push(chalk.blue('🙋 作者过滤: 全部作者（应用排除后）'))
  }

  // 处理排除逻辑
  if (options.excludeAuthors) {
    const excludes = options.excludeAuthors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (excludes.length > 0) {
      const beforeCount = includedAuthors.length
      includedAuthors = includedAuthors.filter(
        (a) => !excludes.some((ex) => matchesKeyword(a.name, ex) || matchesKeyword(a.email, ex))
      )
      const removed = beforeCount - includedAuthors.length
      infoLines.push(
        chalk.blue('🚫 排除作者:') + ' ' + excludes.join(', ') + chalk.gray(` (已移除 ${removed} 人)`) +
          (removed === 0 ? chalk.gray(' (无匹配)') : '')
      )
    }
  }

  if (includedAuthors.length === 0) {
    throw new Error('作者过滤后无剩余提交者，无法继续分析')
  }

  // 构建 OR 正则：使用邮箱保证唯一性；若邮箱为空则回退名称
  const escape = (source: string) => source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = includedAuthors.map((a) => escape(a.email || a.name)).filter(Boolean)
  const pattern = parts.length === 1 ? parts[0] : parts.join('|')

  return {
    pattern,
    infoLines,
  }
}
