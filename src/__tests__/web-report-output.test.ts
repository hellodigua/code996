import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { ReportData } from '../report/report-data'
import { resolveOutputMode } from '../cli/output/output-mode'
import { writeLocalWebReport } from '../cli/output/web-report-writer'

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
  test('无论运行环境如何，未指定格式时都输出传统终端报告', () => {
    expect(resolveOutputMode({})).toBe('terminal')
  })

  test('只有显式参数才切换到 Web 或结构化格式', () => {
    expect(resolveOutputMode({ web: true })).toBe('web')
    expect(resolveOutputMode({ json: true })).toBe('json')
    expect(resolveOutputMode({ md: true })).toBe('md')
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
