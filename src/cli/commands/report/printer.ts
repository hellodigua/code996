/**
 * 报表打印器统一导出入口
 * 所有打印功能已拆分到 printers/ 子目录中
 * 此文件保持向后兼容，重新导出所有打印函数
 */

export { printCoreResults, type TimeRangeMode } from './printers/core-printer'

export { printTimeDistribution } from './printers/time-distribution-printer'

export { printWorkTimeSummary } from './printers/work-time-printer'

export { printWeekdayOvertime, printWeekendOvertime, printLateNightAnalysis } from './printers/overtime-printer'
