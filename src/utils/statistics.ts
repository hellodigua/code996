/**
 * 统计工具函数
 * 提供常用的统计计算方法
 */

/**
 * 计算百分位数
 * @param sortedValues 已排序的数值数组
 * @param percentile 百分位（0-100）
 * @returns 计算得到的百分位值
 *
 * @example
 * calculatePercentile([1, 2, 3, 4, 5], 50) // 返回 3 (中位数)
 * calculatePercentile([1, 2, 3, 4, 5], 25) // 返回 2 (第一四分位数)
 * calculatePercentile([1, 2, 3, 4, 5], 75) // 返回 4 (第三四分位数)
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0
  const index = (percentile / 100) * (sortedValues.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower

  if (lower === upper) {
    return sortedValues[lower]
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}

