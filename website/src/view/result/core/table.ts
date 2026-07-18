import { getRoutesMeta, get996Index } from './index'
import { getHourResult } from './hour'
import { getWeekResult } from './week'
import { i18n } from '../../../i18n'

export function getTableCore() {
  const { hourData, weekData } = getRoutesMeta()
  const { openingTime, closingTime, workHourPl } = getHourResult(hourData)
  const { workDayTypeValue, workWeekPl } = getWeekResult(weekData)
  const { index996, overTimeRadio, isStandard } = get996Index({ workHourPl, workWeekPl, hourData })

  const openingTimeValue = Number(openingTime?.time)
  const closingTimeValue = Number(closingTime?.time)

  const tableConfig = [
    { label: i18n.global.t('result.table.dailyWorkTime'), key: 'codeTime', unit: 'h' },
    { label: i18n.global.t('result.table.weeklyWorkTime'), key: 'weekTime', unit: 'h' },
    { label: i18n.global.t('result.table.weeklyOvertime'), key: 'overtime', unit: 'h' },
    { label: i18n.global.t('result.table.overtimeRatio'), key: 'overTimeRadio', unit: '%' },
    { label: i18n.global.t('result.table.index996'), key: 'index996', unit: '' },
  ]

  const attendance = closingTimeValue - openingTimeValue

  /**
   * 日均工作时长
   * 如果下班时间小于19点，那么默认只休息中午1.5小时
   * 否则加晚上加班餐1小时，按2.5小时算
   */
  let codeTime = 0
  if (closingTimeValue <= 19) {
    codeTime = closingTimeValue - openingTimeValue - 1.5
  } else if (closingTimeValue > 19) {
    codeTime = closingTimeValue - openingTimeValue - 2.5
  }

  const weekTime = codeTime * workDayTypeValue
  const overtime = (overTimeRadio * 0.01 * weekTime).toFixed(1)

  const currConfig = {
    type: `${openingTimeValue || '?'}${closingTimeValue % 12 || '?'}${workDayTypeValue || '?'}`,
    attendance,
    codeTime,
    weekTime,
    overtime,
    overTimeRadio,
    index996,
  }

  let tableData: any[] = [
    { type: '955', attendance: 8, codeTime: 6.5, weekTime: 32.5, overtime: -5, overTimeRadio: -11, index996: -33 },
    { type: '965', attendance: 9, codeTime: 7.5, weekTime: 37.5, overtime: 0, overTimeRadio: 0, index996: 0 },
    { type: '966', attendance: 9, codeTime: 7.5, weekTime: 45, overtime: 7.5, overTimeRadio: 16, index996: 48 },
    { type: '995', attendance: 12, codeTime: 9.5, weekTime: 47.5, overtime: 10, overTimeRadio: 21, index996: 63 },
    { type: '996', attendance: 12, codeTime: 9.5, weekTime: 57, overtime: 19.5, overTimeRadio: 34, index996: 100 },
    { type: '997', attendance: 12, codeTime: 9.5, weekTime: 66.5, overtime: 29, overTimeRadio: 44, index996: 130 },
    { type: '9126', attendance: 15, codeTime: 12.5, weekTime: 75, overtime: 37.5, overTimeRadio: 50, index996: 150 },
  ]

  if (isStandard) {
    tableData = [...tableData, currConfig].sort((a, b) => a.index996 - b.index996)
  }

  return {
    tableConfig,
    tableData,
    index996,
    isStandard,
  }
}
