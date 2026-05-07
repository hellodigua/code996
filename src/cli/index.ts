import { Command } from 'commander'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { getPackageVersion } from '../utils/version'
import { printGlobalNotices } from './common/notices'
import { AnalyzeOptions } from '../types/git-types'
import { getLocale, initializeLocale, t } from '../i18n'

// Re-export types for convenience
export { AnalyzeOptions }

export class CLIManager {
  private program: Command

  /** 构造函数：初始化 Commander 实例并完成命令注册 */
  constructor(argv: string[] = []) {
    this.program = new Command()
    initializeLocale(argv)
    this.setupProgram()
  }

  /** 配置 CLI 的基础信息与可用命令 */
  private setupProgram(): void {
    this.program
      .name('code996')
      .description(t('cli.program.description'))
      .version(getPackageVersion(), '-v, --version', t('cli.program.version'))

    // 注册根命令默认行为，直接执行分析逻辑
    this.setupDefaultAnalyzeAction()
    this.addHelpCommand()

    // 错误处理
    this.setupErrorHandling()
  }

  /** 注册根命令，支持智能检测单仓库或多仓库场景 */
  private setupDefaultAnalyzeAction(): void {
    this.program
      .argument('[paths...]', t('cli.args.paths'))
      .option('-s, --since <date>', t('cli.option.since'))
      .option('-u, --until <date>', t('cli.option.until'))
      .option('-y, --year <year>', t('cli.option.year'))
      .option('--all-time', t('cli.option.allTime'))
      .option('--self', t('cli.option.self'))
      .option('-H, --hours <range>', t('cli.option.hours'))
      .option('--half-hour', t('cli.option.halfHour'))
      .option('--ignore-author <regex>', t('cli.option.ignoreAuthor'))
      .option('--ignore-msg <regex>', t('cli.option.ignoreMsg'))
      .option('--timezone <offset>', t('cli.option.timezone'))
      .option('--cn', t('cli.option.cn'))
      .option('--skip-user-analysis', t('cli.option.skipUserAnalysis'))
      .option('--max-users <number>', t('cli.option.maxUsers'), '30')
      .option('--lang <locale>', t('cli.option.lang'))
      .action(async (paths: string[], options: AnalyzeOptions, command: Command) => {
        if (options.lang) {
          initializeLocale(['--lang', options.lang])
        }

        const mergedOptions = this.mergeGlobalOptions(options)

        // 智能检测模式
        await this.handleSmartMode(paths, mergedOptions)
      })
  }

  /** 注册 help 命令，提供统一的帮助入口 */
  private addHelpCommand(): void {
    const helpCmd = new Command('help').description(t('cli.help.command')).action(() => {
      this.showHelp()
    })

    this.program.addCommand(helpCmd)
  }

