import { describe, expect, it } from '@jest/globals'
import { ProjectClassifier, ProjectType } from '../core/project-classifier'
import { setLocale } from '../i18n'
import { GitLogData, ParsedGitData } from '../types/git-types'

describe('ProjectClassifier i18n', () => {
  it('英文模式下开源项目特征描述不应混入中文', () => {
    setLocale('en')

    const rawData: GitLogData = {
      byHour: [],
      byDay: [],
      totalCommits: 100,
      contributors: 12,
      dayHourCommits: [
        { weekday: 1, hour: 20, count: 20 },
        { weekday: 2, hour: 21, count: 18 },
        { weekday: 3, hour: 22, count: 16 },
        { weekday: 4, hour: 23, count: 14 },
        { weekday: 5, hour: 19, count: 10 },
      ],
    }

    const parsedData: ParsedGitData = {
      hourData: [],
      dayData: [],
      totalCommits: 100,
      workHourPl: [
        { time: 'work', count: 20 },
        { time: 'overtime', count: 80 },
      ],
      workWeekPl: [
        { time: 'weekday', count: 78 },
        { time: 'weekend', count: 22 },
      ],
    }

    const classification = ProjectClassifier.classify(rawData, parsedData)
    const combinedText = [
      classification.dimensions.workTimeRegularity.description,
      classification.dimensions.weekendActivity.description,
      classification.dimensions.moonlightingPattern.description,
      classification.dimensions.contributorsCount.description,
      classification.reasoning,
    ].join('\n')

    expect(classification.projectType).toBe(ProjectType.OPEN_SOURCE)
    expect(combinedText).toContain('high weekend activity')
    expect(combinedText).toContain('Highly active in the evening')
    expect(combinedText).toContain('typical open-source signal')
    expect(combinedText).not.toMatch(/[\u4e00-\u9fff]/)
  })
})
