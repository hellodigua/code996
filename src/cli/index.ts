import { Command } from 'commander'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { getPackageVersion } from '../utils/version'
import { printGlobalNotices } from './common/notices'
import { AnalyzeOptions } from '../types/git-types'

// Re-export types for convenience
export { AnalyzeOptions }

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
    this.addHelpCommand()

    // 错误处理
    this.setupErrorHandling()
  }

  /** 注册根命令，支持智能检测单仓库或多仓库场景 */
  private setupDefaultAnalyzeAction(): void {
    this.program
      .argument('[paths...]', 'Git 仓库路径（默认当前目录，支持多个路径）')
      .option('-s, --since <date>', '开始日期 (YYYY-MM-DD)')
      .option('-u, --until <date>', '结束日期 (YYYY-MM-DD)')
      .option('-y, --year <year>', '指定年份或年份范围 (例如: 2025 或 2023-2025)')
      .option('--all-time', '查询所有时间的数据（默认为最近一年）')
      .option('--self', '仅统计当前 Git 用户的提交')
      .option('-H, --hours <range>', '手动指定标准工作时间 (例如: 9-18 或 9.5-18.5)')
      .option('--half-hour', '以半小时粒度展示时间分布（默认按小时展示）')
      .option('--ignore-author <regex>', '排除匹配的作者 (例如: bot|jenkins)')
      .option('--ignore-msg <regex>', '排除匹配的提交消息 (例如: merge|lint)')
      .option('--timezone <offset>', '指定时区进行分析 (例如: +0800, -0700)')
      .option('--cn', '强制开启中国节假日调休模式（自动检测 +0800 时区）')
      .option('--skip-user-analysis', '跳过团队工作模式分析')
      .option('--max-users <number>', '最大分析用户数（默认30）', '30')
      .option('-e, --export <format>', '导出报告格式 (json 或 markdown)')
      .option('-o, --output <path>', '导出文件路径 (默认: report.json 或 report.md)')
      .action(async (paths: string[], options: AnalyzeOptions, command: Command) => {
        const mergedOptions = this.mergeGlobalOptions(options)

        // 智能检测模式
        await this.handleSmartMode(paths, mergedOptions)
      })
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

  /**
   * 智能模式：根据路径和上下文自动判断是单仓库还是多仓库分析
   */
  private async handleSmartMode(paths: string[], options: AnalyzeOptions): Promise<void> {
    const targetPaths = paths.length > 0 ? paths : [process.cwd()]

    // 情况1: 传入多个路径，直接进入多仓库模式
    if (targetPaths.length > 1) {
      console.log(chalk.cyan('💡 检测到多个路径，自动进入多仓库分析模式'))
      console.log()
      await this.handleMulti(targetPaths, options)
      return
    }

    // 情况2: 单个路径，需要智能判断
    const singlePath = path.resolve(targetPaths[0])

    // 检查路径是否存在
    if (!fs.existsSync(singlePath)) {
      console.error(chalk.red('❌ 指定的路径不存在:'), singlePath)
      process.exit(1)
    }

    // 检查是否为Git仓库
    const isGit = await this.isGitRepository(singlePath)

    if (isGit) {
      // 是Git仓库，使用单仓库分析
      const gitRoot = this.resolveGitRoot(singlePath)
      await this.handleAnalyze(gitRoot, options)
      return
    }

    // 不是Git仓库，尝试扫描子目录
    console.log(chalk.yellow('⚠️  当前目录不是 Git 仓库，正在扫描子目录...'))
    console.log()

    const { RepoScanner } = await import('../workspace/repo-scanner')
    const repos = await RepoScanner.scanSubdirectories(singlePath)

    if (repos.length === 0) {
      console.error(chalk.red('❌ 未在当前目录找到 Git 仓库'))
      console.log()
      console.log(chalk.cyan('💡 提示:'))
      console.log('  • 请在 Git 仓库根目录运行 code996')
      console.log('  • 或者使用 code996 <仓库路径> 指定要分析的仓库')
      console.log('  • 或者传入多个路径进行对比: code996 /path1 /path2')
      process.exit(1)
    }

    if (repos.length === 1) {
      // 只有一个子仓库，自动使用单仓库模式
      console.log(chalk.green('✓ 找到 1 个 Git 仓库，自动使用单仓库分析模式'))
      console.log(chalk.gray(`  仓库: ${repos[0].name}`))
      console.log()
      await this.handleAnalyze(repos[0].path, options)
      return
    }

    // 多个子仓库，进入多仓库模式（传递已扫描的仓库列表）
    console.log(chalk.cyan(`💡 找到 ${repos.length} 个 Git 仓库，自动进入多仓库分析模式`))
    console.log()
    await this.handleMulti([], options, repos)
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

  /** 处理多仓库分析流程的执行逻辑 */
  private async handleMulti(dirs: string[], options: AnalyzeOptions, preScannedRepos?: any[]): Promise<void> {
    const mergedOptions = this.mergeGlobalOptions(options)
    const { MultiExecutor } = await import('./commands/multi')
    await MultiExecutor.execute(dirs, mergedOptions, preScannedRepos)
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
      hours: options.hours ?? globalOpts.hours,
      halfHour: options.halfHour ?? globalOpts.halfHour,
      ignoreAuthor: options.ignoreAuthor ?? globalOpts.ignoreAuthor,
      ignoreMsg: options.ignoreMsg ?? globalOpts.ignoreMsg,
      timezone: options.timezone ?? globalOpts.timezone,
      export: options.export ?? globalOpts.export,
      output: options.output ?? globalOpts.output,
    }
  }

  /**
   * 检查指定目录是否为 Git 仓库
   */
  private async isGitRepository(dirPath: string): Promise<boolean> {
    try {
      // 检查 .git 目录是否存在
      const gitDir = path.join(dirPath, '.git')
      if (fs.existsSync(gitDir)) {
        return true
      }

      // 使用 git 命令检查
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: dirPath,
        stdio: 'ignore',
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * 解析 Git 仓库的根目录
   */
  private resolveGitRoot(dirPath: string): string {
    try {
      const gitRoot = execSync('git rev-parse --show-toplevel', {
        cwd: dirPath,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .toString()
        .trim()

      return fs.realpathSync(gitRoot)
    } catch {
      // 如果获取失败，返回原路径
      return fs.realpathSync(dirPath)
    }
  }

  /** 解析并校验仓库路径，确保用户位于 Git 仓库根目录（仅用于向后兼容） */
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
  code996 [路径...] [选项]

${chalk.bold('命令:')}
  help              显示帮助信息

${chalk.bold('智能分析模式:')}
  code996 会自动检测并选择最合适的分析模式：

  ${chalk.cyan('●')} ${chalk.bold('单仓库深度分析')}
    • 在 Git 仓库中运行 code996
    • 或指定单个仓库路径: code996 /path/to/repo
    → 深度分析单个项目，包含月度趋势

  ${chalk.cyan('●')} ${chalk.bold('多仓库横向对比')}
    • 传入多个路径: code996 /path1 /path2
    • 或在有多个子仓库的目录运行
    → 自动进入多仓库模式，汇总分析

${chalk.bold('全局选项:')}
  -v, --version     显示版本号
  -h, --help        显示帮助信息

${chalk.bold('分析选项:')}
  -s, --since <date>      开始日期 (YYYY-MM-DD)
  -u, --until <date>      结束日期 (YYYY-MM-DD)
  -y, --year <year>       指定年份或年份范围 (例如: 2025 或 2023-2025)
  --all-time              查询所有时间的数据（覆盖整个仓库历史）
  --self                  仅统计当前 Git 用户的提交
  -H, --hours <range>     手动指定标准工作时间 (例如: 9-18 或 9.5-18.5)
  --half-hour             以半小时粒度展示时间分布（默认按小时展示）
  --ignore-author <regex> 排除匹配的作者 (例如: bot|jenkins)
  --ignore-msg <regex>    排除匹配的提交消息 (例如: merge|lint)

${chalk.bold('导出选项:')}
  -e, --export <format>   导出报告格式 (json 或 markdown)
  -o, --output <path>     导出文件路径 (默认: report.json 或 report.md)

${chalk.bold('默认策略:')}
  自动以最后一次提交为基准，回溯365天进行分析

${chalk.bold('示例:')}
  ${chalk.gray('# 单仓库分析')}
  code996                       # 分析当前仓库（最近一年）
  code996 /path/to/repo         # 分析指定仓库
  code996 -y 2025               # 分析2025年整年
  code996 --self                # 只统计当前用户的提交
  code996 --ignore-author "bot" # 排除机器人提交

  ${chalk.gray('# 多仓库分析')}
  code996 /proj1 /proj2         # 传入多个路径，自动分析多个仓库
  code996 /workspace            # 子目录有多个仓库，自动进入多仓库模式
  code996 -y 2024 --self        # 组合使用，分析2024年自己的提交

  ${chalk.gray('# 过滤噪音数据')}
  code996 --ignore-author "bot" # 排除所有包含 "bot" 的作者
  code996 --ignore-author "bot|jenkins|github-actions"  # 排除多个作者（使用 | 分隔）
  code996 --ignore-msg "^Merge" # 排除所有以 "Merge" 开头的提交消息
  code996 --ignore-msg "merge|lint|format"  # 排除多个关键词

  ${chalk.gray('# 导出报告')}
  code996 -e json               # 导出 JSON 格式
  code996 -e markdown           # 导出 Markdown 格式
  code996 -e json -o data.json  # 导出到指定路径

${chalk.bold('正则表达式语法说明:')}
  - 使用 | 分隔多个模式 (例如: bot|jenkins)
  - 使用 ^ 匹配开头 (例如: ^Merge)
  - 使用 $ 匹配结尾 (例如: fix$)
  - 使用 .* 匹配任意字符 (例如: bot.*)
  - 默认不区分大小写

${chalk.bold('更多详情请访问:')} https://github.com/hellodigua/code996
    `)
  }

  /** 启动 CLI 参数解析入口 */
  parse(argv: string[]): void {
    this.program.parse(argv)
  }
}
