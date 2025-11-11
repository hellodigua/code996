import { TimeCount, WorkTimeData, Result996 } from '../types/git-types'

/**
 * 计算 996 指数（完全复用原算法）
 * 这是项目的核心算法，用于评估项目的加班强度
 *
 * @param workTimeData 工作时间数据
 * @returns 996 指数结果
 */
export function calculate996Index(data: WorkTimeData): Result996 {
  const { workHourPl, workWeekPl, hourData } = data

  // y: 正常工作时间的 commit 数量
  const y = workHourPl[0].count

  // x: 加班时间的 commit 数量
  const x = workHourPl[1].count

  // m: 工作日的 commit 数量
  const m = workWeekPl[0].count

  // n: 周末的 commit 数量
  const n = workWeekPl[1].count

  /**
   * 修正后的加班提交数量 (overTimeAmendCount)
   *
   * 原始工作日加班提交：x
   * 周末修正项： (y * n) / (m + n)
   *   - 若周末提交较少，修正项按工作日平均效率折算为等效加班提交，避免少量零散周末提交直接导致加班率异常偏高或偏低。
   *
   * 最终加班率 overTimeRadio 公式：ceil( ( overTimeAmendCount / (x + y) ) * 100 )
   *   - 百分比语义：数值即百分比（35 表示 35%）
   *   - 仅在初算为 0 且样本小时 < 9 时，进入“不饱和”补偿逻辑 (getUn996Radio)，可能产生负值。
   *   - 负值解释：工作量不足，返回与标准 9 小时产能的差异百分比（例如 -88 表示低 88%）。
   */
  const overTimeAmendCount = Math.round(x + (y * n) / (m + n))

  // 总工作日提交（不含周末修正项，用于分母）
  const totalCount = y + x

  // 加班提交百分比（正值区间通常 0-100，负值表示不饱和），使用整数先乘确保浮点稳定
  let overTimeRadio = Math.ceil((overTimeAmendCount * 100) / totalCount)

  // 针对低加班且数据量不足的情况进行特殊处理
  if (overTimeRadio === 0 && hourData.length < 9) {
    overTimeRadio = getUn996Radio({ hourData, totalCount })
  }

  /**
   * 996 指数 = 加班比例 * 3
   *
   * 乘以 3 的原因：
   * - 标准 996 的加班率约为 37.5%
   * - 37.5% * 3 ≈ 112.5 ≈ 100（四舍五入）
   * - 使得 996 工作制对应的指数约为 100
   */
  const index996 = overTimeRadio * 3

  // 生成分析文字
  const index996Str = generateDescription(index996)

  return {
    index996,
    index996Str,
    overTimeRadio,
  }
}

/**
 * 生成 996 指数分析文字
 * 使用统一的分析体系
 */
function generateDescription(index996: number): string {
  if (index996 <= 0) return '非常健康，是理想的项目情况'
  if (index996 <= 21) return '很健康，加班非常少'
  if (index996 <= 48) return '还行，偶尔加班，能接受'
  if (index996 <= 63) return '较差，加班文化比较严重'
  if (index996 <= 100) return '很差，接近996的程度'
  if (index996 <= 130) return '非常差，加班文化严重'
  return '加班文化非常严重，福报已经修满了'
}

/**
 * 计算不加班比例
 * 用于处理工作量较少的项目
 *
 * 计算思路：
 * 1. 周末一定不加班
 * 2. 工作日的工作时间 < 9 小时
 * 3. 根据现有数据推算标准工作量（9小时）
 * 4. 计算实际工作量与标准工作量的差异
 *
 * @returns 负值，表示工作不饱和程度
 */
function getUn996Radio({ hourData, totalCount }: { hourData: TimeCount[]; totalCount: number }): number {
  // 计算每小时平均 commit 数
  const averageCommit = totalCount / hourData.length

  // 模拟标准工作日（9小时）的 commit 总数
  const mockTotalCount = averageCommit * 9

  // 计算工作饱和度（返回负值）
  const radio = Math.ceil((totalCount / mockTotalCount) * 100) - 100

  return radio
}
