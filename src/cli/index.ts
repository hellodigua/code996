import { Command } from 'commander'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { getPackageVersion } from '../utils/version'
import { printGlobalNotices } from './common/notices'

export interface AnalyzeOptions {
  since?: string
  until?: string
  allTime?: boolean
  year?: string
  self?: boolean // 统计当前 Git 用户
  author?: string // 指定作者（名称或邮箱的部分匹配）
  excludeAuthors?: string // 排除作者列表（逗号分隔，名称或邮箱的部分匹配）
  merge?: boolean // 合并同名不同邮箱的作者
  weekendSpanThreshold?: string // 周末真正加班跨度阈值（小时）
  weekendCommitThreshold?: string // 周末真正加班最少提交数阈值
  weekdayOvertimeMode?: 'commits' | 'days' | 'both' // 工作日加班展示模式
  endHour?: string // 自定义下班时间（24小时制，例如 18 表示18点）
  repos?: string // 多个仓库路径（逗号分隔，用于综合分析）
}

export class CLIManager {
  private program: Command

  /** 构造函数：初始化 Commander 实例并完成命令注册 */
  constructor() {
    this.program = new Command()
    this.setupProgram()
  }

  /** 配置 CLI 的基础信息与可用命令 */
  private setupProgram(): void {
    this.program
      .name('code996')
      .description('通过分析 Git commit 的时间分布，计算出项目的"996指数"')
      .version(getPackageVersion(), '-v, --version', '显示版本号')

    // 注册根命令默认行为，直接执行分析逻辑
    this.setupDefaultAnalyzeAction()
    this.addTrendCommand()
    this.addRankingCommand()
    this.addHelpCommand()

    // 错误处理
    this.setupErrorHandling()
  }

  /** 注册根命令，使用户直接运行 code996 即触发分析，并可选传入仓库路径 */
  private setupDefaultAnalyzeAction(): void {
    this.program
      .argument('[repoPath]', 'Git 仓库根目录路径（默认当前目录）')
      .option('-s, --since <date>', '开始日期 (YYYY-MM-DD)')
      .option('-u, --until <date>', '结束日期 (YYYY-MM-DD)')
      .option('-y, --year <year>', '指定年份或年份范围 (例如: 2025 或 2023-2025)')
      .option('--all-time', '查询所有时间的数据（默认为最近一年）')
      .option('--self', '仅统计当前 Git 用户的提交 (author 的快捷方式)')
      .option('--author <name>', '仅统计指定作者（支持名称或邮箱部分匹配）')
      .option(
        '--exclude-authors <names>',
        '排除作者（逗号分隔，支持名称或邮箱部分匹配，适用于排除 bot/CI 等自动化账号）'
      )
      .option('--weekend-span-threshold <hours>', '周末真正加班的最小时跨度（小时，默认 3）')
      .option('--weekend-commit-threshold <count>', '周末真正加班的最少提交次数（默认 3）')
      .option(
        '--weekday-overtime-mode <mode>',
        '工作日加班展示模式 commits|days|both（默认 both）'
      )
      .option('--end-hour <hour>', '自定义下班时间（24小时制，例如 18，用于更精确的加班分级）')
      .option('--repos <paths>', '多个仓库路径（逗号分隔，用于综合分析多个项目）')
      .action(async (repoPath: string | undefined, options: AnalyzeOptions, command: Command) => {
        const processedArgs = typeof repoPath === 'string' ? 1 : 0
        const extraArgs = (command.args ?? []).slice(processedArgs)

        if (extraArgs.length > 0) {
          const invalid = extraArgs[0]
          console.error(chalk.red(`错误: 未知命令 '${invalid}'`))
          console.log('运行 code996 -h 查看可用命令')
          process.exit(1)
        }

        const mergedOptions = this.mergeGlobalOptions(options)
        
        // 如果提供了 --repos 参数,则使用多仓库模式
        if (mergedOptions.repos) {
          await this.handleAnalyzeMultiple(mergedOptions)
        } else {
          const targetPath = this.resolveTargetPath(repoPath, this.program.name())
          await this.handleAnalyze(targetPath, mergedOptions)
        }
      })
  }

