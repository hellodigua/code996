import { generateVercelUrl, printVercelUrl } from '../utils/url-generator'
import { GitLogData } from '../types/git-types'

describe('URL Generator', () => {
  const mockRawData: GitLogData = {
    byDay: [
      { time: '1', count: 10 },
      { time: '2', count: 15 },
      { time: '3', count: 12 },
      { time: '4', count: 8 },
      { time: '5', count: 20 },
      { time: '6', count: 5 },
      { time: '7', count: 3 },
    ],
    byHour: [
      { time: '9', count: 5 },
      { time: '10', count: 8 },
      { time: '14', count: 10 },
      { time: '18', count: 7 },
    ],
    totalCommits: 83,
  }

  describe('generateVercelUrl', () => {
    it('应该生成包含时间范围的 URL', () => {
      const url = generateVercelUrl({
        timeRange: {
          since: '2024-01-01',
          until: '2024-12-31',
        },
        rawData: mockRawData,
      })

      expect(url).toContain('https://code996.vercel.app/#/result')
      expect(url).toContain('time=2024-01-01_2024-12-31')
    })

    it('应该正确编码星期数据', () => {
      const url = generateVercelUrl({
        timeRange: {
          since: '2024-01-01',
          until: '2024-12-31',
        },
        rawData: mockRawData,
      })

      // URL 编码后的格式
      expect(url).toContain('%26week%3D')
      expect(url).toContain('10_1')
      expect(url).toContain('15_2')
      expect(url).toContain('20_5')
    })

    it('应该正确编码小时数据', () => {
      const url = generateVercelUrl({
        timeRange: {
          since: '2024-01-01',
          until: '2024-12-31',
        },
        rawData: mockRawData,
      })

      // URL 编码后的格式
      expect(url).toContain('%26hour%3D')
      expect(url).toContain('5_09')
      expect(url).toContain('8_10')
      expect(url).toContain('10_14')
    })

    it('应该包含 format 参数', () => {
      const url = generateVercelUrl({
        timeRange: {
          since: '2024-01-01',
          until: '2024-12-31',
        },
        rawData: mockRawData,
        format: 'html',
      })

      expect(url).toContain('format=html')
    })

    it('应该使用默认 format 为 txt', () => {
      const url = generateVercelUrl({
        timeRange: {},
        rawData: mockRawData,
      })

      expect(url).toContain('format=txt')
    })

    it('应该处理空的时间范围', () => {
      const url = generateVercelUrl({
        timeRange: {},
        rawData: mockRawData,
      })

      expect(url).toContain('time=_')
      expect(url).toContain('%26week%3D')
      expect(url).toContain('%26hour%3D')
    })

    it('应该支持不同的 format 类型', () => {
      const formats: Array<'txt' | 'md' | 'html' | 'svg' | 'png'> = ['txt', 'md', 'html', 'svg', 'png']

      formats.forEach((format) => {
        const url = generateVercelUrl({
          timeRange: {},
          rawData: mockRawData,
          format,
        })

        expect(url).toContain(`format=${format}`)
      })
    })
  })

  describe('printVercelUrl', () => {
    let consoleSpy: jest.SpyInstance

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('应该打印 URL', () => {
      const testUrl = 'https://code996.vercel.app/#/result?time=test'
      printVercelUrl(testUrl)

      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls.some((call) => call.join('').includes(testUrl))).toBe(true)
    })

    it('应该包含提示信息', () => {
      const testUrl = 'https://test.com'
      printVercelUrl(testUrl)

      const allOutput = consoleSpy.mock.calls.map((call) => call.join('')).join('\n')
      expect(allOutput).toContain('可视化')
      expect(allOutput).toContain('链接')
    })
  })
})
