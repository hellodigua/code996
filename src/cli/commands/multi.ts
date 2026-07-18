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
import { ProjectClassifier, ProjectType } from '../../core/project-classifier'
import { AnalyzeOptions, GitLogData, RepoAnalysisRecord, RepoInfo, GitLogOptions } from '../../types/git-types'
import { resetWorkdayChecker } from '../../utils/workday-checker'
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
import { t } from '../../i18n'
import { buildMultiRepoOutput } from '../output/json-formatter'
import { writeStructuredOutput } from '../output/file-writer'
import { resolveLocalWebReportBehavior, resolveOutputMode } from '../output/output-mode'
import { LocalWebReportResult, writeLocalWebReport } from '../output/web-report-writer'
import { TeamAnalysis } from '../../types/git-types'

/**
 * 判断是否应该启用节假日调休模式
 * @param rawData Git数据
 * @param options 用户选项
 * @returns 是否启用及原因
 */
function shouldEnableHolidayMode(rawData: GitLogData, options: AnalyzeOptions): { enabled: boolean; reason: string } {
  // 如果用户强制开启，直接启用
  if (options.cn) {
    return {
      enabled: true,
      reason: t('analyze.holiday.reason.force'),
    }
  }

  // 检测主要时区是否为 +0800
  if (rawData.timezoneData && rawData.timezoneData.timezones.length > 0) {
    // 找到占比最高的时区
    const dominantTimezone = rawData.timezoneData.timezones[0]
    const dominantRatio = dominantTimezone.count / rawData.timezoneData.totalCommits

    // 如果主要时区是 +0800 且占比超过 50%
    if (dominantTimezone.offset === '+0800' && dominantRatio >= 0.5) {
      return {
        enabled: true,
        reason: t('analyze.holiday.reason.auto', {
          ratio: (dominantRatio * 100).toFixed(1),
        }),
      }
    }
  }

  // 默认不启用
  return {
    enabled: false,
    reason: '',
  }
}

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
  static async execute(
    inputDirs: string[],
    options: AnalyzeOptions,
    preScannedRepos?: RepoInfo[]
  ): Promise<LocalWebReportResult | undefined> {
    const outputMode = resolveOutputMode(options)
    const webReportBehavior = resolveLocalWebReportBehavior(options)
    const isStructured = outputMode === 'json' || outputMode === 'md'
    const isTerminalReport = outputMode === 'terminal'
    try {
      // ========== 步骤 1: 扫描仓库 ==========
      let repos: RepoInfo[]

      if (preScannedRepos && preScannedRepos.length > 0) {
        // 使用已扫描的仓库列表（来自智能模式）
        repos = preScannedRepos
        console.log(chalk.green(`✔ ${t('multi.detected', { count: repos.length })}`))
      } else {
        // 重新扫描
        const spinner = ora(`🔍 ${t('multi.scan.start')}`).start()

        try {
          if (inputDirs.length === 0) {
            repos = await RepoScanner.scanSubdirectories(process.cwd())
          } else {
            repos = await RepoScanner.scan(inputDirs)
          }
          spinner.succeed(t('multi.scan.done', { count: repos.length }))
        } catch (error) {
          spinner.fail(t('multi.scan.failed'))
          console.error(chalk.red(`❌ ${t('multi.scan.error')}`), (error as Error).message)
          return
        }

        if (repos.length === 0) {
          console.log(chalk.yellow(`⚠️ ${t('multi.scan.none')}`))
          return
        }
      }

      console.log(chalk.gray(t('multi.repoCount', { count: repos.length })))
      console.log()

      // ========== 步骤 2: 交互式选择仓库 ==========
      const selectedRepos = await promptRepoSelection(repos)

      if (selectedRepos.length === 0) {
        console.log(chalk.yellow(`⚠️ ${t('multi.selection.cancelled')}`))
        return
      }

      console.log()
      console.log(chalk.blue(`📦 ${t('multi.start', { count: selectedRepos.length })}`))
      console.log()

      // 创建 collector 实例
      const collector = new GitCollector()

      // 解析作者过滤（如果启用 --self）
      let authorPattern: string | undefined
      if (options.self) {
        try {
          const authorInfo = await collector.resolveSelfAuthor(selectedRepos[0].path)
          authorPattern = authorInfo.pattern
          console.log(chalk.blue(`🙋 ${t('analyze.authorFilter')}`), authorInfo.displayLabel)
          console.log(chalk.gray(t('multi.author.single')))
          console.log()
        } catch (error) {
          console.error(chalk.red(`❌ ${t('multi.author.resolveFailed')}`), (error as Error).message)
          return
        }
      }

      // 计算时间范围
      let effectiveSince: string | undefined
      let effectiveUntil: string | undefined
      let rangeMode: string

      if (options.allTime) {
        rangeMode = 'all-time'
        // effectiveSince / effectiveUntil 保持 undefined，让 git 返回全部数据
      } else if (options.year || options.since || options.until) {
        rangeMode = 'custom'
      } else {
        rangeMode = 'auto-last-commit'
      }

      if (options.allTime || options.year || options.since || options.until) {
        // 用户明确指定了时间范围，使用指定的范围
        const range = this.resolveTimeRange(options)
        effectiveSince = range.since
        effectiveUntil = range.until
      } else {
        // 默认：找到所有仓库中最新的提交，从那个时间回溯 1 年
        const spinner2 = ora(`🔍 ${t('multi.range.detect')}`).start()
        try {
          const latestDate = await this.findLatestCommitDate(selectedRepos, collector)
          if (latestDate) {
            const untilDate = new Date(latestDate + 'T00:00:00Z')
            const sinceDate = new Date(untilDate.getTime())
            sinceDate.setUTCDate(sinceDate.getUTCDate() - 365)

            effectiveSince = this.formatUTCDate(sinceDate)
            effectiveUntil = this.formatUTCDate(untilDate)

            spinner2.succeed(t('multi.range.latest', { date: latestDate }))
            console.log(chalk.gray(`💡 ${t('multi.range.tip')}`))
          } else {
            spinner2.warn(t('multi.range.none'))
          }
        } catch {
          spinner2.warn(t('multi.range.fail'))
        }
      }

      // 显示时间范围信息
      if (!effectiveSince && !effectiveUntil) {
        console.log(chalk.blue(`📅 ${t('multi.range.label')}`))
      } else {
        console.log(
          chalk.blue(
            `📅 ${t('multi.range.labelCustom', {
              since: effectiveSince || t('core.result.period.from', { since: '' }).trim() || 'earliest',
              until: effectiveUntil || 'latest',
            })}`
          )
        )
      }
      console.log()

      // ========== 步骤 3: 批量采集数据 ==========
      const dataList: GitLogData[] = []
      const repoRecords: RepoAnalysisRecord[] = []

      for (let i = 0; i < selectedRepos.length; i++) {
        const repo = selectedRepos[i]
        const progress = `(${i + 1}/${selectedRepos.length})`

        console.log(chalk.cyan(`${progress} ${t('multi.progress', { name: repo.name })}`))

        try {
          const data = await collector.collect({
            path: repo.path,
            since: effectiveSince,
            until: effectiveUntil,
            authorPattern,
            timezone: options.timezone, // 添加时区过滤参数
            silent: true,
          })

          dataList.push(data)

          // 为每个仓库计算 996 指数（用于后续对比表）
          const shouldEnableHoliday2 = shouldEnableHolidayMode(data, options) // 本地变量以避免混淆
          const parsedData = await GitParser.parseGitData(
            data,
            options.hours,
            effectiveSince,
            effectiveUntil,
            shouldEnableHoliday2.enabled
          )
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

          console.log(
            chalk.green(
              `    ✓ ${t('multi.progress.success', {
                count: data.totalCommits,
                index: result.index996.toFixed(1),
              })}`
            )
          )
        } catch (error) {
          console.error(chalk.red(`    ✗ ${t('multi.progress.failed', { message: (error as Error).message })}`))
          repoRecords.push({
            repo,
            data: { byHour: [], byDay: [], totalCommits: 0 },
            result: { index996: 0, index996DescriptionKey: 'ok', overTimeRadio: 0 },
            status: 'failed',
            error: (error as Error).message,
          })
        }
      }

      // 过滤出成功的数据
      const successfulData = dataList.filter((_, index) => repoRecords[index].status === 'success')

      if (successfulData.length === 0) {
        console.log()
        console.log(chalk.red(`❌ ${t('multi.allFailed')}`))
        return
      }

      console.log()
      console.log(
        chalk.green(`✓ ${t('multi.success', { success: successfulData.length, total: selectedRepos.length })}`)
      )
      console.log()

      // ========== 步骤 4: 合并数据 ==========
      const spinner2 = ora(`📊 ${t('multi.merge.start')}`).start()
      const mergedData = GitDataMerger.merge(successfulData)
      spinner2.succeed(t('multi.merge.done'))
      console.log()

      // 显示时区过滤提示（如果有）
      if (options.timezone) {
        console.log(chalk.blue(`⚙️  ${t('analyze.timezoneFilter')}`))
        console.log(chalk.gray(t('analyze.timezoneTarget', { timezone: options.timezone })))
        console.log(chalk.gray(t('analyze.timezoneCommits', { count: mergedData.totalCommits })))
        console.log()
      }

      // ========== 步骤 5: 分析合并后的数据 ==========
      const spinner3 = ora(`📈 ${t('analyze.spinner.index')}`).start()
      const shouldEnableHoliday3 = shouldEnableHolidayMode(mergedData, options) // 本地变量以避免混淆
      const parsedData = await GitParser.parseGitData(
        mergedData,
        options.hours,
        effectiveSince,
        effectiveUntil,
        shouldEnableHoliday3.enabled
      )
      const result = GitParser.calculate996Index(parsedData)
      spinner3.succeed(t('analyze.spinner.done'))
      console.log()

      // ========== 步骤 5.5: 检查是否有开源项目 ==========
      const hasOpenSourceProject = repoRecords.some(
        (record) => record.classification && record.classification.projectType === ProjectType.OPEN_SOURCE
      )

      // 如果有任意一个开源项目，显示项目类型对比表
      if (isTerminalReport && hasOpenSourceProject) {
        this.printProjectTypeComparison(repoRecords)
      }

      const successfulRepoPaths = selectedRepos
        .filter((_, index) => repoRecords[index].status === 'success')
        .map((repo) => repo.path)
      const timezoneAnalysis = mergedData.timezoneData
        ? TimezoneAnalyzer.analyzeTimezone(mergedData.timezoneData, mergedData.byHour)
        : null

      if (isTerminalReport) {
        // ========== 步骤 6: 输出汇总结果 ==========
        console.log(chalk.cyan.bold(`📊 ${t('multi.summary.title')}`))
        console.log()

        // 显示节假日调休模式提示
        if (shouldEnableHoliday3.enabled) {
          console.log(chalk.blue(`🇨🇳 ${t('analyze.holiday.enabled')}`))
          console.log(chalk.gray(`${shouldEnableHoliday3.reason}`))
          console.log()
        }

        // 如果有开源项目，隐藏核心结果、详细分析和工作时间推测
        if (!hasOpenSourceProject) {
          printCoreResults(result, mergedData, options, effectiveSince, effectiveUntil)
          printDetailedAnalysis(result, parsedData)
          printWorkTimeSummary(parsedData)
        }

        printTimeDistribution(parsedData, options.halfHour)
        printWeekdayOvertime(parsedData)
        printWeekendOvertime(parsedData)
        printLateNightAnalysis(parsedData)

        // ========== 步骤 7: 输出各仓库对比表 ==========
        MultiComparisonPrinter.print(repoRecords)
      }

      // 扩展分析只计算一次，所有输出格式共用结果。
      let trendResult = null
      if (successfulRepoPaths.length > 0) {
        if (!isTerminalReport) {
          try {
            trendResult = await TrendAnalyzer.analyzeMultiRepoTrend(
              successfulRepoPaths,
              effectiveSince ?? null,
              effectiveUntil ?? null,
              authorPattern,
              () => {},
              options.timezone,
              shouldEnableHoliday3.enabled
            )
          } catch {
            // 结构化输出保持纯净，缺失模块由 null 表达。
          }
        } else {
          console.log()
          const trendSpinner = ora(`📈 ${t('multi.trend.start')}`).start()
          try {
            trendResult = await TrendAnalyzer.analyzeMultiRepoTrend(
              successfulRepoPaths,
              effectiveSince ?? null,
              effectiveUntil ?? null,
              authorPattern,
              (current, total, month) => {
                trendSpinner.text = `📈 ${t('analyze.trend.progress', { current, total, month })}`
              },
              options.timezone,
              shouldEnableHoliday3.enabled
            )
            trendSpinner.succeed()
            printTrendReport(trendResult)
          } catch (error) {
            trendSpinner.fail(t('analyze.trend.failed'))
            console.error(chalk.red(`⚠️  ${t('analyze.trend.error')}`), (error as Error).message)
          }
        }
      }

      let teamAnalysis: TeamAnalysis | null = null
      if (!hasOpenSourceProject && GitTeamAnalyzer.shouldAnalyzeTeam(options) && successfulRepoPaths.length > 0) {
        if (isTerminalReport) {
          console.log()
          console.log(chalk.gray(`💡 ${t('multi.team.aggregate', { count: successfulRepoPaths.length })}`))
        }

        try {
          const collectOptions: GitLogOptions = {
            path: '',
            since: effectiveSince,
            until: effectiveUntil,
            authorPattern,
            ignoreAuthor: options.ignoreAuthor,
            ignoreMsg: options.ignoreMsg,
          }
          const maxUsers = options.maxUsers ? parseInt(String(options.maxUsers), 10) : 30
          teamAnalysis =
            (await MultiRepoTeamAnalyzer.analyzeAggregatedTeam(
              successfulRepoPaths,
              collectOptions,
              20,
              maxUsers,
              result.index996
            )) ?? null

          if (isTerminalReport && teamAnalysis) printTeamAnalysis(teamAnalysis)
        } catch (error) {
          if (isTerminalReport) {
            console.log(chalk.yellow(`⚠️  ${t('analyze.team.failed')}`), (error as Error).message)
          }
        }
      }

      if (isTerminalReport && !options.timezone && timezoneAnalysis?.isCrossTimezone) {
        console.log()
        console.log(chalk.yellow(TimezoneAnalyzer.generateWarningMessage(timezoneAnalysis)))
      }

      const payload = buildMultiRepoOutput({
        result,
        parsedData,
        mergedData,
        repoRecords,
        teamAnalysis,
        trendResult,
        options,
        since: effectiveSince,
        until: effectiveUntil,
        rangeMode,
        holidayMode: shouldEnableHoliday3.enabled,
        timezoneAnalysis,
      })

      if (isStructured) {
        await writeStructuredOutput(payload, options)
      } else if (webReportBehavior.generate) {
        return await writeLocalWebReport(payload, { open: webReportBehavior.open })
      }
    } catch (error) {
      console.error(chalk.red(`❌ ${t('multi.failed')}`), (error as Error).message)
      process.exit(1)
    }
  }

  /**
   * 打印项目类型对比表格
   */
  private static printProjectTypeComparison(repoRecords: RepoAnalysisRecord[]): void {
    console.log(chalk.yellow.bold(`🌍 ${t('multi.projectType.title')}`))
    console.log()

    const terminalWidth = Math.min(getTerminalWidth(), 120)
    const typeTable = createAdaptiveTable(terminalWidth, 'stats', {}, [30, terminalWidth - 35])

    // 表头
    typeTable.push([
      { content: chalk.yellow(chalk.bold(t('multi.projectType.repo'))), colSpan: 1 },
      { content: chalk.yellow(chalk.bold(t('multi.projectType.type'))), colSpan: 1 },
    ])

    // 数据行
    for (const record of repoRecords) {
      if (record.status === 'success' && record.classification) {
        const { projectType, confidence } = record.classification
        let typeText = ''
        let typeEmoji = ''

        if (projectType === ProjectType.OPEN_SOURCE) {
          typeEmoji = '🌍'
          typeText = t('multi.projectType.openSource', { confidence })
        } else if (projectType === ProjectType.CORPORATE) {
          typeEmoji = '🏢'
          typeText = t('multi.projectType.corporate', { confidence })
        } else {
          typeEmoji = '❓'
          typeText = t('multi.projectType.uncertain', { confidence })
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
      console.log(chalk.yellow(`💡 ${t('multi.projectType.tipTitle')}`))
      console.log(chalk.yellow(`   ${t('multi.projectType.tipLine1', { count: openSourceCount })}`))
      console.log(chalk.yellow(`   ${t('multi.projectType.tipLine2')}`))
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
        console.error(chalk.red(`❌ ${t('analyze.year.invalidRange')}`))
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
        console.error(chalk.red(`❌ ${t('analyze.year.invalidSingle')}`))
        process.exit(1)
      }

      return {
        since: `${year}-01-01`,
        until: `${year}-12-31`,
      }
    }

    console.error(chalk.red(`❌ ${t('analyze.year.invalidFormat')}`))
    process.exit(1)
  }
}
