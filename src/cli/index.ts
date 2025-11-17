import { Command } from 'commander'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { getPackageVersion } from '../utils/version'
import { printGlobalNotices } from './common/notices'
import { AnalyzeOptions, MultiOptions } from '../types/git-types'

// Re-export types for convenience
export { AnalyzeOptions, MultiOptions }

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
    this.addMultiCommand()
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
      .option('--self', '仅统计当前 Git 用户的提交')
      .option('-H, --hours <range>', '手动指定标准工作时间 (例如: 9-18 或 9.5-18.5)')
      .option('--half-hour', '以半小时粒度展示时间分布（默认按小时展示）')
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
        const targetPath = this.resolveTargetPath(repoPath, this.program.name())
        await this.handleAnalyze(targetPath, mergedOptions)
      })
  }

  /** 注册 multi 命令，分析多个仓库 */
  private addMultiCommand(): void {
    const multiCmd = new Command('multi')
      .description('分析多个Git仓库，汇总展示整体996指数')
      .option('-s, --since <date>', '开始日期 (YYYY-MM-DD)')
      .option('-u, --until <date>', '结束日期 (YYYY-MM-DD)')
      .option('-y, --year <year>', '指定年份或年份范围 (例如: 2025 或 2023-2025)')
      .option('--all-time', '查询所有时间的数据')
      .option('--self', '仅统计当前 Git 用户的提交')
      .option('-H, --hours <range>', '手动指定标准工作时间 (例如: 9-18 或 9.5-18.5)')
      .option('--half-hour', '以半小时粒度展示时间分布（默认按小时展示）')
      .argument('[dirs...]', '要扫描的目录列表（默认当前目录的子目录）')
      .action(async (dirs: string[], options: MultiOptions) => {
        await this.handleMulti(dirs, options)
      })

    this.program.addCommand(multiCmd)
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

  /** 处理多仓库分析流程的执行逻辑 */
  private async handleMulti(dirs: string[], options: MultiOptions): Promise<void> {
    // 导入multi命令并执行
    const mergedOptions = this.mergeGlobalOptions(options) as MultiOptions
    const { MultiExecutor } = await import('./commands/multi')
    await MultiExecutor.execute(dirs, mergedOptions)
    printGlobalNotices()
  }

  /** 合并全局选项（解决子命令无法直接读取根命令参数的问题） */
  private mergeGlobalOptions(options: AnalyzeOptions | MultiOptions): AnalyzeOptions | MultiOptions {
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
  code996 multi [选项] [目录...]

${chalk.bold('命令:')}
  multi             分析多个Git仓库，汇总展示整体996指数和月度趋势
  help              显示帮助信息

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

${chalk.bold('默认策略:')}
  自动以最后一次提交为基准，回溯365天进行分析

${chalk.bold('示例:')}
  ${chalk.gray('# 基础分析')}
  code996                       # 分析最近一年
  code996 --since 2024-01-01    # 从指定日期开始
  code996 -y 2025               # 分析2025年整年
  code996 -y 2023-2025          # 分析2023-2025年
  code996 --all-time            # 分析所有时间

  ${chalk.gray('# 多仓库分析（自动包含月度趋势）')}
  code996 multi                 # 扫描当前目录的子目录，选择仓库进行汇总分析
  code996 multi /path/to/dir1 /path/to/dir2  # 扫描指定目录
  code996 multi -y 2024         # 分析2024年的数据和趋势
  code996 multi --self          # 仅统计当前用户在所有仓库中的提交

${chalk.bold('更多详情请访问:')} https://github.com/code996/code996
    `)
  }

  /** 启动 CLI 参数解析入口 */
  parse(argv: string[]): void {
    this.program.parse(argv)
  }
}
