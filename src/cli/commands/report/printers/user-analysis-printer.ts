import chalk from 'chalk'
import { TeamAnalysis } from '../../../../types/git-types'
import { getTerminalWidth } from '../../../../utils/terminal'
import { getIndexColor } from '../../../../utils/formatter'
import { calculatePercentile } from '../../../../utils/statistics'

/**
 * 团队工作模式分析打印器
 * 负责打印团队工作节奏和健康度评估
 */

/**
 * 打印团队工作模式分析报表
 */
export function printTeamAnalysis(analysis: TeamAnalysis): void {
  console.log()
  console.log(chalk.cyan.bold(`👥 团队工作模式分析 (基于 ${analysis.totalAnalyzed} 位核心贡献者)`))
  console.log(chalk.gray('   数据来源：最近6个月的工作日commit'))
  console.log(chalk.gray(`━`.repeat(Math.min(getTerminalWidth(), 80))))
  console.log()

  // 1. 每日首次提交分布
  printStartTimeDistribution(analysis)

  // 2. 每日末次提交分布（使用百分位数方案）
  printEndTimePercentiles(analysis)

  // 3. 工作强度分布
  printIntensityDistribution(analysis)

  // 4. 团队健康度评估
  printHealthAssessment(analysis)
}

/**
 * 打印每日首次提交分布（基于每日首次commit的中位数）
 */
function printStartTimeDistribution(analysis: TeamAnalysis): void {
  // 收集有效数据的用户
  const usersWithData = analysis.coreContributors.filter((u) => u.avgStartTimeMedian !== undefined)

  if (usersWithData.length === 0) return

  // 提取中位数
  const medianTimes = usersWithData.map((u) => u.avgStartTimeMedian!).sort((a, b) => a - b)

  console.log(chalk.yellow.bold('🌅 每日首次提交分布（按中位数）：'))
  console.log()

  const medianP25 = calculatePercentile(medianTimes, 25)
  const medianP50 = calculatePercentile(medianTimes, 50)
  const medianP75 = calculatePercentile(medianTimes, 75)
  console.log(`   • 较早组（P25）：${formatTime(medianP25)}左右`)
  console.log(`   • 中位数（P50）：${formatTime(medianP50)}左右  ${chalk.gray('← 团队基准')}`)
  console.log(`   • 较晚组（P75）：${formatTime(medianP75)}左右`)
  console.log()
}

/**
 * 打印每日末次提交分布（基于每日末次commit的中位数）
 */
function printEndTimePercentiles(analysis: TeamAnalysis): void {
  // 收集有效数据的用户
  const usersWithData = analysis.coreContributors.filter((u) => u.avgEndTimeMedian !== undefined)

  if (usersWithData.length === 0) return

  // 提取中位数
  const medianTimes = usersWithData.map((u) => u.avgEndTimeMedian!).sort((a, b) => a - b)

  console.log(chalk.yellow.bold('🌙 每日末次提交分布（按中位数）：'))
  console.log()

  const medianP25 = calculatePercentile(medianTimes, 25)
  const medianP50 = calculatePercentile(medianTimes, 50)
  const medianP75 = calculatePercentile(medianTimes, 75)

  const countMedianP25 = medianTimes.filter((t) => t <= medianP25).length
  const countMedianP50 = medianTimes.filter((t) => t > medianP25 && t <= medianP50).length
  const countMedianP75 = medianTimes.filter((t) => t > medianP50 && t <= medianP75).length
  const countMedianOver = medianTimes.filter((t) => t > medianP75).length

  const total = medianTimes.length
  const pctMedianP25 = ((countMedianP25 / total) * 100).toFixed(0)
  const pctMedianP50 = ((countMedianP50 / total) * 100).toFixed(0)
  const pctMedianP75 = ((countMedianP75 / total) * 100).toFixed(0)
  const pctMedianOver = ((countMedianOver / total) * 100).toFixed(0)

  console.log(`   • 较早组（P25）：${formatTime(medianP25)}左右  (${countMedianP25}人, ${pctMedianP25}%)`)
  console.log(
    `   • 中位数（P50）：${formatTime(medianP50)}左右  (${countMedianP50}人, ${pctMedianP50}%)  ${chalk.gray('← 团队基准')}`
  )
  console.log(`   • 较晚组（P75）：${formatTime(medianP75)}左右  (${countMedianP75}人, ${pctMedianP75}%)`)
  if (countMedianOver > 0) {
    console.log(`   • 持续工作（>P75）：${formatTime(medianP75)}之后   (${countMedianOver}人, ${pctMedianOver}%)`)
  }
  console.log()

  // 分类评估（使用中位数的P50作为基准）
  const baselineEndHour = medianP50
  let assessment = ''
  if (baselineEndHour < 18.5) {
    assessment = '团队整体下班时间正常，工作生活平衡较好'
  } else if (baselineEndHour < 20) {
    assessment = '团队整体下班时间集中在适度加班区间'
  } else if (baselineEndHour < 21.5) {
    assessment = '团队整体加班较为普遍，建议关注成员健康'
  } else {
    assessment = '团队整体下班时间偏晚，加班强度较大'
  }

  console.log(`   ${chalk.gray('分类评估：' + assessment)}`)
  console.log()
}