  /** 注册 trend 命令，分析月度趋势并支持自定义仓库路径 */
  private addTrendCommand(): void {
    const trendCmd = new Command('trend')
      .description('分析月度996指数和工作时间的变化趋势')
      .option('-s, --since <date>', '开始日期 (YYYY-MM-DD)')
      .option('-u, --until <date>', '结束日期 (YYYY-MM-DD)')
      .option('-y, --year <year>', '指定年份或年份范围 (例如: 2025 或 2023-2025)')
      .option('--all-time', '查询所有时间的数据')
      .option('--self', '仅统计当前 Git 用户的提交 (author 的快捷方式)')
      .option('--author <name>', '仅统计指定作者（支持名称或邮箱部分匹配）')
      .option(
        '--exclude-authors <names>',
        '排除作者（逗号分隔，支持名称或邮箱部分匹配，适用于排除 bot/CI 等自动化账号）'
      )
      .option('--merge', '合并同名不同邮箱的作者')
      .option('--weekend-span-threshold <hours>', '周末真正加班的最小时跨度（小时，默认 3）')
      .option('--weekend-commit-threshold <count>', '周末真正加班的最少提交次数（默认 3）')
      .option(
        '--weekday-overtime-mode <mode>',
        '工作日加班展示模式 commits|days|both（默认 both）'
      )
      .option('--end-hour <hour>', '自定义下班时间（24小时制，例如 18，用于更精确的加班分级）')
      .option('--repos <paths>', '多个仓库路径（逗号分隔，用于综合分析多个项目）')
      .argument('[repoPath]', 'Git 仓库根目录路径（默认当前目录）')
      .action(async (repoPath: string | undefined, options: AnalyzeOptions, command: Command) => {
        const processedArgs = typeof repoPath === 'string' ? 1 : 0
        const extraArgs = (command.args ?? []).slice(processedArgs)

        if (extraArgs.length > 0) {
          const invalid = extraArgs[0]
          console.error(chalk.red(`错误: 未知命令 '${invalid}'`))
          console.log('运行 code996 help 查看可用命令')
          process.exit(1)
        }

        const targetPath = this.resolveTargetPath(repoPath, `${this.program.name()} trend`)
        await this.handleTrend(targetPath, options)
      })

    this.program.addCommand(trendCmd)
  }

  /** 注册 ranking 命令，统计所有提交者的996指数并排序 */
  private addRankingCommand(): void {
    const rankingCmd = new Command('ranking')
      .description('统计排序所有提交者的996指数（卷王排行榜）')
      .option('-s, --since <date>', '开始日期 (YYYY-MM-DD)')
      .option('-u, --until <date>', '结束日期 (YYYY-MM-DD)')
      .option('-y, --year <year>', '指定年份或年份范围 (例如: 2025 或 2023-2025)')
      .option('--all-time', '查询所有时间的数据')
      .option('--self', '仅统计当前 Git 用户的提交 (author 的快捷方式)')
      .option('--author <name>', '仅统计指定作者（支持名称或邮箱部分匹配）')
      .option(
        '--exclude-authors <names>',
        '排除作者（逗号分隔，支持名称或邮箱部分匹配，适用于排除 bot/CI 等自动化账号）'
      )
      .option('--merge', '合并同名不同邮箱的作者')
      .option('--weekend-span-threshold <hours>', '周末真正加班的最小时跨度（小时，默认 3）')
      .option('--weekend-commit-threshold <count>', '周末真正加班的最少提交次数（默认 3）')
      .option(
        '--weekday-overtime-mode <mode>',
        '工作日加班展示模式 commits|days|both（默认 both）'
      )
      .option('--end-hour <hour>', '自定义下班时间（24小时制，例如 18，用于更精确的加班分级）')
      .option('--repos <paths>', '多个仓库路径（逗号分隔，用于综合分析多个项目）')
      .argument('[repoPath]', 'Git 仓库根目录路径（默认当前目录）')
      .action(async (repoPath: string | undefined, options: any, command: Command) => {
        const processedArgs = typeof repoPath === 'string' ? 1 : 0
        const extraArgs = (command.args ?? []).slice(processedArgs)

        if (extraArgs.length > 0) {
          const invalid = extraArgs[0]
          console.error(chalk.red(`错误: 未知命令 '${invalid}'`))
          console.log('运行 code996 help 查看可用命令')
          process.exit(1)
        }

        const targetPath = this.resolveTargetPath(repoPath, `${this.program.name()} ranking`)
        await this.handleRanking(targetPath, options)
      })

    this.program.addCommand(rankingCmd)
  }

  /** 注册 help 命令，提供统一的帮助入口 */
  private addHelpCommand(): void {
    const helpCmd = new Command('help').description('显示帮助信息').action(() => {
      this.showHelp()
    })

    this.program.addCommand(helpCmd)
  }

  /** 统一注册错误处理逻辑，提升用户体验 */
  private setupErrorHandling(): void {
    this.program.on('command:*', (operands) => {
      console.error(chalk.red(`错误: 未知命令 '${operands[0]}'`))
      console.log('运行 code996 -h 查看可用命令')
      process.exit(1)
    })

    this.program.on('error', (err) => {
      console.error(chalk.red('发生错误:'), err.message)
      process.exit(1)
    })
  }

