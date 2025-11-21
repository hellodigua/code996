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

  // 3. 工作强度分位数
  printIntensityPercentiles(analysis)

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
 * 打印工作强度分位数
 */
function printIntensityPercentiles(analysis: TeamAnalysis): void {
  console.log(chalk.yellow.bold('📈 工作强度分位数：'))
  console.log()

  const { percentiles } = analysis.statistics

  const p25Color = getIndexColor(percentiles.p25)
  const p50Color = getIndexColor(percentiles.p50)
  const p75Color = getIndexColor(percentiles.p75)
  const p90Color = getIndexColor(percentiles.p90)

  console.log(
    `   - P25 (25%的人): 996指数 ≤ ${p25Color(percentiles.p25.toFixed(0))}  ${getIndexDescription(percentiles.p25)}`
  )
  console.log(
    `   - P50 (中位数):  996指数 = ${p50Color(percentiles.p50.toFixed(0))}  ${getIndexDescription(percentiles.p50)}`
  )
  console.log(
    `   - P75 (75%的人): 996指数 ≤ ${p75Color(percentiles.p75.toFixed(0))}  ${getIndexDescription(percentiles.p75)}`
  )
  console.log(
    `   - P90 (90%的人): 996指数 ≤ ${p90Color(percentiles.p90.toFixed(0))}  ${getIndexDescription(percentiles.p90)}`
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

/**
 * 获取996指数的描述
 */
function getIndexDescription(index: number): string {
  if (index < 40) return chalk.green('(较轻松)')
  if (index < 60) return chalk.yellow('(中等)')
  if (index < 80) return chalk.yellow('(较累)')
  return chalk.red('(很累)')
}

/**
 * 计算百分位数
 */
