import { GitLogOptions, TeamAnalysis } from '../types/git-types'
import {
  UserPatternCollector,
  ContributorInfo,
  UserPatternData,
  DailyCommitTime,
} from './collectors/user-pattern-collector'
import { UserAnalyzer } from '../core/user-analyzer'

/**
 * 聚合的贡献者信息（跨多个仓库）
 */
interface AggregatedContributor {
  email: string
  name: string
  totalCommits: number // 所有仓库的总提交数
  repos: Array<{ path: string; commits: number }> // 在各个仓库的提交数
}

/**
 * 多仓库团队分析器
 * 负责聚合多个仓库的数据并进行统一的团队分析
 */
export class MultiRepoTeamAnalyzer {
  /**
   * 分析多个仓库的团队工作模式（聚合模式）
   * @param repoPaths 所有仓库路径
   * @param options Git日志选项
   * @param minCommits 最小提交数阈值（默认20）
   * @param maxUsers 最大分析用户数（默认30）
   * @param overallIndex 整体996指数（用于对比）
   */
  static async analyzeAggregatedTeam(
    repoPaths: string[],
    options: GitLogOptions,
    minCommits: number = 20,
    maxUsers: number = 30,
    overallIndex: number = 0
  ): Promise<TeamAnalysis | null> {
    // 第一步：收集所有仓库的所有贡献者
    const aggregatedContributors = await this.aggregateContributors(repoPaths, options)

    // 第二步：过滤核心贡献者（总提交数 >= minCommits）
    const coreContributors = Array.from(aggregatedContributors.values())
      .filter((c) => c.totalCommits >= minCommits)
      .sort((a, b) => b.totalCommits - a.totalCommits)
      .slice(0, maxUsers)

    if (coreContributors.length < 2) {
      console.log(`\n  核心贡献者数量不足（${coreContributors.length}人），跳过团队分析\n`)
      return null
    }

    // 第三步：为每个核心贡献者跨仓库采集数据
    const userPatternDataList = await this.aggregateUserDataAcrossRepos(coreContributors, repoPaths, options)

    // 第四步：计算总提交数（用于计算百分比）
    const totalCommits = coreContributors.reduce((sum, c) => sum + c.totalCommits, 0)

    // 第五步：分析每个用户
    const userPatterns = userPatternDataList.map((userData) => UserAnalyzer.analyzeUser(userData, totalCommits))

    // 第六步：团队层面分析
    const teamAnalysis = UserAnalyzer.analyzeTeam(userPatterns, minCommits, aggregatedContributors.size, overallIndex)

    return teamAnalysis
  }

  /**
   * 聚合所有仓库的贡献者信息
   */
  private static async aggregateContributors(
    repoPaths: string[],
    options: GitLogOptions
  ): Promise<Map<string, AggregatedContributor>> {
    const aggregated = new Map<string, AggregatedContributor>()
    const collector = new UserPatternCollector()

    for (const repoPath of repoPaths) {
      try {
        const contributors = await collector.getAllContributors({ ...options, path: repoPath })

        for (const c of contributors) {
          if (!aggregated.has(c.email)) {
            aggregated.set(c.email, {
              email: c.email,
              name: c.name,
              totalCommits: 0,
              repos: [],
            })
          }

          const agg = aggregated.get(c.email)!
          agg.totalCommits += c.commits
          agg.repos.push({ path: repoPath, commits: c.commits })
        }
      } catch (error) {
        // 跳过无法访问的仓库
        console.error(`⚠️  无法访问仓库 ${repoPath}:`, error)
      }
    }

    return aggregated
  }

  /**
   * 为每个核心贡献者跨仓库聚合数据
   */
  private static async aggregateUserDataAcrossRepos(
    coreContributors: AggregatedContributor[],
    repoPaths: string[],
    options: GitLogOptions
  ): Promise<UserPatternData[]> {
    const results: UserPatternData[] = []
    const collector = new UserPatternCollector()

    for (const contributor of coreContributors) {
      // 初始化聚合数据
      const timeDistribution = new Array(24).fill(0).map((_, i) => ({
        time: i.toString().padStart(2, '0'),
        count: 0,
      }))

      const dayDistribution = new Array(7).fill(0).map((_, i) => ({
        time: (i + 1).toString(),
        count: 0,
      }))

      const allDailyFirstCommits: DailyCommitTime[] = []
      const allDailyLatestCommits: DailyCommitTime[] = []

      // 遍历所有仓库，聚合该用户的数据
      for (const repoPath of repoPaths) {
        try {
          const [timeData, dayData, firstCommits, latestCommits] = await Promise.all([
            collector.getUserTimeDistribution(contributor.email, { ...options, path: repoPath }),
            collector.getUserDayDistribution(contributor.email, { ...options, path: repoPath }),
            collector.getUserDailyFirstCommits(contributor.email, { ...options, path: repoPath }, 6), // 团队工作模式用6个月
            collector.getUserDailyLatestCommits(contributor.email, { ...options, path: repoPath }, 6),
          ])

          // 合并时间分布
          for (let i = 0; i < 24; i++) {
            timeDistribution[i].count += timeData[i]?.count || 0
          }

          // 合并星期分布
          for (let i = 0; i < 7; i++) {
            dayDistribution[i].count += dayData[i]?.count || 0
          }

          // 合并每日首末提交时间
          allDailyFirstCommits.push(...firstCommits)
          allDailyLatestCommits.push(...latestCommits)
        } catch (error) {
          // 跳过该仓库
          console.error(`⚠️  无法为用户 ${contributor.email} 采集仓库 ${repoPath} 的数据`)
        }
      }

      // 构造ContributorInfo
      const contributorInfo: ContributorInfo = {
        author: `${contributor.name} <${contributor.email}>`,
        email: contributor.email,
        name: contributor.name,
        commits: contributor.totalCommits,
      }

      results.push({
        contributor: contributorInfo,
        timeDistribution,
        dayDistribution,
        dailyFirstCommits: allDailyFirstCommits,
        dailyLatestCommits: allDailyLatestCommits,
      })
    }

    return results
  }
}