/**
 * 打印工作强度分布（按996指数等级分组统计人数）
 */
function printIntensityDistribution(analysis: TeamAnalysis): void {
  console.log(chalk.yellow.bold('📈 工作强度分布：'))
  console.log()

  // 获取所有用户的996指数
  const index996List = analysis.coreContributors.map((u) => u.index996 || 0)
  const total = index996List.length

  if (total === 0) {
    console.log(chalk.gray('   暂无数据'))
    console.log()
    return
  }

  // 按等级分组统计
  const groups = {
    light: index996List.filter((i) => i < 40), // 较轻松
    medium: index996List.filter((i) => i >= 40 && i < 60), // 中等
    heavy: index996List.filter((i) => i >= 60 && i < 80), // 较累
    veryHeavy: index996List.filter((i) => i >= 80), // 很累
  }

  // 找出人数最多的等级
  const maxCount = Math.max(groups.light.length, groups.medium.length, groups.heavy.length, groups.veryHeavy.length)

  // 格式化显示函数
  const formatGroup = (count: number, label: string, range: string, color: (s: string) => string): string => {
    const pct = ((count / total) * 100).toFixed(0)
    const countStr = `${count}人`.padEnd(4, ' ')
    const pctStr = `(${pct}%)`.padEnd(6, ' ')
    const mainTag = count === maxCount && count > 0 ? chalk.gray(' ← 团队主体') : ''
    return `   ${color(label)} ${chalk.gray(range)}:  ${countStr} ${pctStr}${mainTag}`
  }

  // 输出各等级统计
  console.log(formatGroup(groups.light.length, '🟢 较轻松', '(996指数 < 40) ', chalk.green))
  console.log(formatGroup(groups.medium.length, '🟡 中等  ', '(996指数 40-60)', chalk.yellow))
  console.log(formatGroup(groups.heavy.length, '🟡 较累  ', '(996指数 60-80)', chalk.yellow))
  console.log(formatGroup(groups.veryHeavy.length, '🔴 很累  ', '(996指数 ≥ 80) ', chalk.red))
  console.log()

  // 补充范围和中位数信息
  const { range, median996 } = analysis.statistics
  const medianColor = getIndexColor(median996)
  console.log(
    chalk.gray(`   范围：${range[0].toFixed(0)} ~ ${range[1].toFixed(0)}  中位数：`) +
      medianColor(median996.toFixed(0))
  )
  console.log()
}

/**
 * 打印团队健康度评估
 */
function printHealthAssessment(analysis: TeamAnalysis): void {
  const { healthAssessment } = analysis
  const overallColor = getIndexColor(healthAssessment.overallIndex)
  const medianColor = getIndexColor(healthAssessment.teamMedianIndex)

  console.log(chalk.yellow.bold('💡 团队健康度评估：'))
  console.log()
  console.log(`   - 项目整体 996 指数: ${overallColor(healthAssessment.overallIndex.toFixed(1))}`)
  console.log(`   - 团队中位数 996 指数: ${medianColor(healthAssessment.teamMedianIndex.toFixed(1))}`)
  console.log(`   - 结论：${healthAssessment.conclusion}`)

  if (healthAssessment.warning) {
    console.log()
    console.log(`   ${chalk.yellow('⚠')}  ${chalk.yellow(healthAssessment.warning)}`)
  }

  console.log()
}

/**
 * 格式化时间（小时 → HH:MM）
 */
function formatTime(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

