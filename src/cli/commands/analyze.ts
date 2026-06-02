import chalk from 'chalk'
import ora from 'ora'
import { GitCollector } from '../../git/git-collector'
import { GitParser } from '../../git/git-parser'
import { TrendAnalyzer } from '../../core/trend-analyzer'
import { TimezoneAnalyzer } from '../../core/timezone-analyzer'
import { GitTeamAnalyzer } from '../../git/git-team-analyzer'
import { ProjectClassifier, ProjectType } from '../../core/project-classifier'
import { AnalyzeOptions } from '../index'
import { calculateTimeRange, getTerminalWidth, createAdaptiveTable } from '../../utils/terminal'
import { GitLogData, GitLogOptions, ParsedGitData, Result996 } from '../../types/git-types'
import { resetWorkdayChecker } from '../../utils/workday-checker'
import {
  printCoreResults,
  printDetailedAnalysis,
  printWorkTimeSummary,
  printTimeDistribution,
  printWeekdayOvertime,
  printWeekendOvertime,
  printLateNightAnalysis,
} from './report'
import { printTrendReport } from './report/trend-printer'
import { printTeamAnalysis } from './report/printers/user-analysis-printer'
import { ensureCommitSamples } from '../common/commit-guard'
import { t } from '../../i18n'
import { buildSingleRepoOutput } from '../output/json-formatter'
import { writeStructuredOutput } from '../output/file-writer'
import { createSpinner } from '../output/spinner'
import { TeamAnalysis } from '../../types/git-types'

type TimeRangeMode = 'all-time' | 'custom' | 'auto-last-commit' | 'fallback'

interface AuthorFilterInfo {
  pattern: string
  displayLabel: string
}

