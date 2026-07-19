import { EventEmitter } from 'events'
import { spawn, type ChildProcess } from 'child_process'
import chalk from 'chalk'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { ReportData } from '../report/report-data'
import { resolveLocalWebReportBehavior, resolveOutputMode } from '../cli/output/output-mode'
import { printAnalysisFooter } from '../cli/output/web-report-notice'
import {
  handleWebReportOpen,
  readWebReportOpenPreference,
  resetCode996Config,
  resolveConfigPath,
  writeWebReportOpenPreference,
} from '../cli/output/web-report-open'
import { openLocalFile, writeLocalWebReport } from '../cli/output/web-report-writer'
import { setLocale } from '../i18n'

function createReport(repoPath = '/workspace/demo'): ReportData {
  return {
    schemaVersion: '1',
    meta: { version: '1.2.0', repos: [repoPath], locale: 'zh-CN', options: {} },
    project: { type: 'corporate', confidence: 88 },
    holidayMode: false,
    timezone: null,
    core: { index996: 72, rating: 'bad', overTimeRatio: 24, totalCommits: 320 },
    workTime: null,
    hourlyDistribution: [],
    weekdayDistribution: [],
    weekdayOvertime: null,
    weekendOvertime: null,
    lateNight: null,
    trend: null,
    team: null,
    multiRepo: null,
  }
}

describe('Web 报告输出模式', () => {
  test('未指定格式时以传统终端报告作为主要输出', () => {
    expect(resolveOutputMode({})).toBe('terminal')
  })

  test('只有显式结构化参数才切换主要输出格式', () => {
    expect(resolveOutputMode({ open: true })).toBe('terminal')
    expect(resolveOutputMode({ json: true })).toBe('json')
    expect(resolveOutputMode({ md: true })).toBe('md')
  })

  test('默认先保存 HTML，显式参数决定是否直接打开，结构化输出不生成 HTML', () => {
    expect(resolveLocalWebReportBehavior({})).toEqual({ generate: true, open: false })
    expect(resolveLocalWebReportBehavior({ open: true })).toEqual({ generate: true, open: true })
    expect(resolveLocalWebReportBehavior({ open: false })).toEqual({ generate: true, open: false })
    expect(resolveLocalWebReportBehavior({ json: true })).toEqual({ generate: false, open: false })
    expect(resolveLocalWebReportBehavior({ md: true })).toEqual({ generate: false, open: false })
  })

  test('终端模式在使用提示之后以亮蓝色报告链接收尾', () => {
    const previousColorLevel = chalk.level
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    chalk.level = 3
    setLocale('zh-CN')

    try {
      printAnalysisFooter(true, {
        directory: '/tmp/code996-report/demo',
        indexPath: '/tmp/code996-report/demo/index.html',
        opened: false,
      })

      const lines = logSpy.mock.calls.map(([line]) => String(line ?? ''))
      const noticeIndex = lines.findIndex((line) => line.includes('使用提示'))
      const reportIndex = lines.findIndex((line) => line.includes('已生成本地 Web 报告'))

      expect(noticeIndex).toBeGreaterThanOrEqual(0)
      expect(reportIndex).toBeGreaterThan(noticeIndex)
      expect(lines[reportIndex]).toBe(
        `🌐 已生成本地 Web 报告：${chalk.cyanBright.bold('/tmp/code996-report/demo/index.html')}`
      )
      expect(lines.some((line) => line.includes('报告目录'))).toBe(false)
    } finally {
      chalk.level = previousColorLevel
      logSpy.mockRestore()
    }
  })
})

