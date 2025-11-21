import { GitLogOptions } from '../../types/git-types'
import { BaseCollector } from './base-collector'

/**
 * 参与者与元数据统计采集器
 * 负责统计提交总数、参与人数、首末提交日期等
 */
export class ContributorCollector extends BaseCollector {
  /**
   * 统计符合过滤条件的 commit 数量
   * 注意：由于需要支持作者排除过滤和时区过滤，这里使用 log 而不是 rev-list
   */
  async countCommits(options: GitLogOptions): Promise<number> {
    const { path } = options

    // 如果没有作者排除过滤且没有时区过滤，使用更高效的 rev-list
    if (!options.ignoreAuthor && !options.timezone) {
      const args = ['rev-list', '--count', 'HEAD']
      this.applyCommonFilters(args, options)

      const output = await this.execGitCommand(args, path)
      const count = parseInt(output.trim(), 10)

      return isNaN(count) ? 0 : count
    }

    // 有作者排除或时区过滤时，需要获取详细信息进行过滤
    // 格式: "Author Name <email@example.com>|ISO_TIMESTAMP"
    const args = ['log', '--format=%an <%ae>|%ai']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    let count = 0
    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 2) {
        continue
      }

      const author = parts[0]
      const isoTimestamp = parts[1]

      // 检查作者过滤
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 检查时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      count++
    }

    return count
  }

  /**
   * 统计参与人数（不同的作者数量）
   */
  async getContributorCount(options: GitLogOptions): Promise<number> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|ISO_TIMESTAMP"
    const args = ['log', '--format=%an <%ae>|%ai']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    const uniqueAuthors = new Set<string>()
    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 2) {
        continue
      }

      const author = parts[0]
      const isoTimestamp = parts[1]

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 检查时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      // 提取邮箱作为唯一标识
      const emailMatch = author.match(/<(.+?)>/)
      if (emailMatch) {
        uniqueAuthors.add(emailMatch[1])
      }
    }

    return uniqueAuthors.size
  }

  /**
   * 获取最早的commit时间
   */
  async getFirstCommitDate(options: GitLogOptions): Promise<string> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|YYYY-MM-DD|ISO_TIMESTAMP"
    const args = ['log', '--format=%an <%ae>|%cd|%ai', '--date=format:%Y-%m-%d', '--reverse', '--max-parents=0']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 找到第一个未被排除的提交
    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 3) {
        continue
      }

      const author = parts[0]
      const date = parts[1]
      const isoTimestamp = parts[2]

      // 检查作者过滤
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 检查时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      return date.trim()
    }

    return ''
  }

  /**
   * 获取最新的commit时间
   */
  async getLastCommitDate(options: GitLogOptions): Promise<string> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|YYYY-MM-DD|ISO_TIMESTAMP"
    // 注意：不能使用 -1 限制，因为最新的提交可能被排除
    const args = ['log', '--format=%an <%ae>|%cd|%ai', '--date=format:%Y-%m-%d']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 找到第一个未被排除的提交（因为 log 默认按时间倒序）
    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 3) {
        continue
      }

      const author = parts[0]
      const date = parts[1]
      const isoTimestamp = parts[2]

      // 检查作者过滤
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 检查时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      return date.trim()
    }

    return ''
  }
}