/** 分析执行器，集中处理采集、解析与渲染流程 */
export class AnalyzeExecutor {
  /** 执行分析的主流程 */
  static async execute(path: string, options: AnalyzeOptions): Promise<void> {
    const isStructured = !!(options.json || options.md)
    try {
      // 重置 WorkdayChecker 以应用新的配置
      resetWorkdayChecker()

      const collector = new GitCollector()

      // 计算时间范围：优先使用用户输入，其次按最后一次提交回溯365天，最后退回到当前时间
      const {
        since: effectiveSince,
        until: effectiveUntil,
        mode: rangeMode,
        note: rangeNote,
      } = await resolveTimeRange({ collector, path, options })

      // 显示分析开始信息
      if (!isStructured) console.log(chalk.blue(`🔍 ${t('analyze.repo')}`), path || process.cwd())
      if (!isStructured) {
        switch (rangeMode) {
          case 'all-time':
            console.log(chalk.blue(`📅 ${t('analyze.range')}`), t('analyze.range.all'))
            break
          case 'custom':
            console.log(
              chalk.blue(`📅 ${t('analyze.range')}`),
              t('analyze.range.custom', {
                since: effectiveSince || '',
                until: effectiveUntil || '',
              })
            )
            break
          case 'auto-last-commit':
            console.log(
              chalk.blue(`📅 ${t('analyze.range')}`),
              t('analyze.range.auto', {
                since: effectiveSince || '',
                until: effectiveUntil || '',
                note: rangeNote || '',
              })
            )
            break
          default:
            console.log(
              chalk.blue(`📅 ${t('analyze.range')}`),
              t('analyze.range.fallback', {
                since: effectiveSince || '',
                until: effectiveUntil || '',
              })
            )
        }
        console.log()
      }

      let authorFilter: AuthorFilterInfo | undefined
      if (options.self) {
        authorFilter = await resolveAuthorFilter(collector, path)
        if (!isStructured) {
          console.log(chalk.blue(`🙋 ${t('analyze.authorFilter')}`), authorFilter.displayLabel)
          console.log()
        }
      }

      // 构建统一的 Git 采集参数，保证所有步骤使用一致的过滤条件
      const collectOptions: GitLogOptions = {
        path,
        since: effectiveSince,
        until: effectiveUntil,
        authorPattern: authorFilter?.pattern,
        ignoreAuthor: options.ignoreAuthor,
        ignoreMsg: options.ignoreMsg,
        timezone: options.timezone,
        silent: isStructured,
      }

      // 在正式分析前，先检查 commit 样本量是否达到最低要求
      const hasEnoughCommits = await ensureCommitSamples(collector, collectOptions, 50, t('guard.scene.analysis'), isStructured)
      if (!hasEnoughCommits) {
        return
      }

      // 创建进度指示器（结构化模式下静默）
      const spinner = createSpinner(`📦 ${t('analyze.spinner.start')}`, isStructured)
      if (!isStructured) (spinner as ReturnType<typeof ora>).start()

      // 步骤1: 数据采集（时区过滤已在采集阶段完成）
      const rawData = await collector.collect(collectOptions)
      spinner.text = `⚙️ ${t('analyze.spinner.parsing')}`
      spinner.render()

      // 步骤2: 数据解析与验证
      const shouldEnableHoliday = shouldEnableHolidayMode(rawData, options)
      const parsedData = await GitParser.parseGitData(
        rawData,
        options.hours,
        effectiveSince,
        effectiveUntil,
        shouldEnableHoliday.enabled
      )
      const validation = GitParser.validateData(parsedData)

      if (!validation.isValid) {
        spinner.fail(t('analyze.validationFailed'))
        console.log(chalk.red(`❌ ${t('analyze.validationErrors')}`))
        validation.errors.forEach((error) => {
          console.log(`  ${chalk.red('•')} ${error}`)
        })
        process.exit(1)
      }

      spinner.text = `📈 ${t('analyze.spinner.index')}`
      spinner.render()

      // 步骤3: 计算996指数
      const result = GitParser.calculate996Index(parsedData)

      spinner.succeed(t('analyze.spinner.done'))
      if (!isStructured) console.log()

      // ========== 项目类型识别 ==========
      const classification = ProjectClassifier.classify(rawData, parsedData)
      const isOpenSource = classification.projectType === ProjectType.OPEN_SOURCE

      if (!isStructured) {
        // 显示时区过滤提示（如果有）
        if (options.timezone) {
          console.log(chalk.blue(`⚙️  ${t('analyze.timezoneFilter')}`))
          console.log(chalk.gray(t('analyze.timezoneTarget', { timezone: options.timezone })))
          console.log(chalk.gray(t('analyze.timezoneCommits', { count: rawData.totalCommits })))
          console.log()
        }

        if (isOpenSource) {
          printOpenSourceProjectWarning(classification)
          console.log()
        }

        // 显示节假日调休模式提示
        if (shouldEnableHoliday.enabled) {
          console.log(chalk.blue(`🇨🇳 ${t('analyze.holiday.enabled')}`))
          console.log(chalk.gray(`${shouldEnableHoliday.reason}`))
          console.log()
        }

        printResults(result, parsedData, rawData, options, effectiveSince, effectiveUntil, rangeMode, classification)

        // 步骤 4: 月度趋势分析
        if (effectiveSince && effectiveUntil && shouldShowTrendAnalysis(effectiveSince, effectiveUntil)) {
          console.log()
          const trendSpinner = ora(`📈 ${t('analyze.trend.start')}`).start()
          try {
            const trendResult = await TrendAnalyzer.analyzeTrend(
              path,
              effectiveSince,
              effectiveUntil,
              authorFilter?.pattern,
              (current, total, month) => {
                trendSpinner.text = `📈 ${t('analyze.trend.progress', { current, total, month })}`
              },
              options.timezone,
              shouldEnableHoliday.enabled
            )
            trendSpinner.succeed()
            printTrendReport(trendResult)
          } catch (error) {
            trendSpinner.fail(t('analyze.trend.failed'))
            console.error(chalk.red(`⚠️  ${t('analyze.trend.error')}`), (error as Error).message)
          }
        }

        // 步骤 5: 团队工作模式分析
        if (!isOpenSource && GitTeamAnalyzer.shouldAnalyzeTeam(options)) {
          try {
            const maxUsers = options.maxUsers ? parseInt(String(options.maxUsers), 10) : 30
            const teamAnalysis = await GitTeamAnalyzer.analyzeTeam(collectOptions, result.index996, 20, maxUsers, false)
            if (teamAnalysis) printTeamAnalysis(teamAnalysis)
          } catch (error) {
            console.log(chalk.yellow(`⚠️  ${t('analyze.team.failed')}`), (error as Error).message)
          }
        }

        // 步骤 6: 跨时区警告
        if (rawData.timezoneData && !options.timezone) {
          const tzAnalysis = TimezoneAnalyzer.analyzeTimezone(rawData.timezoneData, rawData.byHour)
          if (tzAnalysis.isCrossTimezone) {
            console.log()
            console.log(chalk.yellow(TimezoneAnalyzer.generateWarningMessage(tzAnalysis)))
          }
        }
      } else {
        // 结构化输出模式：采集团队数据 + 趋势（均 silent）后序列化输出
        let teamAnalysis: TeamAnalysis | null = null
        if (!isOpenSource && GitTeamAnalyzer.shouldAnalyzeTeam(options)) {
          try {
            const maxUsers = options.maxUsers ? parseInt(String(options.maxUsers), 10) : 30
            teamAnalysis = (await GitTeamAnalyzer.analyzeTeam(collectOptions, result.index996, 20, maxUsers, true)) ?? null
          } catch {
            // 静默忽略
          }
        }

        let trendResult = null
        if (effectiveSince && effectiveUntil && shouldShowTrendAnalysis(effectiveSince, effectiveUntil)) {
          try {
            trendResult = await TrendAnalyzer.analyzeTrend(
              path,
              effectiveSince,
              effectiveUntil,
              collectOptions.authorPattern,
              () => {},
              options.timezone,
              shouldEnableHoliday.enabled
            )
          } catch {
            // 静默忽略
          }
        }

        const payload = buildSingleRepoOutput({
          result,
          parsedData,
          rawData,
          teamAnalysis,
          trendResult,
          options,
          since: effectiveSince,
          until: effectiveUntil,
          rangeMode,
          path,
        })
        await writeStructuredOutput(payload, options)
      }
    } catch (error) {
      console.error(chalk.red(`❌ ${t('analyze.failed')}`), (error as Error).message)
      process.exit(1)
    }
  }
}

