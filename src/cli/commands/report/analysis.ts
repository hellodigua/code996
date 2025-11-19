import chalk from 'chalk'
import { ParsedGitData, Result996 } from '../../../types/git-types'

/** 打印详细分析和建议 */
export function printDetailedAnalysis(result: Result996, parsedData: ParsedGitData): void {
  console.log(chalk.blue('📋 详细分析:'))
  console.log()

  const analysis: string[] = []

  // 1. 加班强度分析（与 calculator 的描述保持一致）
  const index = result.index996
  if (index <= 0) {
    analysis.push(`🎉 ${result.index996Str}（加班比例 ${result.overTimeRadio.toFixed(1)}%）`)
  } else if (index <= 21) {
    analysis.push(`✅ ${result.index996Str}（加班比例 ${result.overTimeRadio.toFixed(1)}%）`)
  } else if (index <= 48) {
    analysis.push(`🤔 ${result.index996Str}（加班比例 ${result.overTimeRadio.toFixed(1)}%）`)
  } else if (index <= 63) {
    analysis.push(`⚠️ ${result.index996Str}（加班比例 ${result.overTimeRadio.toFixed(1)}%）`)
  } else if (index <= 100) {
    analysis.push(`🚨 ${result.index996Str}（加班比例 ${result.overTimeRadio.toFixed(1)}%）`)
  } else if (index <= 130) {
    analysis.push(`🔥 ${result.index996Str}（加班比例 ${result.overTimeRadio.toFixed(1)}%）`)
  } else {
    analysis.push(`💀 ${result.index996Str}（加班比例 ${result.overTimeRadio.toFixed(1)}%）`)
  }

  // 2. 工作日加班分析
  if (parsedData.weekdayOvertime) {
    const weekdayMax = Math.max(
      parsedData.weekdayOvertime.monday,
      parsedData.weekdayOvertime.tuesday,
      parsedData.weekdayOvertime.wednesday,
      parsedData.weekdayOvertime.thursday,
      parsedData.weekdayOvertime.friday
    )
    if (weekdayMax > 50) {
      analysis.push(`⚠️ 工作日加班频繁，${parsedData.weekdayOvertime.peakDay}是加班高峰（${weekdayMax}次提交）`)
    } else if (weekdayMax > 20) {
      analysis.push(`📊 工作日有一定加班，${parsedData.weekdayOvertime.peakDay}加班相对较多（${weekdayMax}次提交）`)
    }
  }

  // 3. 周末加班分析
  if (parsedData.weekendOvertime) {
    const weekend = parsedData.weekendOvertime
    if (weekend.realOvertimeDays > 15) {
      analysis.push(`⚠️ 周末加班严重（${weekend.realOvertimeDays}天真正加班），工作侵占休息时间`)
    } else if (weekend.realOvertimeDays > 8) {
      analysis.push(`📅 周末有较多加班（${weekend.realOvertimeDays}天），需警惕！`)
    } else if (weekend.realOvertimeDays > 0) {
      analysis.push(`📝 偶有周末加班（${weekend.realOvertimeDays}天），大部分是临时修复`)
    } else if (weekend.casualFixDays > 0) {
      analysis.push(`✅ 周末基本无加班，仅${weekend.casualFixDays}天临时修复`)
    }
  }

  // 4. 深夜加班分析
  if (parsedData.lateNightAnalysis) {
    const lateNight = parsedData.lateNightAnalysis
    const totalLateNight = lateNight.midnight + lateNight.dawn

    if (totalLateNight > 20) {
      analysis.push(`🌙 深夜加班频繁（${totalLateNight}天），严重影响健康`)
    } else if (totalLateNight > 10) {
      analysis.push(`🌃 存在深夜加班情况（${totalLateNight}天），需注意休息`)
    } else if (totalLateNight > 0) {
      analysis.push(`💡 偶有深夜加班（${totalLateNight}天），整体可控`)
    }

    if (lateNight.midnightRate > 10) {
      analysis.push(`⚠️ ${lateNight.midnightRate.toFixed(1)}% 的工作日有深夜/凌晨提交，需警惕健康风险`)
    }
  }

  // 输出分析
  analysis.forEach((item) => {
    console.log(`  ${item}`)
  })

  console.log()
}