  /** 处理分析流程的执行逻辑，targetPath 为已校验的 Git 根目录 */
  private async handleAnalyze(targetPath: string, options: AnalyzeOptions): Promise<void> {
    // 默认以当前工作目录作为分析目标，保持使用体验简单
    // 导入analyze命令并执行
    const mergedOptions = this.mergeGlobalOptions(options)
    const { AnalyzeExecutor } = await import('./commands/analyze')
    await AnalyzeExecutor.execute(targetPath, mergedOptions)
    printGlobalNotices()
  }

  /** 处理多仓库分析流程 */
  private async handleAnalyzeMultiple(options: AnalyzeOptions): Promise<void> {
    const { AnalyzeExecutor } = await import('./commands/analyze')
    await AnalyzeExecutor.executeMultiple(options)
    printGlobalNotices()
  }

  /** 处理趋势分析流程的执行逻辑，targetPath 为已校验的 Git 根目录 */
  private async handleTrend(targetPath: string, options: AnalyzeOptions): Promise<void> {
    // 导入trend命令并执行
    const mergedOptions = this.mergeGlobalOptions(options)
    const { TrendExecutor } = await import('./commands/trend')
    await TrendExecutor.execute(targetPath, mergedOptions)
    printGlobalNotices()
  }

  /** 处理排名分析流程的执行逻辑，targetPath 为已校验的 Git 根目录 */
  private async handleRanking(targetPath: string, options: any): Promise<void> {
    // 导入ranking命令并执行
    const mergedOptions = this.mergeGlobalOptions(options)
    const { RankingExecutor } = await import('./commands/ranking')
    await RankingExecutor.execute(targetPath, mergedOptions)
    printGlobalNotices()
  }

  /** 合并全局选项（解决子命令无法直接读取根命令参数的问题） */
  private mergeGlobalOptions(options: AnalyzeOptions): AnalyzeOptions {
    const globalOpts = this.program.opts<AnalyzeOptions>()
    return {
      ...options,
      self: options.self ?? globalOpts.self,
      allTime: options.allTime ?? globalOpts.allTime,
      since: options.since ?? globalOpts.since,
      until: options.until ?? globalOpts.until,
      year: options.year ?? globalOpts.year,
      author: options.author ?? (globalOpts as any).author,
      excludeAuthors: options.excludeAuthors ?? (globalOpts as any).excludeAuthors,
      merge: options.merge ?? (globalOpts as any).merge,
      weekendSpanThreshold: options.weekendSpanThreshold ?? (globalOpts as any).weekendSpanThreshold,
      weekendCommitThreshold: options.weekendCommitThreshold ?? (globalOpts as any).weekendCommitThreshold,
      weekdayOvertimeMode: options.weekdayOvertimeMode ?? (globalOpts as any).weekdayOvertimeMode,
      endHour: options.endHour ?? (globalOpts as any).endHour,
      repos: options.repos ?? (globalOpts as any).repos,
    }
  }

