import fs from 'fs'
import path from 'path'
import { exportReport } from '../cli/commands/report/exporter'
import { Result996, ParsedGitData, GitLogData } from '../types/git-types'
import { AnalyzeOptions } from '../cli'

describe('Report Exporter', () => {
  const mockResult: Result996 = {
    index996: 85.5,
    index996Str: '很差，接近996的程度',
    overTimeRadio: 30.5,
  }

  const mockParsedData: ParsedGitData = {
    hourData: [
      { time: '9', count: 5 },
      { time: '10', count: 10 },
      { time: '14', count: 8 },
    ],
    dayData: [
      { time: '1', count: 15 },
      { time: '2', count: 20 },
      { time: '3', count: 12 },
    ],
    totalCommits: 100,
    workHourPl: [
      { time: '工作', count: 70 },
      { time: '加班', count: 30 },
    ],
    workWeekPl: [
      { time: '工作日', count: 75 },
      { time: '周末', count: 25 },
    ],
    detectedWorkTime: {
      startHour: 9,
      endHour: 18,
      isReliable: true,
      sampleCount: 50,
      detectionMethod: 'quantile-window',
      confidence: 85,
    },
    weekendOvertime: {
      saturdayDays: 10,
      sundayDays: 5,
      casualFixDays: 8,
      realOvertimeDays: 7,
    },
    lateNightAnalysis: {
      evening: 5,
      lateNight: 3,
      midnight: 2,
      dawn: 1,
      midnightDays: 3,
      totalWorkDays: 50,
      midnightRate: 6,
      totalWeeks: 12,
      totalMonths: 3,
    },
  }

  const mockRawData: GitLogData = {
    byDay: [
      { time: '1', count: 15 },
      { time: '2', count: 20 },
    ],
    byHour: [
      { time: '9', count: 5 },
      { time: '10', count: 10 },
    ],
    totalCommits: 100,
  }

  const mockOptions: AnalyzeOptions = {
    since: '2024-01-01',
    until: '2024-12-31',
  }

  const testOutputDir = path.join(process.cwd(), 'test-output')

  beforeAll(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }
  })

  afterAll(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  beforeEach(() => {
    // 切换到测试输出目录
    process.chdir(testOutputDir)
  })

  describe('导出为文本格式', () => {
    it('应该生成 report.txt 文件', async () => {
      await exportReport('txt', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {
          since: '2024-01-01',
          until: '2024-12-31',
        },
      })

      const filePath = path.join(testOutputDir, 'report.txt')
      expect(fs.existsSync(filePath)).toBe(true)

      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('CODE996')
      expect(content).toContain('85.5')
      expect(content).toContain('30.5%')
    })

    it('文本内容应包含关键信息', async () => {
      await exportReport('txt', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {},
      })

      const content = fs.readFileSync(path.join(testOutputDir, 'report.txt'), 'utf-8')
      expect(content).toContain('996指数')
      expect(content).toContain('加班比例')
      expect(content).toContain('工作分布')
      expect(content).toContain('高频提交')
    })
  })

  describe('导出为 Markdown 格式', () => {
    it('应该生成 report.md 文件', async () => {
      await exportReport('md', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {
          since: '2024-01-01',
          until: '2024-12-31',
        },
      })

      const filePath = path.join(testOutputDir, 'report.md')
      expect(fs.existsSync(filePath)).toBe(true)

      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('# 📊 CODE996')
      expect(content).toContain('| 指标 | 数值 |')
      expect(content).toContain('**85.5**')
    })

    it('Markdown 应包含表格', async () => {
      await exportReport('markdown', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {},
      })

      const content = fs.readFileSync(path.join(testOutputDir, 'report.md'), 'utf-8')
      expect(content).toContain('|')
      expect(content).toContain('---')
    })
  })

  describe('导出为 HTML 格式', () => {
    it('应该生成 report.html 文件', async () => {
      await exportReport('html', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {
          since: '2024-01-01',
          until: '2024-12-31',
        },
      })

      const filePath = path.join(testOutputDir, 'report.html')
      expect(fs.existsSync(filePath)).toBe(true)

      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('<!doctype html>')
      expect(content).toContain('CODE996')
      expect(content).toContain('85.5')
    })

    it('HTML 应包含样式', async () => {
      await exportReport('html', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {},
      })

      const content = fs.readFileSync(path.join(testOutputDir, 'report.html'), 'utf-8')
      expect(content).toContain('<style>')
      expect(content).toContain('linear-gradient')
    })
  })

  describe('导出为 SVG 格式', () => {
    it('应该生成 report.svg 文件', async () => {
      await exportReport('svg', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {
          since: '2024-01-01',
          until: '2024-12-31',
        },
      })

      const filePath = path.join(testOutputDir, 'report.svg')
      expect(fs.existsSync(filePath)).toBe(true)

      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('<svg')
      expect(content).toContain('CODE996')
      expect(content).toContain('85.5')
    })

    it('SVG 应包含渐变定义', async () => {
      await exportReport('svg', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {},
      })

      const content = fs.readFileSync(path.join(testOutputDir, 'report.svg'), 'utf-8')
      expect(content).toContain('linearGradient')
      expect(content).toContain('defs')
    })
  })

  describe('格式别名支持', () => {
    it('应该支持 text 别名', async () => {
      await exportReport('text', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {},
      })

      expect(fs.existsSync(path.join(testOutputDir, 'report.txt'))).toBe(true)
    })

    it('应该支持 report.html 别名', async () => {
      await exportReport('report.html', {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {},
      })

      expect(fs.existsSync(path.join(testOutputDir, 'report.html'))).toBe(true)
    })
  })

  describe('错误处理', () => {
    it('应该处理不支持的格式', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await exportReport('invalid-format' as any, {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {},
      })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('应该处理空的 format 参数', async () => {
      await exportReport(undefined, {
        result: mockResult,
        parsedData: mockParsedData,
        rawData: mockRawData,
        options: mockOptions,
        timeRange: {},
      })

      // 默认应该生成 txt 文件
      expect(fs.existsSync(path.join(testOutputDir, 'report.txt'))).toBe(true)
    })
  })
})
