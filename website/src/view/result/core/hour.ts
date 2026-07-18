import { TimeCount } from '../../../typings'
import { i18n } from '../../../i18n'

export function getHourResult(hourData: TimeCount[]) {
  const { openingTime, closingTime } = getWorkTimeRange(hourData)
  const { workHourPl } = getWorkingTime(hourData, openingTime)

  return {
    openingTime,
    closingTime,
    workHourPl,
  }
}

/**
 * 获取工作相关commit数据
 */
function getWorkTimeRange(hourData: TimeCount[]) {
  // 平方平均数(并非所有模型均适用， 只有在数值分布呈现正态分布时才适用，因此commit数量越多越准确)
  const quadraticValue = hourData.reduce((total, item) => total + item.count ** 2, 0) / hourData.length
  const standardValue = Math.sqrt(quadraticValue)
  const calcData = hourData.map((item: TimeCount, index: number) => {
    const score = item.count / standardValue
    return {
      ...item,
      score,
      prevScore: (item.count - (hourData[index - 1]?.count || item.count)) / standardValue,
      nextScore: ((hourData[index + 1]?.count || item.count) - item.count) / standardValue,
    }
  })

  // 工作时间
  const workData = calcData.filter((item) => item.score >= 0.45)
  // 开工时间段
  const openingData = workData.filter((item) => +item.time >= 8 && +item.time <= 12)
  // 收工时间段
  const closingData = workData.filter((item) => +item.time >= 17 && +item.time <= 23)

  const openingTime = openingData.sort((a, b) => Number(a.time) - Number(b.time))[0]
  const closingTime = closingData.sort((a, b) => Number(b.time) - Number(a.time))[0]

  return {
    // 上班时间
    openingTime,
    // 下班时间
    closingTime,
  }
}

/**
 * 计算每日工作时间和加班时间
 * 劳动法规定：每日工作时间不超过八小时，同时大部分公司的标准工作时间为朝九晚六，共9小时
 * 因此定义工作时间为从开工时间算起的区间为9的时间段，加班时间为剩余时间
 */
function getWorkingTime(hourData: TimeCount[] = [], openingTime: TimeCount) {
  // 获取从开工时间算起的正常工作时间
  const workingTime = hourData.filter(
    (item) => +item.time >= +openingTime?.time && +item.time <= +openingTime?.time + 9
  )
  const workingElseTime = hourData.filter((item) => !workingTime.includes(item))
  const workingTimeCount = workingTime.reduce((total, item) => total + item.count, 0)
  const workingElseTimeCount = workingElseTime.reduce((total, item) => total + item.count, 0)

  // 获取效率最高的前 9 个小时（适用开源项目）
  const sortData = hourData.sort((a, b) => b.count - a.count)
  const top9Time = sortData.slice(0, 9)
  const top9ElseTime = sortData.slice(9, sortData.length + 1)
  const top9TimeCount = top9Time.reduce((total, item) => total + item.count, 0)
  const top9ElseTimeCount = top9ElseTime.reduce((total, item) => total + item.count, 0)

  const workHourPl = [
    { time: i18n.global.t('result.chartLabels.work'), count: workingTimeCount, timeCount: top9Time.length },
    { time: i18n.global.t('result.chartLabels.overtime'), count: workingElseTimeCount, timeCount: top9ElseTime.length },
  ]

  return { workHourPl, workingTimeCount, workingElseTimeCount, top9TimeCount, top9ElseTimeCount }
}
