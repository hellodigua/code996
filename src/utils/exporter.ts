import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import {
  ParsedGitData,
  Result996,
  GitLogData,
  TrendAnalysisResult,
  TeamAnalysis,
  RepoAnalysisRecord,
} from '../types/git-types'
import { ProjectClassificationResult } from '../core/project-classifier'

export type ExportFormat = 'json' | 'markdown'

export interface ExportData {
  repoName: string
  repoPath: string
  generatedAt: string
  options: Record<string, unknown>
  result: Result996
  parsedData: ParsedGitData
  rawData: GitLogData
  classification?: ProjectClassificationResult
  trendResult?: TrendAnalysisResult
  teamAnalysis?: TeamAnalysis
}

export interface MultiExportData {
  generatedAt: string
  options: Record<string, unknown>
  repos: ExportData[]
  mergedResult: Result996
  mergedParsedData: ParsedGitData
  mergedRawData: GitLogData
  repoRecords: RepoAnalysisRecord[]
  trendResult?: TrendAnalysisResult
  teamAnalysis?: TeamAnalysis
}

/**
 * 导出分析报告
 */
export function exportReport(
  data: ExportData | MultiExportData,
  format: ExportFormat,
  outputPath: string
): void {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const content = format === 'json' ? exportToJson(data) : exportToMarkdown(data)
  fs.writeFileSync(outputPath, content, 'utf-8')
  console.log()
  console.log(chalk.green(`✓ 报告已导出: ${chalk.bold(outputPath)}`))
}

/**
 * 导出为 JSON 格式
 */
function exportToJson(data: ExportData | MultiExportData): string {
  const isMulti = 'repos' in data
  if (isMulti) {
    return JSON.stringify(serializeMultiData(data), null, 2)
  }
  return JSON.stringify(serializeSingleData(data), null, 2)
}

function serializeSingleData(data: ExportData): Record<string, unknown> {
  return {
    repoName: data.repoName,
    repoPath: data.repoPath,
    generatedAt: data.generatedAt,
    options: data.options,
    classification: data.classification,
    result: {
      index996: data.result.index996,
      index996Str: data.result.index996Str,
      overTimeRadio: data.result.overTimeRadio,
    },
    workTime: data.parsedData.detectedWorkTime,
    timeDistribution: {
      byHour: data.parsedData.hourData,
      byDay: data.parsedData.dayData,
    },
    overtime: {
      workHour: data.parsedData.workHourPl,
      workWeek: data.parsedData.workWeekPl,
      weekday: data.parsedData.weekdayOvertime,
      weekend: data.parsedData.weekendOvertime,
      lateNight: data.parsedData.lateNightAnalysis,
    },
    trend: data.trendResult,
    teamAnalysis: serializeTeamAnalysis(data.teamAnalysis),
    stats: {
      totalCommits: data.rawData.totalCommits,
      contributors: data.rawData.contributors,
      firstCommitDate: data.rawData.firstCommitDate,
      lastCommitDate: data.rawData.lastCommitDate,
    },
  }
}

function serializeMultiData(data: MultiExportData): Record<string, unknown> {
  return {
    generatedAt: data.generatedAt,
    options: data.options,
    summary: {
      result: {
        index996: data.mergedResult.index996,
        index996Str: data.mergedResult.index996Str,
        overTimeRadio: data.mergedResult.overTimeRadio,
      },
      totalCommits: data.mergedRawData.totalCommits,
      repoCount: data.repos.length,
    },
    repos: data.repos.map((repo) => serializeSingleData(repo)),
    trend: data.trendResult,
    teamAnalysis: serializeTeamAnalysis(data.teamAnalysis),
  }
}

function serializeTeamAnalysis(team?: TeamAnalysis): Record<string, unknown> | undefined {
  if (!team) return undefined
  return {
    totalContributors: team.totalContributors,
    totalAnalyzed: team.totalAnalyzed,
    baselineEndHour: team.baselineEndHour,
    distribution: {
      normal: team.distribution.normal.length,
      moderate: team.distribution.moderate.length,
      heavy: team.distribution.heavy.length,
    },
    statistics: team.statistics,
    healthAssessment: team.healthAssessment,
    contributors: team.coreContributors.map((u) => ({
      author: u.author,
      totalCommits: u.totalCommits,
      commitPercentage: u.commitPercentage,
      index996: u.index996,
      intensityLevel: u.intensityLevel,
      workingHours: u.workingHours,
    })),
  }
}

