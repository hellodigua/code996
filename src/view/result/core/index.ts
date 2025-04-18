import { calculateService } from './calculate-service'

/**
 * 获取路由元信息
 * 从URL中解析出时间范围、小时数据和周数据
 * @returns 解析后的数据对象
 */
export function getRoutesMeta() {
  calculateService.initFromRoute()
  return calculateService.getRoutesMeta()
}

/**
 * 获取分析结果
 * 综合小时维度和天维度的数据，计算996指数和加班情况
 * @returns 分析结果对象，包含工作类型、工作时间、996指数等信息
 */
export function getResult() {
  return calculateService.getFullResult()
}

/**
 * 下面的方法保留作为兼容性，新代码应该使用calculateService
 */

// 兼容导出get996Index以保持旧代码的兼容性
export const get996Index = calculateService.get996Index.bind(calculateService)