  /** 统一注册错误处理逻辑，提升用户体验 */
  private setupErrorHandling(): void {
    this.program.on('command:*', (operands) => {
      console.error(chalk.red(t('cli.error.unknownCommand', { command: operands[0] })))
      console.log(t('cli.error.useHelp'))
      process.exit(1)
    })

    this.program.on('error', (err) => {
      console.error(chalk.red(t('cli.error.generic')), err.message)
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
      console.log(chalk.cyan(`💡 ${t('cli.mode.multiDetected')}`))
      console.log()
      await this.handleMulti(targetPaths, options)
      return
    }

    // 情况2: 单个路径，需要智能判断
    const singlePath = path.resolve(targetPaths[0])

    // 检查路径是否存在
    if (!fs.existsSync(singlePath)) {
      console.error(chalk.red(`❌ ${t('cli.error.pathNotExist')}`), singlePath)
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
    console.log(chalk.yellow(`⚠️  ${t('cli.scan.notGit')}`))
    console.log()

    const { RepoScanner } = await import('../workspace/repo-scanner')
    const repos = await RepoScanner.scanSubdirectories(singlePath)

    if (repos.length === 0) {
      console.error(chalk.red(`❌ ${t('cli.scan.notFound')}`))
      console.log()
      console.log(chalk.cyan(`💡 ${t('cli.scan.tipTitle')}`))
      console.log(`  • ${t('cli.scan.tip.root')}`)
      console.log(`  • ${t('cli.scan.tip.path')}`)
      console.log(`  • ${t('cli.scan.tip.multi')}`)
      process.exit(1)
    }

    if (repos.length === 1) {
      // 只有一个子仓库，自动使用单仓库模式
      console.log(chalk.green(`✓ ${t('cli.scan.singleFound')}`))
      console.log(chalk.gray(`  ${t('cli.scan.repoLabel', { name: repos[0].name })}`))
      console.log()
      await this.handleAnalyze(repos[0].path, options)
      return
    }

    // 多个子仓库，进入多仓库模式（传递已扫描的仓库列表）
    console.log(chalk.cyan(`💡 ${t('cli.scan.multiFound', { count: repos.length })}`))
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
      lang: options.lang ?? globalOpts.lang,
      hours: options.hours ?? globalOpts.hours,
      halfHour: options.halfHour ?? globalOpts.halfHour,
      ignoreAuthor: options.ignoreAuthor ?? globalOpts.ignoreAuthor,
      ignoreMsg: options.ignoreMsg ?? globalOpts.ignoreMsg,
      timezone: options.timezone ?? globalOpts.timezone,
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
      console.error(chalk.red(`❌ ${t('cli.error.dirNotExist')}`), candidatePath)
      console.log(chalk.yellow(t('cli.error.dirNotExistHint')))
      process.exit(1)
    }

    const stat = fs.statSync(candidatePath)
    if (!stat.isDirectory()) {
      console.error(chalk.red(`❌ ${t('cli.error.notDirectory')}`), candidatePath)
      console.log(chalk.yellow(t('cli.error.notDirectoryHint')))
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
      console.error(chalk.red(`❌ ${t('cli.error.invalidGitRepo')}`), candidatePath)
      console.log(chalk.yellow(t('cli.error.invalidGitRepoHint')))
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
    console.error(chalk.bgRed.white(t('cli.warning.notGitRoot')))
    console.error(chalk.red(t('cli.warning.currentDir', { path: currentPath })))
    console.error(chalk.green(t('cli.warning.repoRoot', { path: rootPath })))
    console.log(chalk.yellow(t('cli.warning.runAtRoot')))
    console.log(chalk.cyan(`  ${commandLabel} ${rootPath}`))
    console.log(chalk.yellow(t('cli.warning.cdHint')))
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
    const isZh = getLocale() === 'zh-CN'
    const exampleSingleCurrent = isZh ? '分析当前仓库（最近一年）' : 'Analyze current repo (past year)'
    const exampleSingleRepo = isZh ? '分析指定仓库' : 'Analyze the specified repo'
    const exampleSingleYear = isZh ? '分析2025年整年' : 'Analyze the full year 2025'
    const exampleSelf = isZh ? '只统计当前用户的提交' : "Only count the current user's commits"
    const exampleIgnoreBot = isZh ? '排除机器人提交' : 'Exclude bot commits'
    const exampleMultiPaths = isZh ? '传入多个路径，自动分析多个仓库' : 'Pass multiple paths and analyze multiple repos'
    const exampleMultiWorkspace = isZh ? '子目录有多个仓库，自动进入多仓库模式' : 'Auto-enter multi-repo mode when subdirectories contain repos'
    const exampleMultiSelf = isZh ? '组合使用，分析2024年自己的提交' : 'Combine options to analyze your 2024 commits'
    const exampleFilterAuthor = isZh ? '排除所有包含 "bot" 的作者' : 'Exclude all authors containing "bot"'
    const exampleFilterAuthors = isZh ? '排除多个作者（使用 | 分隔）' : 'Exclude multiple authors (separate with |)'
    const exampleFilterMsg = isZh ? '排除所有以 "Merge" 开头的提交消息' : 'Exclude commit messages starting with "Merge"'
    const exampleFilterMsgs = isZh ? '排除多个关键词' : 'Exclude multiple keywords'

    console.log(`${t('cli.help.tagline')}

${chalk.bold(t('cli.help.usage'))}
  code996 [路径...] [选项]

${chalk.bold(t('cli.help.commands'))}
  help              ${t('cli.help.command')}

${chalk.bold(t('cli.help.smartMode'))}
  ${t('cli.help.smartDesc')}

  ${chalk.cyan('●')} ${chalk.bold(t('cli.help.singleTitle'))}
    • ${t('cli.help.singleLine1')}
    • ${t('cli.help.singleLine2')}
    → ${t('cli.help.singleLine3')}

  ${chalk.cyan('●')} ${chalk.bold(t('cli.help.multiTitle'))}
    • ${t('cli.help.multiLine1')}
    • ${t('cli.help.multiLine2')}
    → ${t('cli.help.multiLine3')}

${chalk.bold(t('cli.help.globalOptions'))}
  -v, --version     ${t('cli.program.version')}
  -h, --help        ${t('cli.help.command')}

${chalk.bold(t('cli.help.analysisOptions'))}
  -s, --since <date>      ${t('cli.option.since')}
  -u, --until <date>      ${t('cli.option.until')}
  -y, --year <year>       ${t('cli.option.year')}
  --all-time              ${t('cli.option.allTime')}
  --self                  ${t('cli.option.self')}
  -H, --hours <range>     ${t('cli.option.hours')}
  --half-hour             ${t('cli.option.halfHour')}
  --ignore-author <regex> ${t('cli.option.ignoreAuthor')}
  --ignore-msg <regex>    ${t('cli.option.ignoreMsg')}
  --lang <locale>         ${t('cli.option.lang')}

${chalk.bold(t('cli.help.defaultPolicy'))}
  ${t('cli.help.defaultPolicyLine')}

${chalk.bold(t('cli.help.examples'))}
  ${chalk.gray(t('cli.help.example.single'))}
  code996                       # ${exampleSingleCurrent}
  code996 /path/to/repo         # ${exampleSingleRepo}
  code996 -y 2025               # ${exampleSingleYear}
  code996 --self                # ${exampleSelf}
  code996 --ignore-author "bot" # ${exampleIgnoreBot}

  ${chalk.gray(t('cli.help.example.multi'))}
  code996 /proj1 /proj2         # ${exampleMultiPaths}
  code996 /workspace            # ${exampleMultiWorkspace}
  code996 -y 2024 --self        # ${exampleMultiSelf}

  ${chalk.gray(t('cli.help.example.filter'))}
  code996 --ignore-author "bot" # ${exampleFilterAuthor}
  code996 --ignore-author "bot|jenkins|github-actions"  # ${exampleFilterAuthors}
  code996 --ignore-msg "^Merge" # ${exampleFilterMsg}
  code996 --ignore-msg "merge|lint|format"  # ${exampleFilterMsgs}

${chalk.bold(t('cli.help.regex'))}
  ${t('cli.help.regex.line1')}
  ${t('cli.help.regex.line2')}
  ${t('cli.help.regex.line3')}
  ${t('cli.help.regex.line4')}
  ${t('cli.help.regex.line5')}

${chalk.bold(t('cli.help.more'))} https://github.com/hellodigua/code996
    `)
  }

  /** 启动 CLI 参数解析入口 */
  parse(argv: string[]): void {
    this.program.parse(argv)
  }

  /** 异步解析入口，便于测试和需要等待 action 完成的场景 */
  async parseAsync(argv: string[]): Promise<void> {
    await this.program.parseAsync(argv)
  }
}
