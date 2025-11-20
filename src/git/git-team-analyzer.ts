import { GitLogOptions, TeamAnalysis } from '../types/git-types'
import { UserPatternCollector } from './collectors/user-pattern-collector'
import { UserAnalyzer } from '../core/user-analyzer'
import ora from 'ora'

/**
 * Git团队分析器
 * 整合用户模式采集和团队分析的完整流程
 */
export class GitTeamAnalyzer {
  /**
   * 分析团队工作模式
   * @param options Git日志选项
   * @param overallIndex 项目整体996指数（用于对比）
   * @param minCommits 最小提交数阈值（默认20）
   * @param maxUsers 最大分析用户数（默认30）
   * @param silent 是否静默模式（不显示进度）
   * @returns 团队分析结果，如果贡献者不足则返回null
   */
  static async analyzeTeam(
    options: GitLogOptions,
    overallIndex: number,
    minCommits: number = 20,
    maxUsers: number = 30,
    silent: boolean = false
  ): Promise<TeamAnalysis | null> {
    const collector = new UserPatternCollector()

    // 1. 获取所有贡献者列表
    const spinner = !silent ? ora('正在获取贡献者列表...').start() : null
    const allContributors = await collector.getAllContributors(options)

    if (allContributors.length === 0) {
      spinner?.fail('未找到任何贡献者')
      return null
    }

    // 2. 过滤核心贡献者
    const coreContributors = collector.filterCoreContributors(allContributors, minCommits, maxUsers)

    if (coreContributors.length < 3) {
      // 贡献者太少，不适合进行团队分析
      spinner?.info(`核心贡献者数量不足（${coreContributors.length}人），跳过团队分析`)
      return null
    }

    spinner?.succeed(`找到 ${allContributors.length} 位贡献者，筛选出 ${coreContributors.length} 位核心成员`)

    // 3. 批量采集用户工作模式数据
    const dataSpinner = !silent ? ora('正在采集用户工作模式数据...').start() : null

    const userPatternDataList = await collector.collectUserPatterns(coreContributors, options)

    dataSpinner?.succeed(`成功采集 ${userPatternDataList.length} 位用户的工作模式数据`)

    // 4. 分析每个用户的工作模式
    const analysisSpinner = !silent ? ora('正在分析用户工作模式...').start() : null

    const totalCommits = allContributors.reduce((sum, c) => sum + c.commits, 0)
    const userPatterns = userPatternDataList.map((data) => UserAnalyzer.analyzeUser(data, totalCommits))

    analysisSpinner?.succeed(`成功分析 ${userPatterns.length} 位用户的工作模式`)

    // 5. 进行团队级别的统计和聚类
    const teamSpinner = !silent ? ora('正在进行团队统计和聚类...').start() : null

    const teamAnalysis = UserAnalyzer.analyzeTeam(userPatterns, minCommits, allContributors.length, overallIndex)

    teamSpinner?.succeed('团队分析完成')

    return teamAnalysis
  }

  /**
   * 检查是否应该执行团队分析
   * @param options 分析选项
   * @returns true 如果应该执行团队分析，false 否则
   */
  static shouldAnalyzeTeam(options: {
    self?: boolean // 是否只分析自己
    skipUserAnalysis?: boolean // 是否跳过用户分析
  }): boolean {
    // 如果是 --self 模式或显式跳过，则不执行团队分析
    if (options.self || options.skipUserAnalysis) {
      return false
    }

    return true
  }
}

