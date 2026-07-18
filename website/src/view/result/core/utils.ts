import { TimeCount } from '../../../typings'

/**
 * 计算总数量
 */
export function getTotalCount(data: TimeCount[]) {
  return data.reduce((total, item) => total + item.count, 0)
}

/**
 * 计算比例
 * @param element 分子
 * @param denominator 分母
 * @param decimal 小数位，默认2位
 * @returns 百分比
 */
export function getRadio(element: number, denominator: number, decimal: number = 2): number {
  return +((element / denominator) * 100).toFixed(decimal)
}

/**
 * 获取随机文本
 */
export function getRandomText(texts: string[] = []): string {
  return texts[Math.floor(Math.random() * texts.length)]
}

/**
 * 寻找最接近的数字
 */
export function findNear(num: number = 0, list: number[] = []): number {
  let min = Number.MAX_VALUE
  let index = 0
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const diff = Math.abs(num - item)
    if (diff < min) {
      min = diff
      index = i
    }
  }
  return list[index]
}
