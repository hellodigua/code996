import { StructuredOutput } from '../../types/git-types'

const WEEKDAY_LABELS: Record<string, string> = {
  monday: '星期一',
  tuesday: '星期二',
  wednesday: '星期三',
  thursday: '星期四',
  friday: '星期五',
  saturday: '星期六',
  sunday: '星期日',
}

function formatWeekday(day: string): string {
  return WEEKDAY_LABELS[day] ?? day
}

const INTENSITY_LABELS: Record<string, string> = {
  normal: '正常',
  moderate: '适度加班',
  heavy: '严重加班',
}

function formatIntensityLevel(level?: string): string {
  if (!level) return '-'
  return INTENSITY_LABELS[level] ?? level
}

function mdTable(headers: string[], rows: string[][]): string {
  const separator = headers.map(() => '---').join(' | ')
  const headerRow = headers.join(' | ')
  const dataRows = rows.map((r) => r.join(' | ')).join('\n')
  return `| ${headerRow} |\n| ${separator} |\n${rows.length ? rows.map((r) => `| ${r.join(' | ')} |`).join('\n') : ''}`
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`
}

export function buildMarkdown(data: StructuredOutput): string {
  const sections: string[] = []
  const date = new Date().toISOString().slice(0, 10)

  sections.push(`# code996 分析报告 · ${date}\n`)

  // 基本信息
  sections.push('## 基本信息\n')
  const metaRows: string[][] = [
    ['仓库', data.meta.repos.join(', ')],
    ['分析区间', [data.meta.since, data.meta.until].filter(Boolean).join(' → ') || '全部'],
    ['总提交数', String(data.core.totalCommits)],
    ['996 指数', String(data.core.index996)],
    ['评级', data.core.rating],
    ['加班比例', pct(data.core.overTimeRatio)],
    ['locale', data.meta.locale],
    ['版本', data.meta.version],
  ]
  sections.push(mdTable(['项目', '值'], metaRows))
  sections.push('')

  // 推测工时
  if (data.workTime) {
    sections.push('## 推测工时\n')
    const wt = data.workTime
    const wtRows: string[][] = [
      ['上班时间', `${wt.startHour}:00`],
      ['下班时间', `${wt.endHour}:00`],
      ['置信度', pct(wt.confidence)],
      ['检测方法', wt.detectionMethod],
      ['是否可靠', wt.isReliable ? '是' : '否'],
    ]
    sections.push(mdTable(['项目', '值'], wtRows))
    sections.push('')
  }

  // 每日提交时段分布
  if (data.hourlyDistribution.length) {
    sections.push('## 每日提交时段分布\n')
    sections.push(mdTable(['时段', '提交数'], data.hourlyDistribution.map((d) => [d.hour + ':00', String(d.count)])))
    sections.push('')
  }

  // 工作日分布
  if (data.weekdayDistribution.length) {
    sections.push('## 工作日提交分布\n')
    sections.push(mdTable(['星期', '提交数'], data.weekdayDistribution.map((d) => [formatWeekday(d.day), String(d.count)])))
    sections.push('')
  }

  // 工作日加班
  if (data.weekdayOvertime) {
    sections.push('## 工作日加班分布\n')
    const wo = data.weekdayOvertime
    const woRows: string[][] = [
      ['周一', String(wo.monday)],
      ['周二', String(wo.tuesday)],
      ['周三', String(wo.wednesday)],
      ['周四', String(wo.thursday)],
      ['周五', String(wo.friday)],
    ]
    if (wo.peakDay) woRows.push(['加班最多', `${wo.peakDay}（${wo.peakCount} 次）`])
    sections.push(mdTable(['星期', '加班提交数'], woRows))
    sections.push('')
  }

  // 周末加班
  if (data.weekendOvertime) {
    sections.push('## 周末加班统计\n')
    const we = data.weekendOvertime
    const weRows: string[][] = [
      ['周六加班天数', String(we.saturdayDays)],
      ['周日加班天数', String(we.sundayDays)],
      ['临时修复天数', String(we.casualFixDays)],
      ['真正加班天数', String(we.realOvertimeDays)],
    ]
    sections.push(mdTable(['项目', '值'], weRows))
    sections.push('')
  }

  // 深夜加班
  if (data.lateNight) {
    sections.push('## 深夜加班统计\n')
    const ln = data.lateNight
    const lnRows: string[][] = [
      ['晚间提交（下班后-21:00）', String(ln.evening)],
      ['加班晚期（21:00-23:00）', String(ln.lateNight)],
      ['深夜加班（23:00-02:00）', String(ln.midnight)],
      ['凌晨提交（02:00-06:00）', String(ln.dawn)],
      ['有深夜/凌晨提交的天数', String(ln.midnightDays)],
      ['总工作日天数', String(ln.totalWorkDays)],
      ['深夜加班占比', pct(ln.midnightRate)],
    ]
    sections.push(mdTable(['项目', '值'], lnRows))
    sections.push('')
  }

  // 团队贡献者
  if (data.team && data.team.contributors.length) {
    sections.push('## 核心贡献者\n')
    const contributors = [...data.team.contributors].sort((a, b) => b.totalCommits - a.totalCommits)
    const headers = ['姓名', '邮箱', '提交数', '占比', '加班提交', '周末提交', '强度等级']
    const rows = contributors.map((c) => [
      c.author,
      c.email,
      String(c.totalCommits),
      pct(c.commitPercentage),
      String(c.overtimeStats?.totalOvertime ?? '-'),
      String(c.overtimeStats?.weekendOvertime ?? '-'),
      formatIntensityLevel(c.intensityLevel),
    ])
    sections.push(mdTable(headers, rows))
    sections.push('')
  }

  // 多仓库对比
  if (data.multiRepo && data.multiRepo.repos.length) {
    sections.push('## 各仓库对比\n')
    const headers = ['仓库', '996 指数', '加班比例', '总提交数']
    const rows = data.multiRepo.repos.map((r) => [
      r.name,
      String(r.core.index996),
      pct(r.core.overTimeRatio),
      String(r.totalCommits),
    ])
    sections.push(mdTable(headers, rows))
    sections.push('')
  }

  return sections.join('\n')
}