describe('Web 报告打开偏好', () => {
  test('按平台解析配置路径，并可保存和重置偏好', async () => {
    const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'code996-config-test-'))
    const configPath = path.join(configRoot, 'code996', 'config.json')

    try {
      expect(resolveConfigPath({}, 'linux', '/home/demo')).toBe('/home/demo/.config/code996/config.json')
      expect(resolveConfigPath({ XDG_CONFIG_HOME: '/tmp/config' }, 'linux', '/home/demo')).toBe(
        '/tmp/config/code996/config.json'
      )
      expect(resolveConfigPath({ APPDATA: '/tmp/app-data' }, 'win32', 'C:\\Users\\demo')).toBe(
        '/tmp/app-data/code996/config.json'
      )

      expect(readWebReportOpenPreference(configPath)).toBe('ask')
      writeWebReportOpenPreference('always', configPath)
      expect(readWebReportOpenPreference(configPath)).toBe('always')
      resetCode996Config(configPath)
      expect(readWebReportOpenPreference(configPath)).toBe('ask')
    } finally {
      await fs.rm(configRoot, { recursive: true, force: true })
    }
  })

  test('交互选择可记住偏好并打开报告，显式 --no-open 优先跳过', async () => {
    const report = {
      directory: '/tmp/code996-report/demo',
      indexPath: '/tmp/code996-report/demo/index.html',
      opened: false,
    }
    const openFile = jest.fn(async () => undefined)
    const writePreference = jest.fn()

    await handleWebReportOpen(report, undefined, {
      isInteractive: true,
      readPreference: () => 'ask',
      prompt: async () => ({ open: true, remember: 'always' }),
      openFile,
      writePreference,
    })

    expect(writePreference).toHaveBeenCalledWith('always')
    expect(openFile).toHaveBeenCalledWith(report.indexPath)

    openFile.mockClear()
    await handleWebReportOpen(report, false, {
      isInteractive: true,
      readPreference: () => 'always',
      openFile,
    })
    expect(openFile).not.toHaveBeenCalled()
  })

  test('持久偏好直接生效，非交互环境在 ask 状态下保持静默', async () => {
    const report = {
      directory: '/tmp/code996-report/demo',
      indexPath: '/tmp/code996-report/demo/index.html',
      opened: false,
    }
    const openFile = jest.fn(async () => undefined)
    const prompt = jest.fn(async () => ({ open: true }))

    await handleWebReportOpen(report, undefined, { isInteractive: true, readPreference: () => 'always', openFile })
    expect(openFile).toHaveBeenCalledTimes(1)

    await handleWebReportOpen(report, undefined, {
      isInteractive: false,
      readPreference: () => 'ask',
      openFile,
      prompt,
    })
    expect(openFile).toHaveBeenCalledTimes(1)
    expect(prompt).not.toHaveBeenCalled()
  })
})

