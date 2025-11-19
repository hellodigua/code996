import Table from 'cli-table3'

/**
 * 获取终端宽度，设置合理范围
 * @returns 终端宽度（字符数）
 */
export function getTerminalWidth(): number {
  try {
    // 获取终端宽度，设置合理范围
    const width = process.stdout.columns || 80
    return Math.max(40, Math.min(width, 200)) // 限制在40-200字符之间，支持更窄的终端
  } catch {
    return 80 // 降级方案
  }
}

/**
 * 计算时间范围，默认为最近一年
 * @param allTime 是否查询所有时间
 * @returns { since: string, until: string }
 */
export function calculateTimeRange(allTime: boolean = false): { since: string; until: string } {
  if (allTime) {
    return {
      since: '1970-01-01', // Unix纪元开始
      until: '2100-01-01', // 远期日期
    }
  }

  const today = new Date()
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(today.getFullYear() - 1)

  // 格式化为YYYY-MM-DD
  const since = oneYearAgo.toISOString().split('T')[0]
  const until = today.toISOString().split('T')[0]

  return { since, until }
}

/**
 * 计算趋势报告表格列宽（10列表头），根据终端宽度自适应
 * @param terminalWidth 终端宽度
 * @returns 10列宽度数组
 */
export function calculateTrendTableWidths(terminalWidth: number): number[] {
  const columnCount = 10
  const baseWidths = [9, 10, 10, 10, 10, 10, 8, 10, 12, 10] // 月份、指数、平均工时、平均开始、平均结束、最晚结束、提交数、参与人数、工作天数、置信度
  const minColumnWidth = 3

  // 估算边框和分隔线占用：列间分隔线(columnCount-1) + 左右边框2，共 columnCount 个字符
  const borderOverhead = columnCount
  const availableWidth = Math.max(terminalWidth - borderOverhead, columnCount)

  const baseTotal = baseWidths.reduce((sum, width) => sum + width, 0)

  // 如果基础宽度总和超过可用宽度，需要压缩
  if (baseTotal > availableWidth) {
    const scale = availableWidth / baseTotal
    let widths = baseWidths.map((width) => Math.max(minColumnWidth, Math.floor(width * scale)))
    let currentSum = widths.reduce((sum, width) => sum + width, 0)

    // 如果超过可用宽度，则在不低于最小值的前提下依次回收
    let index = 0
    let safetyGuard = columnCount * 10 // 防止极端情况下死循环
    while (currentSum > availableWidth && safetyGuard > 0) {
      const col = index % columnCount
      if (widths[col] > minColumnWidth) {
        widths[col]--
        currentSum--
      }
      index++
      safetyGuard--
    }
    return widths
  }

  // 基础宽度适合，直接使用，不再扩展填满
  return baseWidths
}

/**
 * 创建自适应表格
 * @param terminalWidth 终端宽度
 * @param tableType 表格类型
 * @param options 表格选项
 * @param customColWidths 手动指定的列宽数组，可覆盖默认计算结果
 * @returns Table实例
 */
export function createAdaptiveTable(
  terminalWidth: number,
  tableType: 'core' | 'stats' | 'time',
  options: any = {},
  customColWidths?: number[]
): any {
  const defaultOptions = {
    chars: {
      top: '═',
      'top-mid': '╤',
      'top-left': '╔',
      'top-right': '╗',
      bottom: '═',
      'bottom-mid': '╧',
      'bottom-left': '╚',
      'bottom-right': '╝',
      left: '║',
      'left-mid': '╟',
      mid: '─',
      'mid-mid': '┼',
      right: '║',
      'right-mid': '╢',
      middle: '│',
    },
    style: { 'padding-left': 1, 'padding-right': 1 },
    wordWrap: true,
    wrapOnWordBoundary: true,
    truncate: '',
  }

  const colWidths =
    customColWidths && customColWidths.length > 0
      ? customColWidths
      : calculatePresetTableWidths(tableType, terminalWidth) // 按类型获取默认列宽，自动处理兜底逻辑

  return new Table({
    ...defaultOptions,
    ...options,
    // 确保 wordWrap / wrapOnWordBoundary / truncate 使用统一默认值
    wordWrap: options.wordWrap !== undefined ? options.wordWrap : defaultOptions.wordWrap,
    wrapOnWordBoundary:
      options.wrapOnWordBoundary !== undefined ? options.wrapOnWordBoundary : defaultOptions.wrapOnWordBoundary,
    truncate: options.truncate !== undefined ? options.truncate : defaultOptions.truncate,
    colWidths,
  })
}

/**
 * 统一计算 core/stats/time 三种表格的列宽，并为未知类型提供兜底方案，避免重复逻辑
 * @param tableType 表格类型
 * @param terminalWidth 终端宽度
 */
function calculatePresetTableWidths(tableType: 'core' | 'stats' | 'time' | string, terminalWidth: number): number[] {
  if (tableType === 'time') {
    // 时间分布表格：保留固定的时间列，剩余宽度用于进度条
    const fixedOverhead = 5
    const availableWidth = terminalWidth - fixedOverhead
    const timeColumnWidth = 5
    const barColumnWidth = availableWidth - timeColumnWidth
    return [timeColumnWidth, barColumnWidth]
  }

  if (tableType === 'core' || tableType === 'stats') {
    // core/stats 都是双列结构，差别仅在标签列的约束
    const config =
      tableType === 'core'
        ? { labelMin: 15, labelRatioMax: 0.25, labelHardMax: 20 }
        : { labelMin: 20, labelRatioMax: 0.4, labelHardMax: 25 }

    return calculateTwoColumnWidths(terminalWidth, config)
  }

  // 未知类型默认退回到通用的双列表配置，保证不会抛异常
  return [15, 70]
}

/**
 * 统一的两列表布局计算函数，避免重复逻辑
 * @param terminalWidth 终端宽度
 * @param options 列宽配置
 * @returns 列宽数组
 */
function calculateTwoColumnWidths(
  terminalWidth: number,
  options: { labelMin: number; labelRatioMax: number; labelHardMax: number }
): number[] {
  // 固定边框和间距占用：左右边框2个字符 + 内边距2个字符 + 分隔符1个字符 = 5字符
  const fixedOverhead = 5
  const availableWidth = terminalWidth - fixedOverhead

  const labelColumnMaxByRatio = Math.floor(availableWidth * options.labelRatioMax)
  const labelColumnWidth = Math.max(options.labelMin, Math.min(labelColumnMaxByRatio, options.labelHardMax))

  const valueColumnWidth = availableWidth - labelColumnWidth
  return [labelColumnWidth, valueColumnWidth]
}
