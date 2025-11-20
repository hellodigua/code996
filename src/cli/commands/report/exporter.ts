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
  const divider = '─'.repeat(60)
  const blocks = [
    '',
    '╔═══════════════════════════════════════════════════════════╗',
    '║                     CODE996 分析报告                      ║',
    '╚═══════════════════════════════════════════════════════════╝',
    '',
    `📅 生成时间: ${ctx.generatedAt}`,
    `⏰ 时间范围: ${ctx.rangeText}`,
    divider,
    '',
    '📊 核心指标',
    `   996指数: ${ctx.indexValue} (${ctx.indexText})`,
    `   加班比例: ${ctx.overtimeText}`,
    `   总提交数: ${ctx.totalCommits} 次`,
    '',
    '💼 工作分布',
    `   工作日提交: ${ctx.workdayCommits} 次`,
    `   周末提交: ${ctx.weekendCommits} 次`,
    `   推测工作时间: ${ctx.workTime}`,
    '',
    '⚠️  加班情况',
    `   周末加班: ${ctx.weekendOvertimeText}`,
    `   深夜加班: ${ctx.lateNightText}`,
    '',
    divider,
    '',
    '🔥 高频提交时段',
    ...ctx.topHours.map((item, i) => `   ${i + 1}. ${item}`),
    '',
    '📆 高频提交星期',
    ...ctx.topWeekdays.map((item, i) => `   ${i + 1}. ${item}`),
    '',
    divider,
    '💡 提示: 996指数仅供参考，请结合团队实际情况辅助判断',
    '',
  ]

  return blocks.join('\n')
}

/** 构造 Markdown 报告 */
function buildMarkdownReport(ctx: ReportContext): string {
  const getIndexEmoji = (value: string) => {
    const num = parseFloat(value)
    if (num < 48) return '🎉'
    if (num < 63) return '✅'
    if (num < 85) return '🤔'
    if (num < 100) return '⚠️'
    if (num < 130) return '🚨'
    if (num < 160) return '🔥'
    return '💀'
  }

  const lines = [
    '# 📊 CODE996 分析报告',
    '',
    `> 📅 生成时间：${ctx.generatedAt}  `,
    `> ⏰ 分析时段：${ctx.rangeText}`,
    '',
    '---',
    '',
    '## 核心指标',
    '',
    '| 指标 | 数值 |',
    '|------|------|',
    `| ${getIndexEmoji(ctx.indexValue)} 996指数 | **${ctx.indexValue}** (${ctx.indexText}) |`,
    `| 📈 加班比例 | ${ctx.overtimeText} |`,
    `| 📝 总提交数 | ${ctx.totalCommits} 次 |`,
    '',
    '## 💼 工作分布',
    '',
    '| 类型 | 提交次数 | 比例 |',
    '|------|---------|------|',
    `| 工作日 | ${ctx.workdayCommits} 次 | ${((ctx.workdayCommits / ctx.totalCommits) * 100).toFixed(1)}% |`,
    `| 周末 | ${ctx.weekendCommits} 次 | ${((ctx.weekendCommits / ctx.totalCommits) * 100).toFixed(1)}% |`,
    '',
    `**推测工作时间：** ${ctx.workTime}`,
    '',
    '## ⚠️ 加班分析',
    '',
    `- **周末加班：** ${ctx.weekendOvertimeText}`,
    `- **深夜加班：** ${ctx.lateNightText}`,
    '',
    '## 🔥 高频提交时段',
    '',
    ...(ctx.topHours.length > 0 ? ctx.topHours.map((item, i) => `${i + 1}. ${item}`) : ['暂无数据']),
    '',
    '## 📆 高频提交星期',
    '',
    ...(ctx.topWeekdays.length > 0 ? ctx.topWeekdays.map((item, i) => `${i + 1}. ${item}`) : ['暂无数据']),
    '',
    '---',
    '',
    '> 💡 **提示：** 996指数仅供参考，请结合团队实际情况综合判断。  ',
    '> 🔒 **隐私：** 所有分析均在本地进行，不会上传任何数据。',
    '',
  ]

  return lines.join('\n')
}

