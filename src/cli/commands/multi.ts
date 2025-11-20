import chalk from 'chalk'
import ora from 'ora'
import { RepoScanner } from '../../workspace/repo-scanner'
import { promptRepoSelection } from '../prompts/repo-selector'
import { GitCollector } from '../../git/git-collector'
import { GitParser } from '../../git/git-parser'
import { GitDataMerger } from '../../git/git-data-merger'
import { GitTeamAnalyzer } from '../../git/git-team-analyzer'
import { MultiRepoTeamAnalyzer } from '../../git/multi-repo-team-analyzer'
import { TrendAnalyzer } from '../../core/trend-analyzer'
import { TimezoneAnalyzer } from '../../core/timezone-analyzer'
import { TimezoneFilter } from '../../utils/timezone-filter'
import { ProjectClassifier, ProjectType } from '../../core/project-classifier'
import { AnalyzeOptions, GitLogData, RepoAnalysisRecord, RepoInfo, GitLogOptions } from '../../types/git-types'
import { calculateTimeRange, getTerminalWidth, createAdaptiveTable } from '../../utils/terminal'
import {
  printCoreResults,
  printDetailedAnalysis,
  printWorkTimeSummary,
  printTimeDistribution,
  printWeekdayOvertime,
  printWeekendOvertime,
  printLateNightAnalysis,
  MultiComparisonPrinter,
} from './report'
import { printTrendReport } from './report/trend-printer'
import { printTeamAnalysis } from './report/printers/user-analysis-printer'

/**
 * 多仓库分析执行器
 * 负责多仓库分析的整体流程（智能模式的一部分）
 */
