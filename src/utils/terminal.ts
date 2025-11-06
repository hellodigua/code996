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
      until: '2100-01-01'    // 远期日期
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
 * 计算核心结果表格的列宽
 * @param terminalWidth 终端宽度
 * @returns 列宽数组
 */
export function calculateCoreTableWidths(terminalWidth: number): number[] {
  // 固定边框和间距占用：左右边框2个字符 + 内边距2个字符 + 分隔符1个字符 = 5字符
  const fixedOverhead = 5
  const availableWidth = terminalWidth - fixedOverhead

  // 第一列（标签列）最小宽度15字符，占总宽度的20%-25%
  const labelColumnMin = 15
  const labelColumnMax = Math.floor(availableWidth * 0.25)
  const labelColumnWidth = Math.max(labelColumnMin, Math.min(labelColumnMax, 20))

  // 第二列（值列）使用剩余空间
  const valueColumnWidth = availableWidth - labelColumnWidth

  return [labelColumnWidth, valueColumnWidth]
}

/**
 * 计算统计信息表格的列宽
 * @param terminalWidth 终端宽度
 * @returns 列宽数组
 */
export function calculateStatsTableWidths(terminalWidth: number): number[] {
  // 固定边框和间距占用：左右边框2个字符 + 内边距2个字符 + 分隔符1个字符 = 5字符
  const fixedOverhead = 5
  const availableWidth = terminalWidth - fixedOverhead

  // 第一列（标签列）最小宽度20字符，占总宽度的30%-40%
  const labelColumnMin = 20
  const labelColumnMax = Math.floor(availableWidth * 0.4)
  const labelColumnWidth = Math.max(labelColumnMin, Math.min(labelColumnMax, 25))

  // 第二列（值列）使用剩余空间
  const valueColumnWidth = availableWidth - labelColumnWidth

  return [labelColumnWidth, valueColumnWidth]
}

/**
 * 计算时间分布表格的列宽
 * @param terminalWidth 终端宽度
 * @returns 列宽数组
 */
export function calculateTimeTableWidths(terminalWidth: number): number[] {
  // 固定边框和间距占用：左右边框2个字符 + 内边距2个字符 + 分隔符1个字符 = 5字符
  const fixedOverhead = 5
  const availableWidth = terminalWidth - fixedOverhead

  // 时间列固定宽度（2位小时 + 冒号 + 2位分钟）
  const timeColumnWidth = 5

  // 进度条列使用剩余空间
  const barColumnWidth = availableWidth - timeColumnWidth

  return [timeColumnWidth, barColumnWidth]
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
    truncate: '',
  }

  let colWidths: number[]

  if (customColWidths && customColWidths.length > 0) {
    colWidths = customColWidths
  } else {
    switch (tableType) {
      case 'core':
        colWidths = calculateCoreTableWidths(terminalWidth)
        break
      case 'stats':
        colWidths = calculateStatsTableWidths(terminalWidth)
        break
      case 'time':
        colWidths = calculateTimeTableWidths(terminalWidth)
        break
      default:
        colWidths = [15, 70] // 默认宽度
    }
  }

  return new Table({
    ...defaultOptions,
    ...options,
    // 确保 wordWrap 和 truncate 不被覆盖
    wordWrap: options.wordWrap !== undefined ? options.wordWrap : defaultOptions.wordWrap,
    truncate: options.truncate !== undefined ? options.truncate : defaultOptions.truncate,
    colWidths,
  })
}
