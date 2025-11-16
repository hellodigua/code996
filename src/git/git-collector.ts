import { GitLogOptions, GitLogData } from '../types/git-types'
import chalk from 'chalk'
import { BaseCollector } from './collectors/base-collector'
import { TimeCollector } from './collectors/time-collector'
import { CommitCollector } from './collectors/commit-collector'
import { ContributorCollector } from './collectors/contributor-collector'

/**
 * Git数据采集主类
 * 整合所有专门的采集器，提供统一的数据收集接口
 */
export class GitCollector extends BaseCollector {
  private timeCollector: TimeCollector
  private commitCollector: CommitCollector
  private contributorCollector: ContributorCollector

  constructor() {
    super()
    this.timeCollector = new TimeCollector()
    this.commitCollector = new CommitCollector()
    this.contributorCollector = new ContributorCollector()
  }

  /**
   * 统计符合过滤条件的 commit 数量
   */
  async countCommits(options: GitLogOptions): Promise<number> {
    return this.contributorCollector.countCommits(options)
  }

  /**
   * 获取最早的commit时间
   */
  async getFirstCommitDate(options: GitLogOptions): Promise<string> {
    return this.contributorCollector.getFirstCommitDate(options)
  }

  /**
   * 获取最新的commit时间
   */
  async getLastCommitDate(options: GitLogOptions): Promise<string> {
    return this.contributorCollector.getLastCommitDate(options)
  }

  /**
   * 收集Git数据
   * @param options 采集选项
   * @returns 完整的Git日志数据
   */
  async collect(options: GitLogOptions): Promise<GitLogData> {
    if (!options.silent) {
      console.log(chalk.blue(`正在分析仓库: ${options.path}`))
    }

    // 检查是否为有效的Git仓库
    if (!(await this.isValidGitRepo(options.path))) {
      throw new Error(`路径 "${options.path}" 不是一个有效的Git仓库`)
    }

    try {
      const [
        byHour,
        byDay,
        totalCommits,
        dailyFirstCommits,
        dayHourCommits,
        dailyLatestCommits,
        dailyCommitHours,
        contributors,
        firstCommitDate,
        lastCommitDate,
      ] = await Promise.all([
        this.timeCollector.getCommitsByHour(options),
        this.timeCollector.getCommitsByDay(options),
        this.contributorCollector.countCommits(options),
        this.commitCollector.getDailyFirstCommits(options),
        this.commitCollector.getCommitsByDayAndHour(options),
        this.commitCollector.getDailyLatestCommits(options),
        this.commitCollector.getDailyCommitHours(options),
        this.contributorCollector.getContributorCount(options),
        this.contributorCollector.getFirstCommitDate(options),
        this.contributorCollector.getLastCommitDate(options),
      ])

      if (!options.silent) {
        console.log(chalk.green(`数据采集完成: ${totalCommits} 个commit`))
      }

      return {
        byHour,
        byDay,
        totalCommits,
        dailyFirstCommits: dailyFirstCommits.length > 0 ? dailyFirstCommits : undefined,
        dayHourCommits: dayHourCommits.length > 0 ? dayHourCommits : undefined,
        dailyLatestCommits: dailyLatestCommits.length > 0 ? dailyLatestCommits : undefined,
        dailyCommitHours: dailyCommitHours.length > 0 ? dailyCommitHours : undefined,
        contributors,
        firstCommitDate: firstCommitDate || undefined,
        lastCommitDate: lastCommitDate || undefined,
        granularity: 'half-hour', // 标识数据为半小时粒度
      }
    } catch (error) {
      if (!options.silent) {
        console.error(chalk.red(`数据采集失败: ${(error as Error).message}`))
      }
      throw error
    }
  }
}
