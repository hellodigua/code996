import type { ReportData } from '../../../src/report/report-data'

export function getRepositoryName(report: ReportData): string {
  const repoPath = report.meta.repos[0] || ''
  const normalized = repoPath.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || 'code996'
}

export function formatClock(hour?: number): string {
  if (hour === undefined || !Number.isFinite(hour)) return '--:--'
  // 分析器会用 24:00 之后的数值表达跨午夜下班，不能像普通时钟一样取模回 00:00。
  const totalMinutes = Math.max(0, Math.round(hour * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function percentage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
