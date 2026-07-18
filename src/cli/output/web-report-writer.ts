import { spawn } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { ReportData } from '../../report/report-data'

export interface LocalWebReportResult {
  directory: string
  indexPath: string
  opened: boolean
  openError?: Error
  storageFallback?: Error
}

export interface LocalWebReportOptions {
  assetsDir?: string
  tempRoot?: string
  open?: boolean
  openFile?: (filePath: string) => Promise<void>
  now?: Date
}

interface ReportDirectory {
  directory: string
  storageFallback?: Error
}

async function isDirectory(directory: string): Promise<boolean> {
  try {
    return (await fs.stat(directory)).isDirectory()
  } catch {
    return false
  }
}

async function resolveWebAssetsDirectory(explicitDirectory?: string): Promise<string> {
  const candidates = explicitDirectory
    ? [explicitDirectory]
    : [
        path.resolve(__dirname, '../../web'),
        path.resolve(__dirname, '../../../dist/web'),
        path.resolve(process.cwd(), 'dist/web'),
      ]

  for (const candidate of candidates) {
    if (await isDirectory(candidate)) return candidate
  }

  throw new Error('Web report assets are missing. Run the code996 build before generating a Web report.')
}

async function copyDirectory(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true })
  const entries = await fs.readdir(source, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(source, entry.name)
      const destinationPath = path.join(destination, entry.name)
      if (entry.isDirectory()) {
        await copyDirectory(sourcePath, destinationPath)
      } else if (entry.isFile()) {
        await fs.copyFile(sourcePath, destinationPath)
      }
    })
  )
}

function formatReportTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

function getReportProjectName(report: ReportData): string {
  if (report.meta.repos.length !== 1) return `${report.meta.repos.length}-repos`
  const normalized = (report.meta.repos[0] || '').replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || 'project'
}

function sanitizeDirectoryName(value: string): string {
  const sanitized = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 80)

  if (!sanitized) return 'project'
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(sanitized) ? `project-${sanitized}` : sanitized
}

async function resolveReportDirectory(baseName: string, tempRoot?: string): Promise<ReportDirectory> {
  if (tempRoot) {
    await fs.mkdir(tempRoot, { recursive: true })
    return { directory: await createReportDirectory(tempRoot, baseName) }
  }

  const downloadsRoot = path.join(os.homedir(), 'Downloads', 'code996-report')
  try {
    await fs.mkdir(downloadsRoot, { recursive: true })
    // mkdir 在目录已存在时无法证明目录可写，因此把实际报告目录创建也放在降级保护内。
    return { directory: await createReportDirectory(downloadsRoot, baseName) }
  } catch (error) {
    const storageFallback = error instanceof Error ? error : new Error(String(error))
    const fallbackRoot = path.join(os.tmpdir(), 'code996-report')
    await fs.mkdir(fallbackRoot, { recursive: true })
    return {
      directory: await createReportDirectory(fallbackRoot, baseName),
      storageFallback,
    }
  }
}

async function createReportDirectory(root: string, baseName: string): Promise<string> {
  for (let sequence = 1; sequence <= 999; sequence += 1) {
    const directoryName = sequence === 1 ? baseName : `${baseName}_${sequence}`
    const directory = path.join(root, directoryName)
    try {
      await fs.mkdir(directory)
      return directory
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }

  throw new Error(`Unable to create a unique Web report directory for ${baseName}.`)
}

/** 将 JSON 转成可安全放入内联 script 的字面量，阻断 </script> 提前闭合。 */
export function serializeReportForHtml(report: ReportData): string {
  return JSON.stringify(report)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function injectReportData(template: string, report: ReportData): string {
  const closingHead = '</head>'
  if (!template.includes(closingHead)) throw new Error('Invalid Web report template: missing </head>.')

  const dataScript = `  <script>window.__CODE996_REPORT__ = ${serializeReportForHtml(report)};</script>\n`
  return template.replace(closingHead, `${dataScript}${closingHead}`)
}

function makeStylesheetLinksFileCompatible(template: string): string {
  return template.replace(/<link\b[^>]*>/gi, (linkTag) => {
    if (!/\brel=["'][^"']*\bstylesheet\b[^"']*["']/i.test(linkTag)) return linkTag

    // Vite 默认添加 crossorigin；file:// 页面没有可参与 CORS 的同源身份，浏览器会因此拦截本地 CSS。
    return linkTag.replace(/\s+crossorigin(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
  })
}

async function inlineModuleScripts(template: string, reportDirectory: string): Promise<string> {
  const moduleScriptPattern = /<script\b(?=[^>]*\btype=["']module["'])[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g
  const matches = Array.from(template.matchAll(moduleScriptPattern))
  let result = template

  // 从后向前替换，避免前一个替换改变后续匹配位置。
  for (const match of matches.reverse()) {
    const source = match[1]
    const scriptPath = path.resolve(reportDirectory, source)
    const relativePath = path.relative(reportDirectory, scriptPath)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(`Invalid Web report script path: ${source}`)
    }

    const script = (await fs.readFile(scriptPath, 'utf8')).replace(/<\/script/gi, '<\\/script')
    const replacement = `<script type="module">\n${script}\n</script>`
    const start = match.index ?? 0
    result = `${result.slice(0, start)}${replacement}${result.slice(start + match[0].length)}`
  }

  return result
}

/** 使用参数数组调用系统打开器，避免通过 shell 拼接用户可控的文件路径。 */
export async function openLocalFile(
  filePath: string,
  platform: NodeJS.Platform = process.platform,
  spawnProcess: typeof spawn = spawn
): Promise<void> {
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer.exe' : 'xdg-open'

  await new Promise<void>((resolve, reject) => {
    const child = spawnProcess(command, [filePath], {
      stdio: 'ignore',
    })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`
      reject(new Error(`${command} failed with ${reason}.`))
    })
  })
}

/**
 * 将完整离线 Web 产物写入 Downloads/code996-report，再注入本次分析数据。
 * tempRoot 仅供测试或内部调用覆盖输出根目录，不作为公开 CLI 参数。
 */
export async function writeLocalWebReport(
  report: ReportData,
  options: LocalWebReportOptions = {}
): Promise<LocalWebReportResult> {
  const assetsDirectory = await resolveWebAssetsDirectory(options.assetsDir)
  const reportName = `${formatReportTimestamp(options.now ?? new Date())}_${sanitizeDirectoryName(getReportProjectName(report))}`
  const reportDirectory = await resolveReportDirectory(reportName, options.tempRoot)
  const directory = reportDirectory.directory

  await copyDirectory(assetsDirectory, directory)
  const indexPath = path.join(directory, 'index.html')
  const template = await fs.readFile(indexPath, 'utf8')
  const fileCompatibleTemplate = await inlineModuleScripts(makeStylesheetLinksFileCompatible(template), directory)
  await fs.writeFile(indexPath, injectReportData(fileCompatibleTemplate, report), 'utf8')

  if (options.open === false) {
    return { directory, indexPath, opened: false, storageFallback: reportDirectory.storageFallback }
  }

  try {
    await (options.openFile ?? openLocalFile)(indexPath)
    return { directory, indexPath, opened: true, storageFallback: reportDirectory.storageFallback }
  } catch (error) {
    return {
      directory,
      indexPath,
      opened: false,
      openError: error instanceof Error ? error : new Error(String(error)),
      storageFallback: reportDirectory.storageFallback,
    }
  }
}