/**
 * 判断是否应该显示趋势分析
 * 只有分析时间跨度超过1个月时才显示
 */
function shouldShowTrendAnalysis(since: string, until: string): boolean {
  try {
    const sinceDate = new Date(since)
    const untilDate = new Date(until)
    const diffTime = untilDate.getTime() - sinceDate.getTime()
    const diffDays = diffTime / (1000 * 60 * 60 * 24)
    // 超过45天（约1.5个月）才显示趋势分析，避免数据太少
    return diffDays > 45
  } catch {
    return false
  }
}

interface ResolveTimeRangeParams {
  collector: GitCollector
  path: string
  options: AnalyzeOptions
  debug?: boolean
}

async function resolveTimeRange({
  collector,
  path,
  options,
}: ResolveTimeRangeParams): Promise<{ since?: string; until?: string; mode: TimeRangeMode; note?: string }> {
  if (options.allTime) {
    // --all-time 时不传 since 和 until，让 git 返回所有数据
    return {
      mode: 'all-time',
    }
  }

  // 处理 --year 参数
  if (options.year) {
    const yearRange = parseYearOption(options.year)
    if (yearRange) {
      return {
        since: yearRange.since,
        until: yearRange.until,
        mode: 'custom',
        note: yearRange.note,
      }
    }
  }

  if (options.since || options.until) {
    const fallback = calculateTimeRange(false)
    return {
      since: options.since || fallback.since,
      until: options.until || fallback.until,
      mode: 'custom',
    }
  }

  const baseOptions = {
    path,
  }

  try {
    const lastCommitDate = await collector.getLastCommitDate(baseOptions)
    if (lastCommitDate) {
      const untilDate = toUTCDate(lastCommitDate)
      const sinceDate = new Date(untilDate.getTime())
      sinceDate.setUTCDate(sinceDate.getUTCDate() - 365)

      const baseline = Date.UTC(1970, 0, 1)
      if (sinceDate.getTime() < baseline) {
        sinceDate.setTime(baseline)
      }

      return {
        since: formatUTCDate(sinceDate),
        until: formatUTCDate(untilDate),
        mode: 'auto-last-commit',
        note: t('analyze.lastCommitBacktrack'),
      }
    }
  } catch {}

  const fallback = calculateTimeRange(false)
  return {
    since: fallback.since,
    until: fallback.until,
    mode: 'fallback',
  }
}

/**
 * 当启用 --self 时解析当前 Git 用户的信息，生成作者过滤正则
 */
async function resolveAuthorFilter(collector: GitCollector, path: string): Promise<AuthorFilterInfo> {
  const authorInfo = await collector.resolveSelfAuthor(path)
  return {
    pattern: authorInfo.pattern,
    displayLabel: authorInfo.displayLabel,
  }
}

/** 解析 --year 参数，支持单年和年份范围 */
function parseYearOption(yearStr: string): { since: string; until: string; note?: string } | null {
  // 去除空格
  yearStr = yearStr.trim()

  // 匹配年份范围格式：2023-2025
  const rangeMatch = yearStr.match(/^(\d{4})-(\d{4})$/)
  if (rangeMatch) {
    const startYear = parseInt(rangeMatch[1], 10)
    const endYear = parseInt(rangeMatch[2], 10)

    // 验证年份合法性
    if (startYear < 1970 || endYear < 1970 || startYear > endYear) {
      console.error(chalk.red(`❌ ${t('analyze.year.invalidRange')}`))
      process.exit(1)
    }

    return {
      since: `${startYear}-01-01`,
      until: `${endYear}-12-31`,
      note: `${startYear}-${endYear}年`,
    }
  }

  // 匹配单年格式：2025
  const singleMatch = yearStr.match(/^(\d{4})$/)
  if (singleMatch) {
    const year = parseInt(singleMatch[1], 10)

    // 验证年份合法性
    if (year < 1970) {
      console.error(chalk.red(`❌ ${t('analyze.year.invalidSingle')}`))
      process.exit(1)
    }

    return {
      since: `${year}-01-01`,
      until: `${year}-12-31`,
      note: `${year}年`,
    }
  }

  // 格式不正确
  console.error(chalk.red(`❌ ${t('analyze.year.invalidFormat')}`))
  process.exit(1)
}

function toUTCDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map((value) => parseInt(value, 10))
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1))
}

function formatUTCDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 打印开源项目警告（使用 cli-table3） */
function printOpenSourceProjectWarning(classification: ReturnType<typeof ProjectClassifier.classify>): void {
  const { dimensions, confidence, reasoning } = classification

  console.log(chalk.yellow.bold(`🌍 ${t('analyze.openSource.title')}`))
  console.log()

  const terminalWidth = Math.min(getTerminalWidth(), 80)
  const warningTable = createAdaptiveTable(terminalWidth, 'stats')

  // 工作时间规律性
  const regularityEmoji = getRegularityEmoji(dimensions.workTimeRegularity.score)
  const regularityText = `${dimensions.workTimeRegularity.score}/100 ${regularityEmoji} (${dimensions.workTimeRegularity.description})`

  // 周末活跃度
  const weekendPercent = (dimensions.weekendActivity.ratio * 100).toFixed(1)
  const weekendEmoji = getWeekendEmoji(dimensions.weekendActivity.ratio)
  const weekendText = `${weekendPercent}% ${weekendEmoji} (${dimensions.weekendActivity.description})`

  // 月光族模式
  const moonlightingText = dimensions.moonlightingPattern.isActive
    ? `${dimensions.moonlightingPattern.description} 🌙`
    : t('analyze.openSource.notDetected')

  // 贡献者数量
  const contributorsText = dimensions.contributorsCount.description

  warningTable.push(
    [
      { content: chalk.yellow(chalk.bold(t('analyze.openSource.regularity'))), colSpan: 1 },
      { content: chalk.yellow(regularityText), colSpan: 1 },
    ],
    [
      { content: chalk.yellow(chalk.bold(t('analyze.openSource.contributors'))), colSpan: 1 },
      { content: chalk.yellow(contributorsText), colSpan: 1 },
    ],
    [
      { content: chalk.yellow(chalk.bold(t('analyze.openSource.weekend'))), colSpan: 1 },
      { content: chalk.yellow(weekendText), colSpan: 1 },
    ],
    [
      { content: chalk.yellow(chalk.bold(t('analyze.openSource.moonlighting'))), colSpan: 1 },
      { content: chalk.yellow(moonlightingText), colSpan: 1 },
    ],
    [
      { content: chalk.yellow(chalk.bold(t('analyze.openSource.reasoning'))), colSpan: 1 },
      { content: chalk.yellow(reasoning), colSpan: 1 },
    ],
    [
      { content: chalk.yellow(chalk.bold(t('analyze.openSource.confidence'))), colSpan: 1 },
      { content: chalk.yellow(`${confidence}%`), colSpan: 1 },
    ]
  )

  console.log(warningTable.toString())
  console.log()
}

/** 获取规律性 emoji */
function getRegularityEmoji(score: number): string {
  if (score >= 75) return '✅' // 高规律性
  if (score >= 50) return '⚠️' // 中等规律性
  return '❌' // 低规律性
}

/** 获取周末活跃度 emoji */
function getWeekendEmoji(ratio: number): string {
  if (ratio >= 0.3) return '🔥' // 很高周末活跃度
  if (ratio >= 0.15) return '⚠️' // 高周末活跃度
  return '✅' // 低周末活跃度
}

/** 输出核心结果、时间分布与统计信息 */
function printResults(
  result: Result996,
  parsedData: ParsedGitData,
  rawData: GitLogData,
  options: AnalyzeOptions,
  since?: string,
  until?: string,
  rangeMode?: TimeRangeMode,
  classification?: ReturnType<typeof ProjectClassifier.classify>
): void {
  const isOpenSource = classification?.projectType === ProjectType.OPEN_SOURCE

  // 如果是开源项目，隐藏核心结果、详细分析和工作时间推测
  if (!isOpenSource) {
    printCoreResults(result, rawData, options, since, until, rangeMode)
    printDetailedAnalysis(result, parsedData)
    printWorkTimeSummary(parsedData)
  }

  printTimeDistribution(parsedData, options.halfHour) // 传递半小时模式参数
  printWeekdayOvertime(parsedData)
  printWeekendOvertime(parsedData)
  printLateNightAnalysis(parsedData)
}

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
