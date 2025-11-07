import { Command } from 'commander'
import chalk from 'chalk'
import { getPackageVersion } from '../utils/version'

export interface AnalyzeOptions {
  since?: string
  until?: string
  allTime?: boolean
  year?: string
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
    this.addHelpCommand()

    // 错误处理
    this.setupErrorHandling()
  }

  /** 注册根命令，使用户直接运行 code996 即触发分析 */
  private setupDefaultAnalyzeAction(): void {
    this.program
      .option('-s, --since <date>', '开始日期 (YYYY-MM-DD)')
      .option('-u, --until <date>', '结束日期 (YYYY-MM-DD)')
      .option('-y, --year <year>', '指定年份或年份范围 (例如: 2025 或 2023-2025)')
      .option('--all-time', '查询所有时间的数据（默认为最近一年）')
      .action(async (options: AnalyzeOptions, command: Command) => {
        const extraArgs = command.args?.filter((arg) => typeof arg === 'string') as string[]

        if (extraArgs.length > 0) {
          const invalid = extraArgs[0]
          console.error(chalk.red(`错误: 未知命令 '${invalid}'`))
          console.log('运行 code996 -h 查看可用命令')
          process.exit(1)
        }

        await this.handleAnalyze(options)
      })
  }

  /** 注册 trend 命令，分析月度趋势 */
  private addTrendCommand(): void {
    const trendCmd = new Command('trend')
      .description('分析月度996指数和工作时间的变化趋势')
      .option('-s, --since <date>', '开始日期 (YYYY-MM-DD)')
      .option('-u, --until <date>', '结束日期 (YYYY-MM-DD)')
      .option('-y, --year <year>', '指定年份或年份范围 (例如: 2025 或 2023-2025)')
      .option('--all-time', '查询所有时间的数据')
      .action(async (options: AnalyzeOptions) => {
        await this.handleTrend(options)
      })

    this.program.addCommand(trendCmd)
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

  /** 处理分析流程的执行逻辑 */
  private async handleAnalyze(options: AnalyzeOptions): Promise<void> {
    // 默认以当前工作目录作为分析目标，保持使用体验简单
    // 导入analyze命令并执行
    const { AnalyzeExecutor } = await import('./commands/analyze')
    await AnalyzeExecutor.execute(process.cwd(), options)
  }

  /** 处理趋势分析流程的执行逻辑 */
  private async handleTrend(options: AnalyzeOptions): Promise<void> {
    // 导入trend命令并执行
    const { TrendExecutor } = await import('./commands/trend')
    await TrendExecutor.execute(process.cwd(), options)
  }

  /** 自定义帮助信息展示，补充常用示例 */
  private showHelp(): void {
    console.log(`
${chalk.bold.blue('code996-cli')} - Git 996 指数分析工具

${chalk.bold('使用方法:')}
  code996 [选项]
  code996 trend [选项]

${chalk.bold('命令:')}
  trend             查看月度996指数和工作时间的变化趋势
  help              显示帮助信息

${chalk.bold('全局选项:')}
  -v, --version     显示版本号
  -h, --help        显示帮助信息

${chalk.bold('分析选项:')}
  -s, --since <date>      开始日期 (YYYY-MM-DD)
  -u, --until <date>      结束日期 (YYYY-MM-DD)
  -y, --year <year>       指定年份或年份范围 (例如: 2025 或 2023-2025)
  --all-time              查询所有时间的数据（覆盖整个仓库历史）

${chalk.bold('默认策略:')}
  自动以最后一次提交为基准，回溯365天进行分析

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

${chalk.bold('更多详情请访问:')} https://github.com/code996/code996-cli
    `)
  }

  /** 启动 CLI 参数解析入口 */
  parse(argv: string[]): void {
    this.program.parse(argv)
  }
}