  /** 解析并校验仓库路径，确保用户位于 Git 仓库根目录 */
  private resolveTargetPath(repoPathArg: string | undefined, commandLabel: string): string {
    const candidatePath = path.resolve(repoPathArg ?? process.cwd())

    if (!fs.existsSync(candidatePath)) {
      console.error(chalk.red('❌ 指定的目录不存在:'), candidatePath)
      console.log(chalk.yellow('请确认路径是否正确，或在 Git 仓库根目录运行命令。'))
      process.exit(1)
    }

    const stat = fs.statSync(candidatePath)
    if (!stat.isDirectory()) {
      console.error(chalk.red('❌ 指定路径不是目录:'), candidatePath)
      console.log(chalk.yellow('请传入 Git 仓库根目录，而不是单个文件。'))
      process.exit(1)
    }

    let gitRootRaw: string
    try {
      gitRootRaw = execSync('git rev-parse --show-toplevel', {
        cwd: candidatePath,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .toString()
        .trim()
    } catch {
      console.error(chalk.red('❌ 未检测到有效的 Git 仓库:'), candidatePath)
      console.log(chalk.yellow('请在 Git 仓库根目录执行命令，或在命令末尾追加 Git 仓库路径，例如：'))
      console.log(chalk.cyan(`  ${commandLabel} /path/to/your/repo`))
      process.exit(1)
    }

    const normalizedCandidate = fs.realpathSync(candidatePath)
    const normalizedRoot = fs.realpathSync(gitRootRaw)

    if (normalizedCandidate !== normalizedRoot) {
      this.printGitRootWarning(normalizedCandidate, normalizedRoot, commandLabel)
    }

    return normalizedRoot
  }

  /** 强提示当前路径非 Git 根目录，并指引用户的正确使用方式 */
  private printGitRootWarning(currentPath: string, rootPath: string, commandLabel: string): never {
    console.error(chalk.bgRed.white(' ⚠️ 当前目录不是 Git 仓库根目录 '))
    console.error(chalk.red(`当前目录: ${currentPath}`))
    console.error(chalk.green(`仓库根目录: ${rootPath}`))
    console.log(chalk.yellow('请在仓库根目录执行命令，或直接在命令末尾追加根目录路径，例如：'))
    console.log(chalk.cyan(`  ${commandLabel} ${rootPath}`))
    console.log(chalk.yellow('提示: 若你在子目录中，请先 cd 到上面的仓库根目录后再运行。'))
    process.exit(1)
  }

  /** 自定义帮助信息展示，补充常用示例 */
  private showHelp(): void {
    // 使用更紧凑的 CODE996 字符图，避免在窄终端中被截断
    const banner = `
 ████    ████   █████   ██████   ████    ████    ████
██  ██  ██  ██  ██  ██  ██      ██  ██  ██  ██  ██
██      ██  ██  ██  ██  █████    █████   █████  █████
██  ██  ██  ██  ██  ██  ██          ██      ██  ██  ██
 ████    ████   █████   ██████   ████    ████    ████
`

    console.log(chalk.hex('#D72654')(banner))
    console.log(`> 统计 Git 项目的 commit 时间分布，进而推导出项目的编码工作强度。

${chalk.bold('使用方法:')}
  code996 [选项]
  code996 trend [选项]

${chalk.bold('命令:')}
  trend             查看月度996指数和工作时间的变化趋势
  ranking           统计排序所有提交者的996指数（卷王排行榜）
  help              显示帮助信息

${chalk.bold('全局选项:')}
  -v, --version     显示版本号
  -h, --help        显示帮助信息

${chalk.bold('分析选项:')}
  -s, --since <date>      开始日期 (YYYY-MM-DD)
  -u, --until <date>      结束日期 (YYYY-MM-DD)
  -y, --year <year>       指定年份或年份范围 (例如: 2025 或 2023-2025)
  --all-time              查询所有时间的数据（覆盖整个仓库历史）
  --self                  仅统计当前 Git 用户的提交 (author 的快捷方式)
  --author <str>          仅统计指定作者（支持名称或邮箱部分匹配）
  --exclude-authors <ls>  排除作者（逗号分隔，支持名称或邮箱部分匹配，排除 bot/CI 等）
  --merge                 合并同名不同邮箱的作者（用于 ranking/trend）
  --weekend-span-threshold <h>   周末真正加班的最小时跨度（小时，默认 3）
  --weekend-commit-threshold <n> 周末真正加班的最少提交次数（默认 3）
  --weekday-overtime-mode <mode> 工作日加班展示模式 commits|days|both（默认 both）
  --end-hour <hour>              自定义下班时间（24小时制，例如 18，用于更精确的加班分级）
  --repos <paths>                多个仓库路径（逗号分隔，用于综合分析多个项目）

${chalk.bold('默认策略:')}
  自动以最后一次提交为基准，回溯365天进行分析
  周末真正加班：同时满足跨度>=weekend-span-threshold 且 提交数>=weekend-commit-threshold
  工作日加班：提交次数统计使用下班后整点提交；加班天数统计使用最后一次提交时间 >= 推测下班时间

${chalk.bold('示例:')}
  ${chalk.gray('# 基础分析')}
  code996                       # 分析最近一年
  code996 --since 2024-01-01    # 从指定日期开始
  code996 -y 2025               # 分析2025年整年
  code996 -y 2023-2025          # 分析2023-2025年
  code996 --all-time            # 分析所有时间

  ${chalk.gray('# 趋势分析')}
  code996 trend                 # 分析最近一年的月度趋势
  code996 trend -y 2024         # 分析2024年各月趋势
  code996 trend --all-time      # 分析所有时间的月度趋势

  ${chalk.gray('# 卷王排行榜')}
  code996 ranking               # 查看所有提交者的996指数排名
  code996 ranking -y 2024       # 查看2024年的排名
  code996 ranking --author 张三  # 查看指定作者的详细信息
  code996 ranking --exclude-authors bot,CI  # 排除机器人
  code996 ranking --merge       # 合并同名不同邮箱的作者统计

  ${chalk.gray('# 自定义下班时间与加班分级')}
  code996 --end-hour 18         # 设置18点下班，自动分析加班严重程度
  code996 --end-hour 19 -y 2025 # 设置19点下班分析2025年

  ${chalk.gray('# 多仓库综合分析')}
  code996 --repos "/path/repo1,/path/repo2"  # 合并多个仓库统计

${chalk.bold('更多详情请访问:')} https://github.com/code996/code996
    `)
  }

  /** 启动 CLI 参数解析入口 */
  parse(argv: string[]): void {
    this.program.parse(argv)
  }
}
