import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import type { ReportData } from '../../src/report/report-data'
import App from './App.vue'
import BarChart from './components/charts/BarChart.vue'

function createReport(projectType: ReportData['project'] = { type: 'corporate', confidence: 88 }): ReportData {
  return {
    schemaVersion: '1',
    meta: {
      version: '1.2.0',
      repos: ['/workspace/demo'],
      since: '2025-01-01',
      until: '2025-12-31',
      rangeMode: 'custom',
      locale: 'zh-CN',
      options: {},
    },
    project: projectType,
    holidayMode: true,
    timezone: {
      isCrossTimezone: false,
      crossTimezoneRatio: 0,
      dominantTimezone: '+0800',
      dominantRatio: 1,
      sleepPeriodRatio: 0,
      confidence: 90,
    },
    core: {
      index996: 72,
      rating: 'bad',
      overTimeRatio: 24,
      totalCommits: 320,
    },
    workTime: {
      startHour: 9.5,
      endHour: 19,
      isReliable: true,
      sampleCount: 120,
      detectionMethod: 'quantile-window',
      confidence: 82,
    },
    hourlyDistribution: Array.from({ length: 24 }, (_, hour) => ({
      hour: String(hour).padStart(2, '0'),
      count: hour >= 9 && hour <= 19 ? hour - 7 : 0,
    })),
    weekdayDistribution: [
      { day: 'monday', count: 58 },
      { day: 'tuesday', count: 62 },
      { day: 'wednesday', count: 60 },
      { day: 'thursday', count: 54 },
      { day: 'friday', count: 49 },
      { day: 'saturday', count: 25 },
      { day: 'sunday', count: 12 },
    ],
    weekdayOvertime: {
      monday: 10,
      tuesday: 14,
      wednesday: 8,
      thursday: 12,
      friday: 6,
      peakDay: 'tuesday',
      peakCount: 14,
    },
    weekendOvertime: {
      saturdayDays: 6,
      sundayDays: 3,
      casualFixDays: 4,
      realOvertimeDays: 5,
    },
    lateNight: {
      evening: 18,
      lateNight: 8,
      midnight: 3,
      dawn: 1,
      midnightDays: 4,
      totalWorkDays: 120,
      midnightRate: 3.3,
      totalWeeks: 52,
      totalMonths: 12,
    },
    trend: null,
    team: null,
    multiRepo: null,
  }
}

