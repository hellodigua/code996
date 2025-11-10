import chalk from 'chalk'
import ora from 'ora'
import { GitCollector } from '../../git/git-collector'
import { TrendAnalyzer } from '../../core/trend-analyzer'
import { printTrendReport } from './report/trend-printer'
import { AnalyzeOptions } from '../index'
import { buildAuthorFilter } from '../common/author-filter'
import { calculateTimeRange } from '../../utils/terminal'
import { GitLogOptions } from '../../types/git-types'
import { ensureCommitSamples } from '../common/commit-guard'

/**
 * 趋势分析命令执行器
 */
export class TrendExecutor {
  /**
   * 执行趋势分析
   */
  static async execute(path: string, options: AnalyzeOptions): Promise<void> {
    try {
      const collector = new GitCollector()

      // 计算时间范围
      const { since, until } = await this.resolveTimeRange(collector, path, options)

      // 显示分析开始信息
      console.log(chalk.blue('🔍 趋势分析仓库:'), path || process.cwd())
      console.log(chalk.blue('📅 时间范围:'), `${since} 至 ${until}`)
      console.log()

      // 作者过滤（统一处理 self/author/exclude-authors）
      let authorPattern: string | undefined
      try {
        const built = await buildAuthorFilter(collector, path, since, until, options)
        authorPattern = built.pattern
        built.infoLines.forEach((l) => console.log(l))
        if (built.infoLines.length) console.log()
      } catch (e) {
        console.error(chalk.red('❌ 作者过滤失败:'), (e as Error).message)
        process.exit(1)
      }

      // 构造采样参数，确保 commit 过滤条件与趋势统计一致
      const collectOptions: GitLogOptions = {
        path,
        since,
        until,
        authorPattern,
      }

      // 趋势分析同样需要足够的样本量
      const hasEnoughCommits = await ensureCommitSamples(collector, collectOptions, 20, '趋势分析')
      if (!hasEnoughCommits) {
        return
      }

      // 创建进度指示器
      const spinner = ora('📦 开始月度趋势分析...').start()

      // 执行趋势分析
      const trendResult = await TrendAnalyzer.analyzeTrend(path, since, until, authorPattern)

      spinner.succeed('趋势分析完成！')

      // 输出趋势报告
      printTrendReport(trendResult)
    } catch (error) {
      console.error(chalk.red('❌ 趋势分析失败:'), (error as Error).message)
      process.exit(1)
    }
  }

  /**
   * 解析时间范围
   */
  private static async resolveTimeRange(
    collector: GitCollector,
    path: string,
    options: AnalyzeOptions
  ): Promise<{ since: string; until: string }> {
    // 全时间范围
    if (options.allTime) {
      const firstCommit = await collector.getFirstCommitDate({ path })
      const lastCommit = await collector.getLastCommitDate({ path })

      if (!firstCommit || !lastCommit) {
        throw new Error('无法获取仓库的提交历史时间范围')
      }

      return {
        since: firstCommit,
        until: lastCommit,
      }
    }

    // 年份参数
    if (options.year) {
      const yearRange = this.parseYearOption(options.year)
      if (yearRange) {
        return {
          since: yearRange.since,
          until: yearRange.until,
        }
      }
    }

    // 自定义时间范围
    if (options.since && options.until) {
      return {
        since: options.since,
        until: options.until,
      }
    }

    // 部分自定义时间范围（补全缺失的部分）
    if (options.since || options.until) {
      const fallback = calculateTimeRange(false)
      return {
        since: options.since || fallback.since,
        until: options.until || fallback.until,
      }
    }

    // 默认：基于最后一次提交回溯365天
    try {
      const lastCommitDate = await collector.getLastCommitDate({ path })
      if (lastCommitDate) {
        const until = lastCommitDate
        const untilDate = new Date(lastCommitDate)
        untilDate.setFullYear(untilDate.getFullYear() - 1)
        const since = untilDate.toISOString().split('T')[0]
        return { since, until }
      }
    } catch {
      // 失败则使用当前日期回溯
    }

    // 兜底：当前日期回溯365天
    const fallback = calculateTimeRange(false)
    return {
      since: fallback.since,
      until: fallback.until,
    }
  }

  /**
   * 解析年份参数
   */
  private static parseYearOption(yearStr: string): { since: string; until: string } | null {
    yearStr = yearStr.trim()

    // 年份范围格式：2023-2025
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

    // 单年格式：2025
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

    console.error(chalk.red('❌ 年份格式错误: 请使用 "2025" 或 "2023-2025" 格式'))
    process.exit(1)
  }
}