/** 构造 HTML 报告 */
function buildHtmlReport(ctx: ReportContext): string {
  const hourList = ctx.topHours.length > 0 ? ctx.topHours : ['无数据']
  const weekdayList = ctx.topWeekdays.length > 0 ? ctx.topWeekdays : ['无数据']

  const indexValue = parseFloat(ctx.indexValue)
  const getIndexColor = () => {
    if (indexValue < 48) return '#10b981'
    if (indexValue < 63) return '#34d399'
    if (indexValue < 85) return '#fbbf24'
    if (indexValue < 100) return '#fb923c'
    if (indexValue < 130) return '#f87171'
    if (indexValue < 160) return '#dc2626'
    return '#991b1b'
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CODE996 分析报告</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #1f2937;
      padding: 40px 20px;
      min-height: 100vh;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    .header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      margin-bottom: 30px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      text-align: center;
    }
    .header h1 {
      font-size: 42px;
      font-weight: 800;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 16px;
    }
    .header .meta {
      color: #6b7280;
      font-size: 14px;
      display: flex;
      gap: 20px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .hero-score {
      background: white;
      border-radius: 20px;
      padding: 50px;
      margin-bottom: 30px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      text-align: center;
    }
    .hero-score .score {
      font-size: 96px;
      font-weight: 900;
      color: ${getIndexColor()};
      line-height: 1;
      margin-bottom: 10px;
    }
    .hero-score .label {
      font-size: 24px;
      color: #6b7280;
      font-weight: 600;
    }
    .hero-score .desc {
      font-size: 18px;
      color: #9ca3af;
      margin-top: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.12);
    }
    .card-title {
      font-size: 14px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .card-value {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      line-height: 1.2;
    }
    .card-icon {
      font-size: 32px;
      margin-bottom: 8px;
      display: block;
    }
    .section {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    }
    .section h2 {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .list-item {
      padding: 12px 16px;
      background: #f9fafb;
      border-radius: 8px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: background 0.2s;
    }
    .list-item:hover {
      background: #f3f4f6;
    }
    .list-number {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
    }
    .footer {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    }
    .footer strong { color: #374151; }
    @media (max-width: 768px) {
      .grid { grid-template-columns: 1fr; }
      .header h1 { font-size: 32px; }
      .hero-score .score { font-size: 72px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 CODE996 分析报告</h1>
      <div class="meta">
        <span>📅 ${ctx.generatedAt}</span>
        <span>⏰ ${ctx.rangeText}</span>
      </div>
    </div>

    <div class="hero-score">
      <div class="score">${ctx.indexValue}</div>
      <div class="label">996 指数</div>
      <div class="desc">${escapeHtml(ctx.indexText)}</div>
    </div>

    <div class="grid">
      <div class="card">
        <span class="card-icon">📈</span>
        <div class="card-title">加班比例</div>
        <div class="card-value">${ctx.overtimeText}</div>
      </div>
      <div class="card">
        <span class="card-icon">📝</span>
        <div class="card-title">总提交数</div>
        <div class="card-value">${ctx.totalCommits} 次</div>
      </div>
      <div class="card">
        <span class="card-icon">💼</span>
        <div class="card-title">工作日提交</div>
        <div class="card-value">${ctx.workdayCommits} 次</div>
      </div>
      <div class="card">
        <span class="card-icon">🎯</span>
        <div class="card-title">周末提交</div>
        <div class="card-value">${ctx.weekendCommits} 次</div>
      </div>
      <div class="card">
        <span class="card-icon">⏰</span>
        <div class="card-title">工作时间</div>
        <div class="card-value" style="font-size: 20px;">${escapeHtml(ctx.workTime)}</div>
      </div>
      <div class="card">
        <span class="card-icon">🌙</span>
        <div class="card-title">深夜加班</div>
        <div class="card-value" style="font-size: 16px;">${escapeHtml(ctx.lateNightText)}</div>
      </div>
    </div>

    <div class="section">
      <h2>🔥 高频提交时段</h2>
      ${hourList.map((item, i) => `
        <div class="list-item">
          <div class="list-number">${i + 1}</div>
          <span>${escapeHtml(item)}</span>
        </div>
      `).join('')}
    </div>

    <div class="section">
      <h2>📆 高频提交星期</h2>
      ${weekdayList.map((item, i) => `
        <div class="list-item">
          <div class="list-number">${i + 1}</div>
          <span>${escapeHtml(item)}</span>
        </div>
      `).join('')}
    </div>

    <div class="footer">
      <strong>💡 提示：</strong> 996指数仅供参考，请结合团队实际情况辅助判断<br>
      <strong>🔒 隐私：</strong> 所有分析均在本地进行，不会上传任何数据
    </div>
  </div>
</body>
</html>`
}

/** 构造 SVG 报告，便于后续转换 PNG */
function buildSvgReport(ctx: ReportContext): string {
  const width = 1200
  const height = 800

  const indexValue = parseFloat(ctx.indexValue)
  const getIndexColor = () => {
    if (indexValue < 48) return '#10b981'
    if (indexValue < 63) return '#34d399'
    if (indexValue < 85) return '#fbbf24'
    if (indexValue < 100) return '#fb923c'
    if (indexValue < 130) return '#f87171'
    if (indexValue < 160) return '#dc2626'
    return '#991b1b'
  }

  const metrics = [
    { label: '加班比例', value: ctx.overtimeText, icon: '📈' },
    { label: '总提交', value: `${ctx.totalCommits} 次`, icon: '📝' },
    { label: '工作日', value: `${ctx.workdayCommits} 次`, icon: '💼' },
    { label: '周末', value: `${ctx.weekendCommits} 次`, icon: '🎯' },
  ]

  const metricsCards = metrics
    .map(
      (m, i) => `
    <g transform="translate(${40 + (i % 2) * 280}, ${300 + Math.floor(i / 2) * 100})">
      <rect width="250" height="80" rx="12" fill="#ffffff" opacity="0.95"/>
      <text x="20" y="30" font-size="32" fill="#000000">${m.icon}</text>
      <text x="70" y="30" font-size="14" fill="#6b7280" font-weight="600">${escapeXml(m.label)}</text>
      <text x="70" y="58" font-size="20" fill="#111827" font-weight="700">${escapeXml(m.value)}</text>
    </g>
  `
    )
    .join('')

  const infoLines = [
    { label: '⏰ 工作时间', value: truncate(ctx.workTime, 35) },
    { label: '🌙 深夜加班', value: truncate(ctx.lateNightText, 35) },
    { label: '🔥 高频时段', value: truncate(ctx.topHours[0] || '暂无', 35) },
    { label: '📆 高频星期', value: truncate(ctx.topWeekdays[0] || '暂无', 35) },
  ]

  const infoSvg = infoLines
    .map(
      (line, i) => `
    <g transform="translate(640, ${300 + i * 65})">
      <rect width="520" height="55" rx="10" fill="#ffffff" opacity="0.9"/>
      <text x="20" y="22" font-size="13" fill="#6b7280" font-weight="600">${escapeXml(line.label)}</text>
      <text x="20" y="42" font-size="16" fill="#111827" font-weight="500">${escapeXml(line.value)}</text>
    </g>
  `
    )
    .join('')

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
    <filter id="shadow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dx="0" dy="4" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.2"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="${width}" height="${height}" fill="url(#bgGradient)" rx="24"/>

  <!-- 标题卡片 -->
  <g filter="url(#shadow)">
    <rect x="40" y="40" width="${width - 80}" height="220" rx="16" fill="#ffffff" opacity="0.98"/>
  </g>

  <!-- 标题文字 -->
  <text x="60" y="100" font-size="48" font-weight="900" fill="#111827">📊 CODE996</text>
  <text x="60" y="140" font-size="20" fill="#6b7280" font-weight="500">工作强度分析报告</text>
  <text x="60" y="180" font-size="14" fill="#9ca3af">📅 ${escapeXml(ctx.generatedAt)}</text>
  <text x="60" y="205" font-size="14" fill="#9ca3af">⏰ ${escapeXml(truncate(ctx.rangeText, 60))}</text>

  <!-- 996指数高亮 -->
  <g transform="translate(${width - 280}, 70)">
    <circle cx="90" cy="90" r="75" fill="${getIndexColor()}" opacity="0.15"/>
    <text x="90" y="100" font-size="64" font-weight="900" fill="${getIndexColor()}" text-anchor="middle">${ctx.indexValue}</text>
    <text x="90" y="130" font-size="16" fill="#6b7280" text-anchor="middle" font-weight="600">996指数</text>
    <text x="90" y="155" font-size="14" fill="#9ca3af" text-anchor="middle">${escapeXml(truncate(ctx.indexText, 16))}</text>
  </g>

  <!-- 指标卡片 -->
  ${metricsCards}

  <!-- 详细信息 -->
  ${infoSvg}

  <!-- 底部提示 -->
  <g transform="translate(40, ${height - 60})">
    <text x="0" y="0" font-size="13" fill="#ffffff" opacity="0.9">💡 提示：996指数仅供参考，请结合团队实际情况辅助判断</text>
    <text x="0" y="25" font-size="13" fill="#ffffff" opacity="0.9">🔒 隐私：所有分析均在本地进行，不会上传任何数据</text>
  </g>
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