describe('本地 Web 报告生成', () => {
  let testRoot: string
  let assetsDir: string

  beforeEach(async () => {
    testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'code996-web-test-'))
    assetsDir = path.join(testRoot, 'source')
    await fs.mkdir(path.join(assetsDir, 'assets'), { recursive: true })
    await fs.writeFile(
      path.join(assetsDir, 'index.html'),
      '<!doctype html><html><head><link rel="stylesheet" crossorigin href="./assets/app.css"><script type="module" src="./assets/app.js"></script></head><body></body></html>'
    )
    await fs.writeFile(path.join(assetsDir, 'assets', 'app.js'), 'window.__APP_LOADED__ = true')
    await fs.writeFile(path.join(assetsDir, 'assets', 'app.css'), 'body { color: red; }')
  })

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true })
  })

  test('复制离线资产并安全注入 ReportData', async () => {
    const report = createReport('/workspace/</script><script>alert(1)</script>')
    const result = await writeLocalWebReport(report, {
      assetsDir,
      tempRoot: testRoot,
      now: new Date(2026, 6, 18, 1, 20, 33),
      open: false,
    })

    const html = await fs.readFile(result.indexPath, 'utf8')
    expect(html).toContain('window.__CODE996_REPORT__')
    expect(html).toContain('\\u003c/script\\u003e')
    expect(html).not.toContain('</script><script>alert(1)</script>')
    expect(html).toContain('window.__APP_LOADED__ = true')
    expect(html).not.toContain('type="module" src="./assets/app.js"')
    expect(html).toContain('rel="stylesheet" href="./assets/app.css"')
    expect(html).not.toContain('rel="stylesheet" crossorigin')
    expect(path.dirname(result.directory)).toBe(testRoot)
    expect(path.basename(result.directory)).toMatch(/^2026-07-18_01-20-33_/)
    expect(path.basename(result.directory)).not.toMatch(/[<>:"/\\|?*]/)
    await expect(fs.readFile(path.join(result.directory, 'assets', 'app.js'), 'utf8')).resolves.toContain(
      '__APP_LOADED__'
    )
  })

  test('同一项目在同一秒生成报告时保留两份可识别目录', async () => {
    const now = new Date(2026, 6, 18, 1, 20, 33)
    const first = await writeLocalWebReport(createReport(), { assetsDir, tempRoot: testRoot, now, open: false })
    const second = await writeLocalWebReport(createReport(), { assetsDir, tempRoot: testRoot, now, open: false })

    expect(path.basename(first.directory)).toBe('2026-07-18_01-20-33_demo')
    expect(path.basename(second.directory)).toBe('2026-07-18_01-20-33_demo_2')
  })

  test('Downloads 无法写入时降级到系统临时目录', async () => {
    const fakeHome = path.join(testRoot, 'home')
    const fakeTemp = path.join(testRoot, 'system-temp')
    await fs.mkdir(path.join(fakeHome, 'Downloads'), { recursive: true })
    await fs.writeFile(path.join(fakeHome, 'Downloads', 'code996-report'), 'blocked by a file')

    const homeSpy = jest.spyOn(os, 'homedir').mockReturnValue(fakeHome)
    const tempSpy = jest.spyOn(os, 'tmpdir').mockReturnValue(fakeTemp)
    try {
      const result = await writeLocalWebReport(createReport(), { assetsDir, open: false })

      expect(path.dirname(result.directory)).toBe(path.join(fakeTemp, 'code996-report'))
      expect(result.storageFallback).toBeInstanceOf(Error)
      await expect(fs.access(result.indexPath)).resolves.toBeUndefined()
    } finally {
      homeSpy.mockRestore()
      tempSpy.mockRestore()
    }
  })

  test('默认调用系统打开器，失败时仍返回报告路径供用户手动访问', async () => {
    const openedPaths: string[] = []
    const opened = await writeLocalWebReport(createReport(), {
      assetsDir,
      tempRoot: testRoot,
      openFile: async (filePath) => {
        openedPaths.push(filePath)
      },
    })
    expect(opened.opened).toBe(true)
    expect(openedPaths).toEqual([opened.indexPath])

    const degraded = await writeLocalWebReport(createReport(), {
      assetsDir,
      tempRoot: testRoot,
      openFile: async () => {
        throw new Error('no browser')
      },
    })
    expect(degraded.opened).toBe(false)
    expect(degraded.openError?.message).toBe('no browser')
    await expect(fs.access(degraded.indexPath)).resolves.toBeUndefined()
  })
})

describe('系统打开器', () => {
  test('仅在系统打开器正常退出后报告成功', async () => {
    const child = new EventEmitter()
    const spawnProcess = jest.fn(() => child as ChildProcess) as unknown as typeof spawn

    const opening = openLocalFile('/tmp/code996 report/index.html', 'linux', spawnProcess)
    child.emit('spawn')

    let settled = false
    void opening.finally(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    child.emit('close', 0, null)
    await expect(opening).resolves.toBeUndefined()
    expect(spawnProcess).toHaveBeenCalledWith('xdg-open', ['/tmp/code996 report/index.html'], {
      stdio: 'ignore',
    })
  })

  test('系统打开器以非零状态退出时报告失败', async () => {
    const child = new EventEmitter()
    const spawnProcess = jest.fn(() => child as ChildProcess) as unknown as typeof spawn

    const opening = openLocalFile('/tmp/report/index.html', 'linux', spawnProcess)
    child.emit('spawn')
    child.emit('close', 3, null)

    await expect(opening).rejects.toThrow('xdg-open failed with exit code 3.')
  })
})
