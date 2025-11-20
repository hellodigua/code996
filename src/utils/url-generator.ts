import chalk from 'chalk'
import { exec } from 'child_process'
import { promisify } from 'util'
import { ParsedGitData, GitLogData } from '../types/git-types'

const execAsync = promisify(exec)

interface UrlData {
  timeRange: {
    since?: string
    until?: string
  }
  rawData: GitLogData
  format?: 'txt' | 'md' | 'html' | 'svg' | 'png'
}

export function generateVercelUrl(data: UrlData): string {
  const { timeRange, rawData, format = 'txt' } = data

  const byDay = rawData.byDay.map((item) => `${item.count}_${item.time}`).join(',')
  const byHour = rawData.byHour.map((item) => `${item.count}_${item.time.padStart(2, '0')}`).join(',')

  const since = timeRange.since || ''
  const until = timeRange.until || ''

  const result = `${since}_${until}&week=${byDay}&hour=${byHour}`

  const baseUrl = 'https://code996.vercel.app/#/result'
  const queryParams = new URLSearchParams({
    time: result,
    format: format,
  })

  return `${baseUrl}?${queryParams.toString()}`
}

export async function openUrlInBrowser(url: string): Promise<void> {
  const platform = process.platform

  let command: string

  switch (platform) {
    case 'darwin':
      command = `open "${url}"`
      break
    case 'win32':
      command = `start "" "${url}"`
      break
    default:
      command = `xdg-open "${url}"`
      break
  }

  try {
    await execAsync(command)
    console.log(chalk.green('✓ 已在浏览器中打开'))
  } catch (error) {
    console.error(chalk.yellow('⚠️  无法自动打开浏览器，请手动复制链接访问'))
  }
}

export function printVercelUrl(url: string): void {
  console.log()
  console.log(chalk.blue('🔗 可视化分析链接:'))
  console.log(chalk.cyan(url))
  console.log()
  console.log(chalk.gray('提示: 复制以上链接到浏览器查看可视化报告'))
}
