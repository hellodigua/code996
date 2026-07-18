import { getTotalCount, getRadio } from './utils'
import { TimeCount } from '../../../typings'
import { i18n } from '../../../i18n'

export function getWeekResult(weekData: TimeCount[]) {
  const workDayData = weekData.slice(0, 5)
  const saturdayData = weekData[5]
  const sundayData = weekData[6]
  // commit 总数
  const totalCount = getTotalCount(weekData)
  const commitCount = {
    workday: getTotalCount(workDayData),
    saturday: saturdayData.count,
    sunday: sundayData.count,
  }

  // commit 比例
  const commitRatio = {
    workday: getRadio(commitCount.workday, totalCount),
    saturday: getRadio(commitCount.saturday, totalCount),
    sunday: getRadio(commitCount.sunday, totalCount),
  }

  const workWeekPl = [
    { time: i18n.global.t('result.timeLabels.workday'), count: commitCount.workday },
    { time: i18n.global.t('result.timeLabels.weekend'), count: commitCount.saturday + commitCount.sunday },
  ]

  const workDayType = getWorkDayType(commitRatio)
  const workDayTypeMap = [5, 6, 6, 7, 7]

  const workDayTypeValue = workDayTypeMap[workDayType - 1]

  return {
    totalCount,
    commitCount,
    commitRatio,

    workDayType,
    workDayTypeValue,
    workWeekPl,
  }
}

/**
 * 获取每周工作时长
 * @returns type 1: 每周5天 2: 每周6天 3: 大小周 4: 每周7天 5: 周末干活
 */
export function getWorkDayType(commitRatio: any): number {
  let type = 1
  if (commitRatio.workday >= 90) {
    type = 1
  } else if (commitRatio.workday >= 85 && commitRatio.workday < 90) {
    type = 2
  } else if (commitRatio.workday >= 79 && commitRatio.workday < 85) {
    type = 3
  } else if (commitRatio.workday >= 72 && commitRatio.workday < 79) {
    type = 4
  } else if (commitRatio.workday < 72) {
    type = 5
  }
  return type
}