/**
 * 导出为 Markdown 格式
 */
function exportToMarkdown(data: ExportData | MultiExportData): string {
  const isMulti = 'repos' in data
  if (isMulti) {
    return buildMultiMarkdown(data)
  }
  return buildSingleMarkdown(data)
}

function buildSingleMarkdown(data: ExportData): string {
  const lines: string[] = []

  lines.push(`# ${data.repoName} - 996 指数分析报告`)
  lines.push('')
  lines.push(`> 生成时间: ${data.generatedAt}`)
  lines.push('')

  // 核心结果
  lines.push('## 核心结果')
  lines.push('')
  lines.push(`| 指标 | 值 |`)
  lines.push(`|------|-----|`)
  lines.push(`| 996 指数 | ${data.result.index996.toFixed(1)} |`)
  lines.push(`| 加班占比 | ${data.result.overTimeRadio.toFixed(1)}% |`)
  lines.push(`| 项目类型 | ${data.classification?.projectType ?? '未知'} (置信度: ${data.classification?.confidence}%) |`)
  lines.push(`| 总提交数 | ${data.rawData.totalCommits} |`)
  lines.push(`| 贡献者数 | ${data.rawData.contributors ?? '-'} |`)
  if (data.rawData.firstCommitDate) {
    lines.push(`| 首次提交 | ${data.rawData.firstCommitDate} |`)
  }
  if (data.rawData.lastCommitDate) {
    lines.push(`| 最后提交 | ${data.rawData.lastCommitDate} |`)
  }
  lines.push('')

  // 工作时间
  const wt = data.parsedData.detectedWorkTime
  if (wt) {
    lines.push('## 工作时间')
    lines.push('')
    lines.push(`| 指标 | 值 |`)
    lines.push(`|------|-----|`)
    lines.push(`| 上班时间 | ${formatHour(wt.startHour)} |`)
    lines.push(`| 下班时间 | ${formatHour(wt.endHour)} |`)
    lines.push(`| 可靠性 | ${wt.isReliable ? '可靠' : '不可靠'} |`)
    lines.push(`| 方法 | ${wt.detectionMethod} |`)
    lines.push('')
  }

  // 加班分析
  lines.push('## 加班分析')
  lines.push('')
  lines.push(`| 时段 | 提交数 |`)
  lines.push(`|------|--------|`)
  lines.push(`| 标准工作时间内 | ${data.parsedData.workHourPl[0].count} |`)
  lines.push(`| 加班时段 | ${data.parsedData.workHourPl[1].count} |`)
  lines.push(`| 工作日 | ${data.parsedData.workWeekPl[0].count} |`)
  lines.push(`| 周末 | ${data.parsedData.workWeekPl[1].count} |`)
  lines.push('')

  if (data.parsedData.weekdayOvertime) {
    const wd = data.parsedData.weekdayOvertime
    lines.push('### 各工作日加班分布')
    lines.push('')
    lines.push(`| 周一 | 周二 | 周三 | 周四 | 周五 |`)
    lines.push(`|------|------|------|------|------|`)
    lines.push(`| ${wd.monday} | ${wd.tuesday} | ${wd.wednesday} | ${wd.thursday} | ${wd.friday} |`)
    lines.push('')
  }

  if (data.parsedData.weekendOvertime) {
    const we = data.parsedData.weekendOvertime
    lines.push('### 周末加班分布')
    lines.push('')
    lines.push(`| 指标 | 天数 |`)
    lines.push(`|------|------|`)
    lines.push(`| 周六 | ${we.saturdayDays} |`)
    lines.push(`| 周日 | ${we.sundayDays} |`)
    lines.push(`| 真正加班(≥3次) | ${we.realOvertimeDays} |`)
    lines.push('')
  }

  if (data.parsedData.lateNightAnalysis) {
    const ln = data.parsedData.lateNightAnalysis
    lines.push('### 深夜加班分析')
    lines.push('')
    lines.push(`| 时段 | 提交数 |`)
    lines.push(`|------|--------|`)
    lines.push(`| 晚间(下班-21:00) | ${ln.evening} |`)
    lines.push(`| 加班晚期(21:00-23:00) | ${ln.lateNight} |`)
    lines.push(`| 深夜(23:00-02:00) | ${ln.midnight} |`)
    lines.push(`| 凌晨(02:00-06:00) | ${ln.dawn} |`)
    lines.push(`| 深夜天数 | ${ln.midnightDays} |`)
    lines.push(`| 深夜占比 | ${ln.midnightRate.toFixed(1)}% |`)
    lines.push('')
  }

  // 时间分布
  lines.push('## 24小时提交分布')
  lines.push('')
  lines.push('```')
  for (const item of data.parsedData.hourData) {
    const bar = '█'.repeat(Math.max(1, Math.round(item.count / Math.max(1, getMaxCount(data.parsedData.hourData) / 20))))
    lines.push(`${item.time} | ${bar} ${item.count}`)
  }
  lines.push('```')
  lines.push('')

  // 趋势
  if (data.trendResult && data.trendResult.monthlyData.length > 0) {
    lines.push('## 月度趋势')
    lines.push('')
    lines.push(`**整体趋势**: ${trendLabel(data.trendResult.summary.trend)}`)
    lines.push(`**平均 996 指数**: ${data.trendResult.summary.avgIndex996.toFixed(1)}`)
    lines.push(`**平均工作跨度**: ${data.trendResult.summary.avgWorkSpan.toFixed(1)} 小时`)
    lines.push('')
    lines.push('| 月份 | 996指数 | 平均工时 | 提交数 | 趋势 |')
    lines.push('|------|---------|----------|--------|------|')
    for (const m of data.trendResult.monthlyData) {
      lines.push(`| ${m.month} | ${m.index996.toFixed(1)} | ${m.avgWorkSpan.toFixed(1)}h | ${m.totalCommits} | ${m.confidence} |`)
    }
    lines.push('')
  }

  // 团队分析
  if (data.teamAnalysis) {
    lines.push('## 团队工作模式')
    lines.push('')
    const ta = data.teamAnalysis
    lines.push(`**团队中位数 996 指数**: ${ta.statistics.median996.toFixed(1)}`)
    lines.push(`**工作强度分布**: 正常 ${ta.distribution.normal.length} 人, 适度 ${ta.distribution.moderate.length} 人, 重度 ${ta.distribution.heavy.length} 人`)
    lines.push('')
    lines.push('| 成员 | 提交数 | 占比 | 996指数 | 强度 |')
    lines.push('|------|--------|------|---------|------|')
    for (const u of ta.coreContributors) {
      lines.push(`| ${u.author} | ${u.totalCommits} | ${u.commitPercentage.toFixed(1)}% | ${u.index996?.toFixed(1) ?? '-'} | ${u.intensityLevel ?? '-'} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildMultiMarkdown(data: MultiExportData): string {
  const lines: string[] = []

  lines.push('# 多仓库 996 指数分析报告')
  lines.push('')
  lines.push(`> 生成时间: ${data.generatedAt}`)
  lines.push('')

  // 汇总
  lines.push('## 汇总结果')
  lines.push('')
  lines.push(`| 指标 | 值 |`)
  lines.push(`|------|-----|`)
  lines.push(`| 合并 996 指数 | ${data.mergedResult.index996.toFixed(1)} |`)
  lines.push(`| 合并加班占比 | ${data.mergedResult.overTimeRadio.toFixed(1)}% |`)
  lines.push(`| 总提交数 | ${data.mergedRawData.totalCommits} |`)
  lines.push(`| 仓库数 | ${data.repos.length} |`)
  lines.push('')

  // 各仓库对比
  lines.push('## 各仓库对比')
  lines.push('')
  lines.push('| 仓库 | 996指数 | 提交数 | 状态 |')
  lines.push('|------|---------|--------|------|')
  for (const repo of data.repos) {
    lines.push(`| ${repo.repoName} | ${repo.result.index996.toFixed(1)} | ${repo.rawData.totalCommits} | ✓ |`)
  }
  lines.push('')

  // 详细报告
  lines.push('## 详细报告')
  lines.push('')
  for (const repo of data.repos) {
    lines.push(`---`)
    lines.push('')
    lines.push(`### ${repo.repoName}`)
    lines.push('')
    // 复用单仓库的主体内容
    const repoMd = buildSingleMarkdown(repo)
    // 去掉标题头（已用自己的 ### ）
    const body = repoMd.split('\n').slice(3).join('\n')
    lines.push(body)
    lines.push('')
  }

  return lines.join('\n')
}

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function getMaxCount(data: Array<{ count: number }>): number {
  return Math.max(...data.map((d) => d.count), 1)
}

function trendLabel(trend: string): string {
  switch (trend) {
    case 'increasing':
      return '上升'
    case 'decreasing':
      return '下降'
    default:
      return '稳定'
  }
}
