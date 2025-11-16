import chalk from 'chalk'
import ora from 'ora'
import { RepoScanner } from '../../workspace/repo-scanner'
import { promptRepoSelection } from '../prompts/repo-selector'
import { GitCollector } from '../../git/git-collector'
import { GitParser } from '../../git/git-parser'
import { GitDataMerger } from '../../git/git-data-merger'
import { MultiOptions, GitLogData, RepoAnalysisRecord, RepoInfo } from '../../types/git-types'
import { calculateTimeRange } from '../../utils/terminal'
import {
  printCoreResults,
  printDetailedAnalysis,
  printWorkTimeSummary,
  printTimeDistribution,
  printWeekdayOvertime,
  printWeekendOvertime,
  printLateNightAnalysis,
  printRecommendation,
  MultiComparisonPrinter,
} from './report'

const DEFAULT_MAX_REPOS = 20

/**
 * Multi 命令执行器
 * 负责多仓库分析的整体流程
 */
export class MultiExecutor {
  /**
   * 执行多仓库分析
   * @param inputDirs 用户指定的目录列表（为空则扫描当前目录的子目录）
   * @param options 分析选项
   */
  static async execute(inputDirs: string[], options: MultiOptions): Promise<void> {
    try {
      const maxCount = options.max && options.max > 0 ? options.max : DEFAULT_MAX_REPOS

      // ========== 步骤 1: 扫描仓库 ==========
      const spinner = ora('🔍 正在扫描 Git 仓库...').start()

      let repos
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

      console.log(
        chalk.gray(`可选择的仓库总数: ${repos.length} 个，默认最多分析 ${maxCount} 个（可通过 --max 调整上限）。`)
      )
      console.log()

      // ========== 步骤 2: 交互式选择仓库 ==========
      const selectedRepos = await promptRepoSelection(repos, maxCount)

      if (selectedRepos.length === 0) {
        console.log(chalk.yellow('⚠️ 未选择任何仓库，分析已取消。'))
        return
      }

      console.log()
      console.log(chalk.blue(`📦 开始分析 ${selectedRepos.length} 个仓库（串行执行）`))
      console.log()

      // 创建 collector 实例
      const collector = new GitCollector()

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
            silent: true,
          })

          dataList.push(data)

          // 为每个仓库计算 996 指数（用于后续对比表）
          const parsedData = GitParser.parseGitData(data, options.hours, effectiveSince, effectiveUntil)
          const result = GitParser.calculate996Index(parsedData)

          repoRecords.push({
            repo,
            data,
            result,
            status: 'success',
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
      const mergedData = GitDataMerger.merge(successfulData)
      spinner2.succeed('数据合并完成')
      console.log()

      // ========== 步骤 5: 分析合并后的数据 ==========
      const spinner3 = ora('📈 正在计算996指数...').start()
      const parsedData = GitParser.parseGitData(mergedData, options.hours, effectiveSince, effectiveUntil)
      const result = GitParser.calculate996Index(parsedData)
      spinner3.succeed('分析完成！')
      console.log()

      // ========== 步骤 6: 输出汇总结果 ==========
      console.log(chalk.bgBlue.white(' 📊 多仓库汇总分析报告 '))
      console.log()

      printCoreResults(result, mergedData, options, effectiveSince, effectiveUntil)
      printDetailedAnalysis(result, parsedData)
      printWorkTimeSummary(parsedData)
      printTimeDistribution(parsedData, options.halfHour) // 传递半小时模式参数
      printWeekdayOvertime(parsedData)
      printWeekendOvertime(parsedData)
      printLateNightAnalysis(parsedData)
      printRecommendation(result, parsedData)

      // ========== 步骤 7: 输出各仓库对比表 ==========
      MultiComparisonPrinter.print(repoRecords)
    } catch (error) {
      console.error(chalk.red('❌ 多仓库分析失败:'), (error as Error).message)
      process.exit(1)
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
  private static resolveTimeRange(options: MultiOptions): { since?: string; until?: string } {
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