export class MultiExecutor {
  /**
   * 执行多仓库分析
   * @param inputDirs 用户指定的目录列表（为空则扫描当前目录的子目录）
   * @param options 分析选项
   * @param preScannedRepos 可选：已经扫描好的仓库列表（智能模式使用）
   */
  static async execute(inputDirs: string[], options: AnalyzeOptions, preScannedRepos?: RepoInfo[]): Promise<void> {
    try {
      // ========== 步骤 1: 扫描仓库 ==========
      let repos: RepoInfo[]

      if (preScannedRepos && preScannedRepos.length > 0) {
        // 使用已扫描的仓库列表（来自智能模式）
        repos = preScannedRepos
        console.log(chalk.green(`✔ 已检测到 ${repos.length} 个候选仓库`))
      } else {
        // 重新扫描
        const spinner = ora('🔍 正在扫描 Git 仓库...').start()

        try {
          if (inputDirs.length === 0) {
            repos = await RepoScanner.scanSubdirectories(process.cwd())
          } else {
            repos = await RepoScanner.scan(inputDirs)
          }
          spinner.succeed(`扫描完成，发现 ${repos.length} 个候选仓库`)
        } catch (error) {
          spinner.fail('扫描失败')
          console.error(chalk.red('❌ 扫描失败:'), (error as Error).message)
          return
        }

        if (repos.length === 0) {
          console.log(chalk.yellow('⚠️ 未在提供的目录中找到 Git 仓库。'))
          return
        }
      }

      console.log(chalk.gray(`可选择的仓库总数: ${repos.length} 个`))
      console.log()

      // ========== 步骤 2: 交互式选择仓库 ==========
      const selectedRepos = await promptRepoSelection(repos)

      if (selectedRepos.length === 0) {
        console.log(chalk.yellow('⚠️ 未选择任何仓库，分析已取消。'))
        return
      }

      console.log()
      console.log(chalk.blue(`📦 开始分析 ${selectedRepos.length} 个仓库（串行执行）`))
      console.log()

      // 创建 collector 实例
      const collector = new GitCollector()

      // 解析作者过滤（如果启用 --self）
      let authorPattern: string | undefined
      if (options.self) {
        try {
          const authorInfo = await collector.resolveSelfAuthor(selectedRepos[0].path)
          authorPattern = authorInfo.pattern
          console.log(chalk.blue('🙋 作者过滤:'), authorInfo.displayLabel)
          console.log(chalk.gray('   将在所有仓库中只统计该作者的提交'))
          console.log()
        } catch (error) {
          console.error(chalk.red('❌ 解析当前用户信息失败:'), (error as Error).message)
          return
        }
      }

      // 计算时间范围
      let effectiveSince: string | undefined
      let effectiveUntil: string | undefined

      if (options.allTime || options.year || options.since || options.until) {
        // 用户明确指定了时间范围，使用指定的范围
        const range = this.resolveTimeRange(options)
        effectiveSince = range.since
        effectiveUntil = range.until
      } else {
        // 默认：找到所有仓库中最新的提交，从那个时间回溯 1 年
        const spinner2 = ora('🔍 正在检测仓库时间范围...').start()
        try {
          const latestDate = await this.findLatestCommitDate(selectedRepos, collector)
          if (latestDate) {
            const untilDate = new Date(latestDate + 'T00:00:00Z')
            const sinceDate = new Date(untilDate.getTime())
            sinceDate.setUTCDate(sinceDate.getUTCDate() - 365)

            effectiveSince = this.formatUTCDate(sinceDate)
            effectiveUntil = this.formatUTCDate(untilDate)

            spinner2.succeed(`检测到最新提交: ${latestDate}`)
            console.log(chalk.gray(`💡 提示: 默认从最新提交回溯 1 年，可使用 --all-time 或 -y 自定义`))
          } else {
            spinner2.warn('未能检测到提交，将使用所有时间')
          }
        } catch {
          spinner2.warn('检测失败，将使用所有时间')
        }
      }

      // 显示时间范围信息
      if (!effectiveSince && !effectiveUntil) {
        console.log(chalk.blue('📅 分析时段: 所有时间'))
      } else {
        console.log(chalk.blue(`📅 分析时段: ${effectiveSince || '最早'} 至 ${effectiveUntil || '最新'}`))
      }
      console.log()

      // ========== 步骤 3: 批量采集数据 ==========
      const dataList: GitLogData[] = []
      const repoRecords: RepoAnalysisRecord[] = []

      for (let i = 0; i < selectedRepos.length; i++) {
        const repo = selectedRepos[i]
        const progress = `(${i + 1}/${selectedRepos.length})`

        console.log(chalk.cyan(`${progress} 正在分析: ${repo.name}`))

        try {
          const data = await collector.collect({
            path: repo.path,
            since: effectiveSince,
            until: effectiveUntil,
            authorPattern,
            silent: true,
          })

          dataList.push(data)

          // 为每个仓库计算 996 指数（用于后续对比表）
          const parsedData = GitParser.parseGitData(data, options.hours, effectiveSince, effectiveUntil)
          const result = GitParser.calculate996Index(parsedData)

          // 项目类型识别
          const classification = ProjectClassifier.classify(data, parsedData)

          repoRecords.push({
            repo,
            data,
            result,
            status: 'success',
            classification,
          })

          console.log(chalk.green(`    ✓ ${data.totalCommits} 个提交, 996指数: ${result.index996.toFixed(1)}`))
        } catch (error) {
          console.error(chalk.red(`    ✗ 分析失败: ${(error as Error).message}`))
          repoRecords.push({
            repo,
            data: { byHour: [], byDay: [], totalCommits: 0 },
            result: { index996: 0, index996Str: '未知', overTimeRadio: 0 },
            status: 'failed',
            error: (error as Error).message,
          })
        }
      }

      // 过滤出成功的数据
      const successfulData = dataList.filter((_, index) => repoRecords[index].status === 'success')

      if (successfulData.length === 0) {
        console.log()
        console.log(chalk.red('❌ 所有仓库分析均失败，无法生成汇总报告'))
        return
      }

      console.log()
      console.log(chalk.green(`✓ 成功分析 ${successfulData.length}/${selectedRepos.length} 个仓库`))
      console.log()

      // ========== 步骤 4: 合并数据 ==========
      const spinner2 = ora('📊 正在合并数据...').start()
      let mergedData = GitDataMerger.merge(successfulData)
      spinner2.succeed('数据合并完成')
      console.log()

      // ========== 步骤 4.5: 按时区过滤（如果指定了 --timezone）==========
      let timezoneFilterInfo: { warning: string; filteredCommits: number } | undefined
      if (options.timezone) {
        try {
          const filterResult = TimezoneFilter.filterByTimezone(mergedData, options.timezone)
          mergedData = filterResult.filteredData
          timezoneFilterInfo = {
            warning: filterResult.warning,
            filteredCommits: filterResult.filteredCommits,
          }
          console.log(chalk.blue(`⚙️ 已按时区 ${options.timezone} 过滤数据`))
          console.log()
        } catch (error) {
          console.error(chalk.red('❌ 时区过滤失败:'), (error as Error).message)
          console.log()
          if (mergedData.timezoneData) {
            console.log(chalk.blue('可用时区:'))
            const available = TimezoneFilter.getAvailableTimezones(mergedData.timezoneData)
            available.forEach((tz) => console.log(chalk.gray(`  • ${tz}`)))
          }
          process.exit(1)
        }
      }

      // ========== 步骤 5: 分析合并后的数据 ==========
      const spinner3 = ora('📈 正在计算996指数...').start()
      const parsedData = GitParser.parseGitData(mergedData, options.hours, effectiveSince, effectiveUntil)
      const result = GitParser.calculate996Index(parsedData)
      spinner3.succeed('分析完成！')
      console.log()

      // ========== 步骤 5.5: 检查是否有开源项目 ==========
      const hasOpenSourceProject = repoRecords.some(
        (record) => record.classification && record.classification.projectType === ProjectType.OPEN_SOURCE
      )

      // 如果有任意一个开源项目，显示项目类型对比表
      if (hasOpenSourceProject) {
        this.printProjectTypeComparison(repoRecords)
      }

      // ========== 步骤 6: 输出汇总结果 ==========
      console.log(chalk.cyan.bold('📊 多仓库汇总分析报告:'))
      console.log()

      // 显示时区过滤警告（如果有）
      if (timezoneFilterInfo) {
        console.log(timezoneFilterInfo.warning)
        console.log()
      }

      // 如果有开源项目，隐藏核心结果、详细分析和工作时间推测
      if (!hasOpenSourceProject) {
        printCoreResults(result, mergedData, options, effectiveSince, effectiveUntil)
        printDetailedAnalysis(result, parsedData)
        printWorkTimeSummary(parsedData)
      }

      printTimeDistribution(parsedData, options.halfHour) // 传递半小时模式参数
      printWeekdayOvertime(parsedData)
      printWeekendOvertime(parsedData)
      printLateNightAnalysis(parsedData)

      // ========== 步骤 7: 输出各仓库对比表 ==========
      MultiComparisonPrinter.print(repoRecords)

      // ========== 步骤 8: 月度趋势分析（默认启用） ==========
      if (selectedRepos.length > 0) {
        console.log()
        const trendSpinner = ora('📈 正在进行多仓库汇总月度趋势分析...').start()
        try {
          // 提取所有成功分析的仓库路径
          const successfulRepoPaths = selectedRepos
            .filter((_, index) => repoRecords[index].status === 'success')
            .map((repo) => repo.path)

          if (successfulRepoPaths.length === 0) {
            trendSpinner.warn('没有成功的仓库数据，跳过趋势分析')
          } else {
            // 使用新的多仓库汇总趋势分析方法
            const trendResult = await TrendAnalyzer.analyzeMultiRepoTrend(
              successfulRepoPaths,
              effectiveSince ?? null,
              effectiveUntil ?? null,
              authorPattern,
              (current, total, month) => {
                // 实时更新进度
                trendSpinner.text = `📈 正在分析月度趋势... (${current}/${total}: ${month})`
              }
            )
            trendSpinner.succeed()
            printTrendReport(trendResult)
          }
        } catch (error) {
          trendSpinner.fail('趋势分析失败')
          console.error(chalk.red('⚠️  趋势分析错误:'), (error as Error).message)
        }
      }

      // ========== 步骤 9: 团队工作模式分析（聚合所有仓库的数据）==========
      // 开源项目不显示团队工作模式分析
      if (!hasOpenSourceProject && GitTeamAnalyzer.shouldAnalyzeTeam(options) && selectedRepos.length > 0) {
        // 收集所有成功分析的仓库路径
        const successfulRepoPaths = selectedRepos
          .filter((_, index) => repoRecords[index].status === 'success')
          .map((repo) => repo.path)

        if (successfulRepoPaths.length > 0) {
          console.log()
          console.log(chalk.gray(`💡 聚合 ${successfulRepoPaths.length} 个仓库的数据进行团队工作模式分析`))

          try {
            const collectOptions: GitLogOptions = {
              path: '', // 多仓库模式下不需要单个path
              since: effectiveSince,
              until: effectiveUntil,
              authorPattern,
              ignoreAuthor: options.ignoreAuthor,
              ignoreMsg: options.ignoreMsg,
            }

            const maxUsers = options.maxUsers ? parseInt(String(options.maxUsers), 10) : 30
            const teamAnalysis = await MultiRepoTeamAnalyzer.analyzeAggregatedTeam(
              successfulRepoPaths,
              collectOptions,
              20, // minCommits（所有仓库总计≥20）
              maxUsers,
              result.index996 // 整体996指数
            )

            if (teamAnalysis) {
              printTeamAnalysis(teamAnalysis)
            }
          } catch (error) {
            console.log(chalk.yellow('⚠️  团队分析失败:'), (error as Error).message)
          }
        }
      }

      // ========== 步骤 10: 检测跨时区并显示警告（如果未使用 --timezone 过滤）==========
      if (mergedData.timezoneData && !options.timezone) {
        const tzAnalysis = TimezoneAnalyzer.analyzeTimezone(mergedData.timezoneData, mergedData.byHour)
        if (tzAnalysis.isCrossTimezone) {
          console.log()
          const warningMessage = TimezoneAnalyzer.generateWarningMessage(tzAnalysis)
          console.log(chalk.yellow(warningMessage))
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ 多仓库分析失败:'), (error as Error).message)
      process.exit(1)
    }
  }

  /**
   * 打印项目类型对比表格
   */
  private static printProjectTypeComparison(repoRecords: RepoAnalysisRecord[]): void {
    console.log(chalk.yellow.bold('🌍 项目类型检测结果'))
    console.log()

    const terminalWidth = Math.min(getTerminalWidth(), 120)
    const typeTable = createAdaptiveTable(terminalWidth, 'stats', {}, [30, terminalWidth - 35])

    // 表头
    typeTable.push([
      { content: chalk.yellow(chalk.bold('仓库名称')), colSpan: 1 },
      { content: chalk.yellow(chalk.bold('项目类型')), colSpan: 1 },
    ])

    // 数据行
    for (const record of repoRecords) {
      if (record.status === 'success' && record.classification) {
        const { projectType, confidence } = record.classification
        let typeText = ''
        let typeEmoji = ''

        if (projectType === ProjectType.OPEN_SOURCE) {
          typeEmoji = '🌍'
          typeText = `开源项目 (置信度: ${confidence}%)`
        } else if (projectType === ProjectType.CORPORATE) {
          typeEmoji = '🏢'
          typeText = `公司项目 (置信度: ${confidence}%)`
        } else {
          typeEmoji = '❓'
          typeText = `不确定 (置信度: ${confidence}%)`
        }

        typeTable.push([
          { content: chalk.yellow(`${typeEmoji} ${record.repo.name}`), colSpan: 1 },
          { content: chalk.yellow(typeText), colSpan: 1 },
        ])
      }
    }

    console.log(typeTable.toString())
    console.log()

    // 如果有开源项目，显示提示
    const openSourceCount = repoRecords.filter(
      (r) => r.classification && r.classification.projectType === ProjectType.OPEN_SOURCE
    ).length

    if (openSourceCount > 0) {
      console.log(chalk.yellow('💡 提示：'))
      console.log(chalk.yellow(`   检测到 ${openSourceCount} 个开源项目。开源项目的周末和晚间提交是正常的社区贡献。`))
      console.log(chalk.yellow('   汇总报告不会显示"996指数"和"加班分析"等不适用的指标。'))
      console.log()
    }
  }

  /**
   * 找到所有仓库中最新的提交日期
   */
  private static async findLatestCommitDate(repos: RepoInfo[], collector: GitCollector): Promise<string | null> {
    let latestDate: string | null = null

    for (const repo of repos) {
      try {
        const lastDate = await collector.getLastCommitDate({ path: repo.path })
        if (lastDate && (!latestDate || lastDate > latestDate)) {
          latestDate = lastDate
        }
      } catch {
        // 忽略单个仓库的错误
      }
    }

    return latestDate
  }

  /**
   * 格式化 UTC 日期为 YYYY-MM-DD
   */
  private static formatUTCDate(date: Date): string {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 解析时间范围（用于用户明确指定时）
   */
  private static resolveTimeRange(options: AnalyzeOptions): { since?: string; until?: string } {
    // 如果明确指定了 --all-time
    if (options.allTime) {
      return {}
    }

    // 如果指定了年份
    if (options.year) {
      const yearRange = this.parseYearOption(options.year)
      if (yearRange) {
        return {
          since: yearRange.since,
          until: yearRange.until,
        }
      }
    }

    // 如果指定了 since 或 until
    if (options.since || options.until) {
      const fallback = calculateTimeRange(false)
      return {
        since: options.since || fallback.since,
        until: options.until || fallback.until,
      }
    }

    return {}
  }

  /**
   * 解析 --year 参数
   */
  private static parseYearOption(yearStr: string): { since: string; until: string } | null {
    yearStr = yearStr.trim()

    // 匹配年份范围格式：2023-2025
    const rangeMatch = yearStr.match(/^(\d{4})-(\d{4})$/)
    if (rangeMatch) {
      const startYear = parseInt(rangeMatch[1], 10)
      const endYear = parseInt(rangeMatch[2], 10)

      if (startYear < 1970 || endYear < 1970 || startYear > endYear) {
        console.error(chalk.red('❌ 年份格式错误: 起始年份不能大于结束年份，且年份必须 >= 1970'))
        process.exit(1)
      }

      return {
        since: `${startYear}-01-01`,
        until: `${endYear}-12-31`,
      }
    }

    // 匹配单年格式：2025
    const singleMatch = yearStr.match(/^(\d{4})$/)
    if (singleMatch) {
      const year = parseInt(singleMatch[1], 10)

      if (year < 1970) {
        console.error(chalk.red('❌ 年份格式错误: 年份必须 >= 1970'))
        process.exit(1)
      }

      return {
        since: `${year}-01-01`,
        until: `${year}-12-31`,
      }
    }

    console.error(chalk.red('❌ 年份格式错误: 请使用 YYYY 格式（如 2025）或 YYYY-YYYY 格式（如 2023-2025）'))
    process.exit(1)
  }
}
