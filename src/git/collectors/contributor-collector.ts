import { GitLogOptions } from '../../types/git-types'
import { BaseCollector } from './base-collector'

/**
 * 参与者与元数据统计采集器
 * 负责统计提交总数、参与人数、首末提交日期等
 */
export class ContributorCollector extends BaseCollector {
  /**
   * 统计符合过滤条件的 commit 数量
   */
  async countCommits(options: GitLogOptions): Promise<number> {
    const { path } = options

    const args = ['rev-list', '--count', 'HEAD']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const count = parseInt(output.trim(), 10)

    return isNaN(count) ? 0 : count
  }

  /**
   * 统计参与人数（不同的作者数量）
   */
  async getContributorCount(options: GitLogOptions): Promise<number> {
    const { path } = options

    const args = ['log', '--format=%ae']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const emails = output.split('\n').filter((line) => line.trim())
    const uniqueEmails = new Set(emails)
    return uniqueEmails.size
  }

  /**
   * 获取最早的commit时间
   */
  async getFirstCommitDate(options: GitLogOptions): Promise<string> {
    const { path } = options

    const args = ['log', '--format=%cd', '--date=format:%Y-%m-%d', '--reverse', '--max-parents=0']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())
    return lines[0]?.trim() || ''
  }

  /**
   * 获取最新的commit时间
   */
  async getLastCommitDate(options: GitLogOptions): Promise<string> {
    const { path } = options

    const args = ['log', '--format=%cd', '--date=format:%Y-%m-%d', '-1']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())
    return lines[0]?.trim() || ''
  }
}
