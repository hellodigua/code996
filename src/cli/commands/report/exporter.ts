import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { ParsedGitData, Result996, GitLogData } from '../../../types/git-types'
import { AnalyzeOptions } from '../../index'
import { formatStartClock, formatEndClock } from '../../../utils/formatter'

type ReportFormat = 'txt' | 'md' | 'html' | 'svg' | 'png'

interface ReportContext {
  rangeText: string
  indexText: string
  indexValue: string
  overtimeText: string
  totalCommits: number
  workdayCommits: number
  weekendCommits: number
  workTime: string
  weekendOvertimeText: string
  lateNightText: string
  topHours: string[]
  topWeekdays: string[]
  generatedAt: string
}

interface ExportPayload {
  result: Result996
  parsedData: ParsedGitData
  rawData: GitLogData
  options: AnalyzeOptions
  timeRange: {
    since?: string
    until?: string
    mode?: 'all-time' | 'custom' | 'auto-last-commit' | 'fallback'
  }
}

/** 将分析结果导出为指定格式文件 */
export async function exportReport(formatInput: string | undefined, payload: ExportPayload): Promise<void> {
  let format: ReportFormat

  try {
    format = normalizeFormat(formatInput)
  } catch (error) {
    console.error(chalk.red('❌ 报告导出失败:'), (error as Error).message)
    return
  }

  const outputPath = resolveOutputPath(format)
  const context = buildReportContext(payload)

  try {
    if (format === 'txt') {
      await fs.promises.writeFile(outputPath, buildTextReport(context), 'utf8')
    } else if (format === 'md') {
      await fs.promises.writeFile(outputPath, buildMarkdownReport(context), 'utf8')
    } else if (format === 'html') {
      await fs.promises.writeFile(outputPath, buildHtmlReport(context), 'utf8')
    } else if (format === 'svg') {
      await fs.promises.writeFile(outputPath, buildSvgReport(context), 'utf8')
    } else if (format === 'png') {
      const svg = buildSvgReport(context)
      const buffer = await renderPng(svg)
      await fs.promises.writeFile(outputPath, buffer)
    }

    console.log(chalk.green('💾 报告已生成:'), outputPath)
  } catch (error) {
    console.error(chalk.red('❌ 报告导出失败:'), (error as Error).message)
  }
}

/** 统一格式校验与别名归一化 */
function normalizeFormat(formatInput?: string): ReportFormat {
  const normalized = (formatInput || 'txt').trim().toLowerCase()

  const aliasMap: Record<string, ReportFormat> = {
    txt: 'txt',
    text: 'txt',
    md: 'md',
    markdown: 'md',
    html: 'html',
    'report.html': 'html',
    svg: 'svg',
    png: 'png',
  }

  const matched = aliasMap[normalized]
  if (matched) {
    return matched
  }

  throw new Error(`不支持的导出格式: ${formatInput}，可选值: txt | md | html | svg | png`)
}

/** 构造文本报告 */
function buildTextReport(ctx: ReportContext): string {
  const blocks = [
    'code996 报告',
    `生成时间: ${ctx.generatedAt}`,
    `时间范围: ${ctx.rangeText}`,
    `总提交数: ${ctx.totalCommits}`,
    `996指数: ${ctx.indexValue} (${ctx.indexText})`,
    `加班比例: ${ctx.overtimeText}`,
    `工作日/周末提交: ${ctx.workdayCommits}/${ctx.weekendCommits}`,
    `推测工作时间: ${ctx.workTime}`,
    `周末加班: ${ctx.weekendOvertimeText}`,
    `深夜加班: ${ctx.lateNightText}`,
    `高频提交时段: ${ctx.topHours.join('；') || '无数据'}`,
    `高频提交星期: ${ctx.topWeekdays.join('；') || '无数据'}`,
  ]

  return blocks.join('\n')
}

/** 构造 Markdown 报告 */
function buildMarkdownReport(ctx: ReportContext): string {
  const lines = [
    '# code996 报告',
    `- 生成时间: ${ctx.generatedAt}`,
    `- 时间范围: ${ctx.rangeText}`,
    `- 总提交数: ${ctx.totalCommits}`,
    `- 996指数: ${ctx.indexValue} (${ctx.indexText})`,
    `- 加班比例: ${ctx.overtimeText}`,
    `- 工作日/周末提交: ${ctx.workdayCommits}/${ctx.weekendCommits}`,
    `- 推测工作时间: ${ctx.workTime}`,
    `- 周末加班: ${ctx.weekendOvertimeText}`,
    `- 深夜加班: ${ctx.lateNightText}`,
    '',
    '## 高频提交时段',
    ...(ctx.topHours.length > 0 ? ctx.topHours.map((item) => `- ${item}`) : ['- 无数据']),
    '',
    '## 高频提交星期',
    ...(ctx.topWeekdays.length > 0 ? ctx.topWeekdays.map((item) => `- ${item}`) : ['- 无数据']),
    '',
    '> 996指数仅供参考，请结合团队实际情况综合判断。',
  ]

  return lines.join('\n')
}

