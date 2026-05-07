import { GitLogOptions, TeamAnalysis } from '../types/git-types'
import { UserPatternCollector } from './collectors/user-pattern-collector'
import { UserAnalyzer } from '../core/user-analyzer'
import ora from 'ora'
import { t } from '../i18n'

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
    const spinner = !silent ? ora(t('team.spinner.contributors')).start() : null
    const allContributors = await collector.getAllContributors(options)

    if (allContributors.length === 0) {
      spinner?.fail(t('team.spinner.none'))
      return null
    }

    // 2. 过滤核心贡献者
    const coreContributors = collector.filterCoreContributors(allContributors, minCommits, maxUsers)

    if (coreContributors.length < 3) {
      // 贡献者太少，不适合进行团队分析
      spinner?.info(t('team.spinner.insufficient', { count: coreContributors.length }))
      return null
    }

    spinner?.succeed(
      t('team.spinner.filtered', {
        all: allContributors.length,
        core: coreContributors.length,
      })
    )

    // 3. 批量采集用户工作模式数据
    const dataSpinner = !silent ? ora(t('team.spinner.userData')).start() : null

    const userPatternDataList = await collector.collectUserPatterns(coreContributors, options)

    dataSpinner?.succeed(t('team.spinner.userDataDone', { count: userPatternDataList.length }))

    // 4. 分析每个用户的工作模式
    const analysisSpinner = !silent ? ora(t('team.spinner.userAnalysis')).start() : null

    const totalCommits = allContributors.reduce((sum, c) => sum + c.commits, 0)
    const userPatterns = userPatternDataList.map((data) => UserAnalyzer.analyzeUser(data, totalCommits))

    analysisSpinner?.succeed(t('team.spinner.userAnalysisDone', { count: userPatterns.length }))

    // 5. 进行团队级别的统计和聚类
    const teamSpinner = !silent ? ora(t('team.spinner.team')).start() : null

    const teamAnalysis = UserAnalyzer.analyzeTeam(userPatterns, minCommits, allContributors.length, overallIndex)

    teamSpinner?.succeed(t('team.spinner.teamDone'))

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
