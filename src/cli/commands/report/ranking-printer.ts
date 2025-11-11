import chalk from 'chalk'
import Table from 'cli-table3'
import { AuthorRankingResult } from '../../../types/git-types'
import { RankingOptions } from '../ranking'

/**
 * 打印作者排名结果
 */
export function printAuthorRanking(result: AuthorRankingResult, options: RankingOptions): void {
  const { authors, totalAuthors, timeRange } = result

  // 打印标题
  console.log(chalk.bold.hex('#D72654')('\n🏆 ============ 卷王排行榜 ============ 🏆\n'))

  // 如果指定了单个作者，显示详细信息
  if (options.author && authors.length === 1) {
    printSingleAuthorDetail(authors[0])
    return
  }

  // 创建表格
  const table = new Table({
    head: [
      chalk.cyan('排名'),
      chalk.cyan('作者'),
      chalk.cyan('邮箱'),
      chalk.cyan('提交数'),
      chalk.cyan('996指数'),
      chalk.cyan('加班率'),
      chalk.cyan('周末提交'),
    ],
    colWidths: [8, 20, 30, 12, 12, 12, 12],
    wordWrap: true,
  })

  // 填充表格数据
  authors.forEach((author, index) => {
    const rank = index + 1
    const rankEmoji = getRankEmoji(rank)
  // overTimeRadio 已经是百分比整数或小数（例如 8 表示 8%），无需再次乘 100
  const percentOvertime = author.overTimeRadio.toFixed(1) + '%'
    const weekendPercent = ((author.weekendCommits / author.totalCommits) * 100).toFixed(1) + '%'

    // 根据996指数着色
    const index996Color = getIndex996Color(author.index996)

    table.push([
      `${rankEmoji} ${rank}`,
      truncateString(author.name, 18),
      truncateString(author.email, 28),
      author.totalCommits,
      chalk.hex(index996Color)(author.index996.toFixed(1)),
      percentOvertime,
      weekendPercent,
    ])
  })

  console.log(table.toString())
  console.log()

  // 打印统计摘要
  printSummary(result)

  // 打印说明
  printLegend()
}

/**
 * 打印单个作者的详细信息
 */
function printSingleAuthorDetail(author: any): void {
  console.log(chalk.bold('📊 作者详细信息\n'))

  const details = [
    ['作者名字', author.name],
    ['邮箱地址', author.email],
    ['总提交数', author.totalCommits],
    ['996指数', `${chalk.hex(getIndex996Color(author.index996))(author.index996.toFixed(1))} (${author.index996Str})`],
  ['加班率', `${author.overTimeRadio.toFixed(1)}%`],
    ['工作时间提交', author.workingHourCommits],
    ['加班时间提交', author.overtimeCommits],
    ['工作日提交', author.weekdayCommits],
    ['周末提交', `${author.weekendCommits} (${((author.weekendCommits / author.totalCommits) * 100).toFixed(1)}%)`],
  ]

  const table = new Table({
    colWidths: [20, 50],
  })

  details.forEach(([key, value]) => {
    table.push([chalk.cyan(key), value])
  })

  console.log(table.toString())
  console.log()
}

/**
 * 打印统计摘要
 */
function printSummary(result: AuthorRankingResult): void {
  const { authors } = result

  const totalCommits = authors.reduce((sum, a) => sum + a.totalCommits, 0)
  const avgIndex996 = authors.reduce((sum, a) => sum + a.index996, 0) / authors.length
  const maxIndex996 = Math.max(...authors.map((a) => a.index996))
  const minIndex996 = Math.min(...authors.map((a) => a.index996))

  console.log(chalk.bold('📈 统计摘要'))
  console.log(chalk.gray('─'.repeat(60)))
  console.log(`  总提交者数量: ${chalk.yellow(authors.length)}`)
  console.log(`  总提交数: ${chalk.yellow(totalCommits)}`)
  console.log(`  平均996指数: ${chalk.yellow(avgIndex996.toFixed(2))}`)
  console.log(`  最高996指数: ${chalk.red(maxIndex996.toFixed(2))} (${authors[0].name})`)
  console.log(`  最低996指数: ${chalk.green(minIndex996.toFixed(2))} (${authors[authors.length - 1].name})`)
  console.log()
}

/**
 * 打印图例说明
 */
function printLegend(): void {
  console.log(chalk.bold('📖 指标说明'))
  console.log(chalk.gray('─'.repeat(60)))
  console.log('  • 996指数: 综合工作强度指标，数值越高表示加班越严重')
  console.log('  • 加班率: 非工作时间提交占总提交的比例')
  console.log('  • 周末提交: 周末提交占总提交的比例')
  console.log()
  console.log(chalk.yellow('💡 提示: 使用 --author <名字> 查看指定作者详情'))
  console.log(chalk.yellow('💡 提示: 使用 --exclude-authors <名字1>,<名字2> 排除机器人'))
  console.log()
}

/**
 * 获取排名 emoji
 */
function getRankEmoji(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return '  '
}

/**
 * 根据996指数获取颜色
 */
function getIndex996Color(index: number): string {
  if (index >= 80) return '#FF0000' // 深红 - 非常严重
  if (index >= 60) return '#FF6B6B' // 红色 - 严重
  if (index >= 40) return '#FFA500' // 橙色 - 中等
  if (index >= 20) return '#FFD700' // 金色 - 轻度
  return '#90EE90' // 绿色 - 正常
}

/**
 * 截断字符串
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + '...'
}