/** 构造 HTML 报告 */
function buildHtmlReport(ctx: ReportContext): string {
  const hourList = ctx.topHours.length > 0 ? ctx.topHours : ['无数据']
  const weekdayList = ctx.topWeekdays.length > 0 ? ctx.topWeekdays : ['无数据']

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>code996 报告</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7f7fb; color: #1f2024; margin: 0; padding: 32px; }
    .card { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 28px 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    h1 { margin: 0 0 16px; font-size: 28px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 16px 0; }
    .pill { background: #f2f4f8; border-radius: 12px; padding: 12px 14px; }
    .pill strong { display: block; color: #6b7280; font-size: 13px; margin-bottom: 4px; }
    .pill span { font-size: 16px; word-break: break-all; }
    .section { margin-top: 18px; }
    ul { margin: 8px 0 0; padding-left: 20px; color: #374151; }
    .footer { margin-top: 20px; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>code996 报告</h1>
    <div class="grid">
      <div class="pill"><strong>时间范围</strong><span>${ctx.rangeText}</span></div>
      <div class="pill"><strong>生成时间</strong><span>${ctx.generatedAt}</span></div>
      <div class="pill"><strong>996指数</strong><span>${ctx.indexValue}（${escapeHtml(ctx.indexText)}）</span></div>
      <div class="pill"><strong>加班比例</strong><span>${ctx.overtimeText}</span></div>
      <div class="pill"><strong>总提交数</strong><span>${ctx.totalCommits}</span></div>
      <div class="pill"><strong>工作日/周末提交</strong><span>${ctx.workdayCommits}/${ctx.weekendCommits}</span></div>
      <div class="pill"><strong>推测工作时间</strong><span>${escapeHtml(ctx.workTime)}</span></div>
      <div class="pill"><strong>周末加班</strong><span>${escapeHtml(ctx.weekendOvertimeText)}</span></div>
      <div class="pill"><strong>深夜加班</strong><span>${escapeHtml(ctx.lateNightText)}</span></div>
    </div>

    <div class="section">
      <h3>高频提交时段</h3>
      <ul>${hourList.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>

    <div class="section">
      <h3>高频提交星期</h3>
      <ul>${weekdayList.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>

    <div class="footer">提示：996指数仅供参考，请结合团队实际情况辅助判断。</div>
  </div>
</body>
</html>`
}

/** 构造 SVG 报告，便于后续转换 PNG */
function buildSvgReport(ctx: ReportContext): string {
  const width = 920
  const height = 540
  const lines = [
    `时间范围: ${truncate(ctx.rangeText, 60)}`,
    `996指数: ${ctx.indexValue}（${truncate(ctx.indexText, 22)}）`,
    `加班比例: ${ctx.overtimeText} | 总提交: ${ctx.totalCommits}`,
    `工作日/周末提交: ${ctx.workdayCommits}/${ctx.weekendCommits}`,
    `推测工作时间: ${truncate(ctx.workTime, 40)}`,
    `周末加班: ${truncate(ctx.weekendOvertimeText, 50)}`,
    `深夜加班: ${truncate(ctx.lateNightText, 50)}`,
    `高频时段: ${truncate(ctx.topHours.join('；') || '暂无', 60)}`,
    `高频星期: ${truncate(ctx.topWeekdays.join('；') || '暂无', 60)}`,
    `生成时间: ${ctx.generatedAt}`,
  ]

  const lineStartY = 210
  const lineGap = 28

  const lineSvg = lines
    .map(
      (text, index) =>
        `<text x="40" y="${lineStartY + index * lineGap}" font-size="17" fill="#0f172a" opacity="0.92">${escapeXml(
          text
        )}</text>`
    )
    .join('')

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#eef2ff"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGradient)" rx="22" />
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="#ffffff" rx="18" opacity="0.92" />
  <text x="40" y="80" font-size="32" font-weight="700" fill="#111827">code996 报告</text>
  <text x="40" y="120" font-size="16" fill="#475569">数据洞察 · 自主分析 · 本地计算</text>
  <text x="${width - 40}" y="80" font-size="48" text-anchor="end" font-weight="700" fill="#2563eb">${ctx.indexValue}</text>
  <text x="${width - 40}" y="110" font-size="16" text-anchor="end" fill="#0f172a">${escapeXml(ctx.indexText)}</text>
  ${lineSvg}
</svg>`
}

/** 渲染 PNG，使用 resvg 将 SVG 转成位图 */
async function renderPng(svg: string): Promise<Buffer> {
  const { Resvg } = await import('@resvg/resvg-js')
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 920 },
  })
  const pngData = resvg.render()
  return pngData.asPng()
}

/** 组装总结数据，便于多格式复用 */
function buildReportContext({ result, parsedData, rawData, options, timeRange }: ExportPayload): ReportContext {
  const rangeText = buildRangeText(options, timeRange)
  const workTime = buildWorkTimeText(parsedData)
  const weekendOvertimeText = buildWeekendOvertimeText(parsedData)
  const lateNightText = buildLateNightText(parsedData)
  const topHours = pickTopHours(parsedData)
  const topWeekdays = pickTopWeekdays(parsedData)

  const generatedAt = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  const workdayCommits = parsedData.workWeekPl?.[0]?.count ?? 0
  const weekendCommits = parsedData.workWeekPl?.[1]?.count ?? 0

  return {
    rangeText,
    indexText: result.index996Str,
    indexValue: result.index996.toFixed(1),
    overtimeText: `${result.overTimeRadio.toFixed(1)}%`,
    totalCommits: rawData.totalCommits,
    workdayCommits,
    weekendCommits,
    workTime,
    weekendOvertimeText,
    lateNightText,
    topHours,
    topWeekdays,
    generatedAt,
  }
}

/** 构造时间范围文本 */
function buildRangeText(
  options: AnalyzeOptions,
  timeRange: ExportPayload['timeRange']
): string {
  if (options.since && options.until) {
    return `${options.since} 至 ${options.until}`
  }

  if (options.since) {
    return `自 ${options.since} 起`
  }

  if (options.until) {
    return `截至 ${options.until}`
  }

  if (options.allTime) {
    return '所有时间'
  }

  if (timeRange.since && timeRange.until) {
    if (timeRange.mode === 'auto-last-commit') {
      return `${timeRange.since} 至 ${timeRange.until}（按最后一次提交回溯365天）`
    }

    if (timeRange.mode === 'fallback') {
      return `${timeRange.since} 至 ${timeRange.until}（按当前日期回溯365天）`
    }

    return `${timeRange.since} 至 ${timeRange.until}`
  }

  return '最近一年'
}

/** 构造工作时间描述 */
function buildWorkTimeText(parsedData: ParsedGitData): string {
  const start = formatStartClock(parsedData.detectedWorkTime)
  const end = formatEndClock(parsedData.detectedWorkTime)

  if (!parsedData.detectedWorkTime) {
    return '暂无可靠的工作时间推测'
  }

  return `${start} - ${end}`
}

/** 周末加班概览 */
function buildWeekendOvertimeText(parsedData: ParsedGitData): string {
  const data = parsedData.weekendOvertime

  if (!data) {
    return '暂无周末加班数据'
  }

  const total = data.saturdayDays + data.sundayDays
  if (total === 0) {
    return '无周末提交记录'
  }

  return `周六${data.saturdayDays}天/周日${data.sundayDays}天，真正加班${data.realOvertimeDays}天，临时修复${data.casualFixDays}天`
}

/** 深夜加班概览 */
function buildLateNightText(parsedData: ParsedGitData): string {
  const analysis = parsedData.lateNightAnalysis
  if (!analysis) {
    return '暂无深夜加班数据'
  }

  if (analysis.midnightDays === 0) {
    return '深夜提交较少或不存在'
  }

  const rate = `${analysis.midnightRate.toFixed(1)}%`
  return `深夜/凌晨加班 ${analysis.midnightDays} 天，占工作日 ${rate}`
}

/** 取高频小时段 */
function pickTopHours(parsedData: ParsedGitData): string[] {
  const sorted = [...parsedData.hourData].filter((item) => item.count > 0).sort((a, b) => b.count - a.count)
  return sorted.slice(0, 3).map((item) => `${item.time.padStart(2, '0')} 点 (${item.count} 次)`)
}

/** 取高频星期 */
function pickTopWeekdays(parsedData: ParsedGitData): string[] {
  const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const sorted = [...parsedData.dayData].filter((item) => item.count > 0).sort((a, b) => b.count - a.count)
  return sorted.slice(0, 3).map((item) => {
    const index = Math.max(0, Math.min(6, parseInt(item.time, 10) - 1))
    const name = weekNames[index] || '未知'
    return `${name} (${item.count} 次)`
  })
}

/** 规范化输出路径 */
function resolveOutputPath(format: ReportFormat): string {
  const cwd = process.cwd()

  switch (format) {
    case 'html':
      return path.resolve(cwd, 'report.html')
    case 'md':
      return path.resolve(cwd, 'report.md')
    case 'svg':
      return path.resolve(cwd, 'report.svg')
    case 'png':
      return path.resolve(cwd, 'report.png')
    default:
      return path.resolve(cwd, 'report.txt')
  }
}

/** 简易 HTML/XML 转义 */
function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** SVG 文本转义 */
function escapeXml(input: string): string {
  return escapeHtml(input).replace(/'/g, '&apos;')
}

/** 控制字符串长度，避免 SVG 溢出 */
function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input
  }
  return `${input.slice(0, maxLength - 1)}…`
}
