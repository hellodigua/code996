import { GitLogOptions } from '../../types/git-types'
import { BaseCollector } from './base-collector'

/**
 * 参与者与元数据统计采集器
 * 负责统计提交总数、参与人数、首末提交日期等
 */
export class ContributorCollector extends BaseCollector {
  /**
   * 统计符合过滤条件的 commit 数量
   * 注意：由于需要支持作者排除过滤，这里使用 log 而不是 rev-list
   */
  async countCommits(options: GitLogOptions): Promise<number> {
    const { path } = options

    // 如果没有作者排除过滤，使用更高效的 rev-list
    if (!options.ignoreAuthor) {
      const args = ['rev-list', '--count', 'HEAD']
      this.applyCommonFilters(args, options)

      const output = await this.execGitCommand(args, path)
      const count = parseInt(output.trim(), 10)

      return isNaN(count) ? 0 : count
    }

    // 有作者排除时，需要获取作者信息进行过滤
    // 格式: "Author Name <email@example.com>"
    const args = ['log', '--format=%an <%ae>']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    let count = 0
    for (const line of lines) {
      if (!this.shouldIgnoreAuthor(line, options.ignoreAuthor)) {
        count++
      }
    }

    return count
  }

  /**
   * 统计参与人数（不同的作者数量）
   */
  async getContributorCount(options: GitLogOptions): Promise<number> {
    const { path } = options

    // 格式: "Author Name <email@example.com>"
    const args = ['log', '--format=%an <%ae>']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())
    
    const uniqueAuthors = new Set<string>()
    for (const line of lines) {
      // 检查是否应该排除此作者
      if (!this.shouldIgnoreAuthor(line, options.ignoreAuthor)) {
        // 提取邮箱作为唯一标识
        const emailMatch = line.match(/<(.+?)>/)
        if (emailMatch) {
          uniqueAuthors.add(emailMatch[1])
        }
      }
    }
    
    return uniqueAuthors.size
  }

  /**
   * 获取最早的commit时间
   */
  async getFirstCommitDate(options: GitLogOptions): Promise<string> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|YYYY-MM-DD"
    const args = ['log', '--format=%an <%ae>|%cd', '--date=format:%Y-%m-%d', '--reverse', '--max-parents=0']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())
    
    // 找到第一个未被排除的提交
    for (const line of lines) {
      const pipeIndex = line.lastIndexOf('|')
      if (pipeIndex === -1) {
        continue
      }
      
      const author = line.substring(0, pipeIndex)
      const date = line.substring(pipeIndex + 1)
      
      if (!this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        return date.trim()
      }
    }
    
    return ''
  }

  /**
   * 获取最新的commit时间
   */
  async getLastCommitDate(options: GitLogOptions): Promise<string> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|YYYY-MM-DD"
    // 注意：不能使用 -1 限制，因为最新的提交可能被排除
    const args = ['log', '--format=%an <%ae>|%cd', '--date=format:%Y-%m-%d']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())
    
    // 找到第一个未被排除的提交（因为 log 默认按时间倒序）
    for (const line of lines) {
      const pipeIndex = line.lastIndexOf('|')
      if (pipeIndex === -1) {
        continue
      }
      
      const author = line.substring(0, pipeIndex)
      const date = line.substring(pipeIndex + 1)
      
      if (!this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        return date.trim()
      }
    }
    
    return ''
  }
}
