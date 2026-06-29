import chalk from 'chalk'
import Table from 'cli-table3'
import { TeamAnalysis, WorkIntensityLevel } from '../../../../types/git-types'
import { getTerminalWidth } from '../../../../utils/terminal'
import { getIndexColor } from '../../../../utils/formatter'
import { calculatePercentile } from '../../../../utils/statistics'
import { t } from '../../../../i18n'

/**
 * 团队工作模式分析打印器
 * 负责打印团队工作节奏和健康度评估
 */

/**
 * 打印团队工作模式分析报表
 */
export function printTeamAnalysis(analysis: TeamAnalysis): void {
  console.log()
  console.log(chalk.cyan.bold(`👥 ${t('team.title', { count: analysis.totalAnalyzed })}`))
  console.log(chalk.gray(t('team.source')))
  console.log(chalk.gray(`━`.repeat(Math.min(getTerminalWidth(), 80))))
  console.log()

  printCoreContributorsList(analysis)

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
 * 打印核心贡献者名单
 */
function printCoreContributorsList(analysis: TeamAnalysis): void {
  const contributors = [...analysis.coreContributors].sort((a, b) => b.totalCommits - a.totalCommits)

  if (contributors.length === 0) {
    return
  }

  console.log(chalk.yellow.bold(`👤 ${t('team.contributors.title')}`))
  console.log()

  const table = new Table({
    head: [
      chalk.bold('#'),
      chalk.bold(t('team.contributors.name')),
      chalk.bold(t('team.contributors.email')),
      chalk.bold(t('team.contributors.commits')),
      chalk.bold(t('team.contributors.percentage')),
      chalk.bold(t('team.contributors.overtime')),
      chalk.bold(t('team.contributors.weekend')),
      chalk.bold(t('team.contributors.intensity')),
    ],
    colWidths: [4, 14, 26, 8, 8, 10, 10, 12],
    wordWrap: true,
    style: {
      head: [],
      border: [],
    },
  })

  contributors.forEach((contributor, index) => {
    table.push([
      String(index + 1),
      contributor.author || t('collector.unknownUser'),
      contributor.email || '-',
      String(contributor.totalCommits),
      `${contributor.commitPercentage.toFixed(1)}%`,
      String(contributor.overtimeStats?.totalOvertime ?? '-'),
      String(contributor.overtimeStats?.weekendOvertime ?? '-'),
      formatIntensityLevel(contributor.intensityLevel),
    ])
  })

  console.log(table.toString())
  console.log()
}

function formatIntensityLevel(level?: WorkIntensityLevel): string {
  if (!level) {
    return '-'
  }

  return t(`team.contributors.intensity.${level}`)
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

  console.log(chalk.yellow.bold(`🌅 ${t('team.startTitle')}`))
  console.log()

  const medianP25 = calculatePercentile(medianTimes, 25)
  const medianP50 = calculatePercentile(medianTimes, 50)
  const medianP75 = calculatePercentile(medianTimes, 75)
  console.log(`   • ${t('team.group.early', { time: formatTime(medianP25) })}`)
  console.log(`   • ${t('team.group.median', { time: formatTime(medianP50) })}  ${chalk.gray(t('team.baseline'))}`)
  console.log(`   • ${t('team.group.late', { time: formatTime(medianP75) })}`)
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

  console.log(chalk.yellow.bold(`🌙 ${t('team.endTitle')}`))
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

  console.log(`   • ${t('team.group.early', { time: formatTime(medianP25) })}  (${countMedianP25}, ${pctMedianP25}%)`)
  console.log(
    `   • ${t('team.group.median', { time: formatTime(medianP50) })}  (${countMedianP50}, ${pctMedianP50}%)  ${chalk.gray(t('team.baseline'))}`
  )
  console.log(`   • ${t('team.group.late', { time: formatTime(medianP75) })}  (${countMedianP75}, ${pctMedianP75}%)`)
  if (countMedianOver > 0) {
    console.log(`   • ${t('team.group.sustained', { time: formatTime(medianP75) })}   (${countMedianOver}, ${pctMedianOver}%)`)
  }
  console.log()

  // 分类评估（使用中位数的P50作为基准）
  const baselineEndHour = medianP50
  let assessment = ''
  if (baselineEndHour < 18.5) {
    assessment = t('team.assessment.normal')
  } else if (baselineEndHour < 20) {
    assessment = t('team.assessment.moderate')
  } else if (baselineEndHour < 21.5) {
    assessment = t('team.assessment.heavy')
  } else {
    assessment = t('team.assessment.veryHeavy')
  }

  console.log(`   ${chalk.gray(t('team.assessment.label', { text: assessment }))}`)
  console.log()
}

/**
 * 打印工作强度分布（按996指数等级分组统计人数）
 */
function printIntensityDistribution(analysis: TeamAnalysis): void {
  console.log(chalk.yellow.bold(`📈 ${t('team.intensity.title')}`))
  console.log()

  // 获取所有用户的996指数
  const index996List = analysis.coreContributors.map((u) => u.index996 || 0)
  const total = index996List.length

  if (total === 0) {
    console.log(chalk.gray(`   ${t('team.intensity.none')}`))
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
    const countStr = `${count}`.padEnd(4, ' ')
    const pctStr = `(${pct}%)`.padEnd(6, ' ')
    const mainTag = count === maxCount && count > 0 ? chalk.gray(t('team.intensity.main')) : ''
    return `   ${color(label)} ${chalk.gray(range)}:  ${countStr} ${pctStr}${mainTag}`
  }

  // 输出各等级统计
  console.log(formatGroup(groups.light.length, `🟢 ${t('team.intensity.light')}`, '(996 < 40)', chalk.green))
  console.log(formatGroup(groups.medium.length, `🟡 ${t('team.intensity.medium')}`, '(996 40-60)', chalk.yellow))
  console.log(formatGroup(groups.heavy.length, `🟡 ${t('team.intensity.heavy')}`, '(996 60-80)', chalk.yellow))
  console.log(formatGroup(groups.veryHeavy.length, `🔴 ${t('team.intensity.veryHeavy')}`, '(996 ≥ 80)', chalk.red))
  console.log()

  // 补充范围和中位数信息
  const { range, median996 } = analysis.statistics
  const medianColor = getIndexColor(median996)
  console.log(
    chalk.gray(
      `   ${t('team.intensity.range', {
        min: range[0].toFixed(0),
        max: range[1].toFixed(0),
        median: medianColor(median996.toFixed(0)),
      })}`
    )
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

  console.log(chalk.yellow.bold(`💡 ${t('team.health.title')}`))
  console.log()
  console.log(`   - ${t('team.health.overall', { value: overallColor(healthAssessment.overallIndex.toFixed(1)) })}`)
  console.log(`   - ${t('team.health.median', { value: medianColor(healthAssessment.teamMedianIndex.toFixed(1)) })}`)
  console.log(`   - ${t('team.health.conclusion', { text: healthAssessment.conclusion })}`)

  if (healthAssessment.warning) {
    console.log()
    console.log(`   ${chalk.yellow('⚠')}  ${chalk.yellow(healthAssessment.warning)}`)
  }

  console.log()
}

/**
 * 格式化时间（小时 → HH:MM）
 * 注意：处理分钟四舍五入到60的进位情况
 */
function formatTime(hours: number): string {
  let h = Math.floor(hours)
  let m = Math.round((hours - h) * 60)

  // 处理分钟进位到60的情况
  if (m >= 60) {
    m = 0
    h += 1
  }

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