describe('单仓库 Web 报告', () => {
  test('展示 CLI 已计算的数据，切换语言时数值保持不变', async () => {
    const wrapper = mount(App, {
      props: { report: createReport({ type: 'corporate', confidence: 88 }) },
      global: { stubs: { BarChart: true } },
    })

    expect(wrapper.get('[data-testid="repo-name"]').text()).toBe('demo')
    expect(wrapper.get('[data-testid="score"]').text()).toBe('72')
    expect(wrapper.get('[data-testid="result-topbar"]').text()).toContain('#CODE996 Result')
    expect(wrapper.get('[data-testid="result-summary"]').text()).toContain('推测你们的工作时间为：')
    expect(wrapper.get('[data-testid="result-summary"]').text()).toContain('09:30–19:00')
    expect(wrapper.get('[data-testid="details-link"]').attributes('href')).toBe('#report-details')
    expect(wrapper.find('#report-details').exists()).toBe(true)
    expect(wrapper.text()).toContain('工作节奏诊断')
    expect(wrapper.text()).toContain('工作日加班')

    await wrapper.get('[data-testid="language-switcher"]').trigger('click')

    expect(wrapper.text()).toContain('Work rhythm diagnostics')
    expect(wrapper.text()).toContain('Weekday overtime')
    expect(wrapper.get('[data-testid="result-summary"]').text()).toContain('Estimated work hours:')
    expect(wrapper.get('[data-testid="score"]').text()).toBe('72')
    const weekdayChart = wrapper.findAllComponents(BarChart).find((chart) => chart.props('data').length === 7)
    const hourlyChart = wrapper.findAllComponents(BarChart).find((chart) => chart.props('data').length === 24)
    expect(weekdayChart?.props('data')[0].time).toBe('Mon')
    expect(hourlyChart?.props('wide')).toBe(true)
  })

  test('开源项目展示适用性提醒，不显示 996 指数结论', () => {
    const wrapper = mount(App, {
      props: { report: createReport({ type: 'open_source', confidence: 91 }) },
      global: { stubs: { BarChart: true } },
    })

    expect(wrapper.find('[data-testid="score"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="open-source-notice"]').text()).toContain('开源项目')
  })

  test('多仓库报告同时展示成功、开源和失败仓库的状态', () => {
    const report = createReport({ type: 'mixed', confidence: 74 })
    report.multiRepo = {
      repos: [
        {
          name: 'backend',
          path: '/workspace/backend',
          status: 'success',
          core: { index996: 81, rating: 'veryBad', overTimeRatio: 35 },
          totalCommits: 520,
          contributors: 8,
          project: { type: 'corporate', confidence: 91 },
        },
        {
          name: 'community',
          path: '/workspace/community',
          status: 'success',
          core: { index996: 40, rating: 'healthy', overTimeRatio: 8 },
          totalCommits: 210,
          contributors: 16,
          project: { type: 'open_source', confidence: 89 },
        },
        {
          name: 'broken',
          path: '/workspace/broken',
          status: 'failed',
          error: 'not a git repository',
          core: null,
          totalCommits: 0,
          project: null,
        },
      ],
    }

    const wrapper = mount(App, {
      props: { report },
      global: { stubs: { BarChart: true } },
    })

    expect(wrapper.get('[data-testid="repo-name"]').text()).toContain('3 个仓库')
    expect(wrapper.find('[data-testid="score"]').exists()).toBe(false)
    expect(wrapper.find('#report-details').exists()).toBe(false)
    expect(wrapper.get('[data-testid="open-source-notice"]').text()).toContain('所选仓库包含开源项目')
    expect(wrapper.get('[data-testid="multi-repo"]').text()).toContain('backend')
    expect(wrapper.get('[data-testid="multi-repo"]').text()).toContain('81')
    expect(wrapper.get('[data-testid="multi-repo"]').text()).toContain('开源项目，不评分')
    expect(wrapper.get('[data-testid="repo-broken"]').text()).toContain('分析失败')
    expect(wrapper.get('[data-testid="repo-broken"]').text()).toContain('not a git repository')
  })

  test('数据量不足时给出明确状态，并隐藏没有意义的图表', () => {
    const report = createReport({ type: 'uncertain', confidence: 20 })
    report.core = { index996: 0, rating: 'ideal', overTimeRatio: 0, totalCommits: 0 }
    report.workTime = null
    report.hourlyDistribution = []
    report.weekdayDistribution = []
    report.weekdayOvertime = null
    report.weekendOvertime = null
    report.lateNight = null

    const wrapper = mount(App, {
      props: { report },
      global: { stubs: { BarChart: true } },
    })

    expect(wrapper.get('[data-testid="limited-data"]').text()).toContain('数据不足')
    expect(wrapper.find('.timeline-section').exists()).toBe(false)
    expect(wrapper.find('.chart-card').exists()).toBe(false)
  })

  test('少量提交不展示可靠性不足的评分，但保留客观分布', () => {
    const report = createReport({ type: 'uncertain', confidence: 40 })
    report.core.totalCommits = 12
    report.hourlyDistribution = [{ hour: '20', count: 12 }]

    const wrapper = mount(App, {
      props: { report },
      global: { stubs: { BarChart: true } },
    })

    expect(wrapper.get('[data-testid="limited-data"]').text()).toContain('数据不足')
    expect(wrapper.find('[data-testid="score"]').exists()).toBe(false)
    expect(wrapper.find('.timeline-section').exists()).toBe(true)
    expect(wrapper.get('.timeline-section').findAll('bar-chart-stub')).toHaveLength(1)
  })

  test('完整展示 CLI 的诊断、分类、时区、趋势和团队分析', async () => {
    const report = createReport()
    report.workTime!.endHour = 24
    report.project = {
      type: 'corporate',
      confidence: 88,
      dimensions: {
        workTimeRegularity: { score: 75 },
        weekendActivity: { ratio: 0.1 },
        moonlightingPattern: { isActive: false, eveningToMorningRatio: 0.2, nightRatio: 0.1 },
        contributorsCount: { count: 4 },
      },
    } as ReportData['project']
    report.timezone = {
      isCrossTimezone: true,
      crossTimezoneRatio: 0.18,
      dominantTimezone: '+0800',
      dominantRatio: 0.82,
      sleepPeriodRatio: 0.03,
      confidence: 86,
      timezoneGroups: [
        { offset: '+0800', count: 262, ratio: 0.82 },
        { offset: '-0700', count: 58, ratio: 0.18 },
      ],
    }
    report.trend = {
      timeRange: { since: '2025-01-01', until: '2025-12-31' },
      summary: { totalMonths: 12, avgIndex996: 68.4, avgWorkSpan: 10.2, trend: 'increasing' },
      monthlyData: [
        {
          month: '2025-12',
          index996: 76.5,
          avgWorkSpan: 12.5,
          workSpanStdDev: 2.4,
          avgStartTime: '09:10',
          avgEndTime: '21:35',
          latestEndTime: '23:45',
          totalCommits: 88,
          contributors: 4,
          workDays: 19,
          dataQuality: 'sufficient',
          confidence: 'high',
        },
      ],
    }
    report.team = {
      totalAnalyzed: 2,
      totalContributors: 4,
      filterThreshold: 20,
      baselineEndHour: 20.5,
      distribution: { normal: 0, moderate: 1, heavy: 1 },
      statistics: {
        median996: 72,
        mean996: 74,
        range: [68, 80],
        percentiles: { p25: 69, p50: 72, p75: 78, p90: 80 },
      },
      healthAssessment: { overallIndex: 72, teamMedianIndex: 72 },
      contributors: [
        {
          author: 'Alice',
          email: 'alice@example.com',
          totalCommits: 180,
          commitPercentage: 56.25,
          avgStartTimeMedian: 9,
          avgEndTimeMedian: 20.5,
          validDays: 32,
          index996: 80,
          overtimeStats: { workdayOvertime: 35, weekendOvertime: 12, totalOvertime: 47 },
          intensityLevel: 'heavy',
        },
        {
          author: 'Bob',
          email: 'bob@example.com',
          totalCommits: 140,
          commitPercentage: 43.75,
          avgStartTimeMedian: 9.5,
          avgEndTimeMedian: 19,
          validDays: 28,
          index996: 68,
          overtimeStats: { workdayOvertime: 20, weekendOvertime: 8, totalOvertime: 28 },
          intensityLevel: 'moderate',
        },
      ],
    } as ReportData['team']

    const wrapper = mount(App, {
      props: { report },
      global: { stubs: { BarChart: true } },
    })

    expect(wrapper.get('[data-testid="diagnostic-insights"]').text()).toContain('结论与风险信号')
    expect(wrapper.get('[data-testid="diagnostic-insights"]').text()).toContain('24:00')
    expect(wrapper.get('[data-testid="classification-evidence"]').text()).toContain('项目类型依据')
    expect(wrapper.get('[data-testid="classification-evidence"] .classification-heading')).toBeTruthy()
    expect(wrapper.get('[data-testid="timezone-analysis"]').text()).toContain('跨时区分析')
    expect(wrapper.get('[data-testid="context-evidence-stack"]').element.children).toHaveLength(2)
    expect(wrapper.get('[data-testid="classification-evidence"] .context-detail-ledger')).toBeTruthy()
    expect(wrapper.get('[data-testid="timezone-analysis"] .context-detail-ledger')).toBeTruthy()
    expect(wrapper.text()).not.toContain('沿用 CLI 的判断阈值')
    expect(wrapper.find('.rhythm-grid').exists()).toBe(true)
    expect(wrapper.findAll('bar-chart-stub')).toHaveLength(3)
    expect(
      wrapper.get('[data-testid="overtime-analysis"]').findAll('.overtime-summary-grid > .ledger-card')
    ).toHaveLength(2)
    expect(wrapper.get('[data-testid="overtime-analysis"]').findAll('.overtime-compact-table')).toHaveLength(2)
    expect(wrapper.get('[data-testid="overtime-analysis"]').findAll('.overtime-compact-table > div')).toHaveLength(8)
    expect(wrapper.get('[data-testid="trend-analysis"]').text()).toContain('23:45')
    expect(wrapper.get('[data-testid="trend-analysis"]').text()).toContain('12.5h')
    const qualityIndicator = wrapper.get('[data-testid="trend-analysis"] .quality-indicator')
    expect(qualityIndicator.text()).toBe('充足')
    expect(qualityIndicator.attributes('aria-label')).toBe('充足 / 高置信度')
    expect(qualityIndicator.findAll('.quality-signal .is-active')).toHaveLength(3)
    expect(wrapper.get('[data-testid="team-analysis"]').text()).toContain('团队健康度')
    expect(wrapper.get('[data-testid="team-analysis"]').text()).toContain('20:30')
    const notices = wrapper.get('[data-testid="report-notices"]')
    expect(notices.get('.section-kicker').text()).toBe('NOTICE')
    expect(notices.text()).not.toContain('使用提示')
    expect(notices.text()).toContain('隐私保护')
    expect(notices.text()).toContain('分析局限性')
    expect(notices.text()).toContain('使用限制')
    expect(notices.get('.notice-privacy strong').text()).toBe(
      '所有对 Git 数据的分析均在本地进行，不会上传任何结果或日志。'
    )
    expect(notices.get('#report-command-title').text()).toBe('命令说明')
    expect(notices.get('#report-options-title').text()).toContain('命令与参数')
    expect(notices.get('#report-recipes-title').text()).toContain('常用组合命令')
    expect(notices.get('.report-options-details').attributes('open')).toBeUndefined()
    expect(notices.get('.report-recipes-details').attributes('open')).toBeUndefined()
    expect(notices.find('.report-command-tabs').exists()).toBe(false)
    expect(notices.findAll('.report-option-list > li')).toHaveLength(22)
    expect(notices.findAll('.report-recipe-list > li')).toHaveLength(10)
    expect(notices.text()).toContain('npx code996 --web')
    expect(notices.text()).toContain('npx code996 "/path/to/repo-a" "/path/to/repo-b"')
    expect(notices.text()).toContain('code996 help')
    expect(notices.text()).toContain('--skip-user-analysis')
    expect(notices.get('a').attributes('href')).toBe('https://github.com/hellodigua/code996')

    await wrapper.get('[data-testid="language-switcher"]').trigger('click')
    expect(wrapper.get('[data-testid="diagnostic-insights"]').text()).toContain('Findings and risk signals')
    expect(wrapper.get('[data-testid="trend-analysis"]').text()).toContain('Latest end')
    expect(wrapper.get('[data-testid="trend-analysis"] .quality-indicator').attributes('aria-label')).toBe(
      'Sufficient / High confidence'
    )
    expect(wrapper.get('[data-testid="team-analysis"]').text()).toContain('Team health')
    expect(wrapper.get('[data-testid="report-notices"]').text()).toContain('Limitations')
    expect(wrapper.get('#report-command-title').text()).toBe('Command guide')
    expect(wrapper.get('#report-options-title').text()).toContain('Commands and options')
    expect(wrapper.get('#report-recipes-title').text()).toContain('Common command recipes')
    expect(wrapper.get('[data-testid="report-notices"]').text()).toContain('Generate and open a local Web report')
  })
})
