import chalk from 'chalk'
import { ParsedGitData, Result996 } from '../../../types/git-types'

/** 打印详细分析和建议 */
export function printDetailedAnalysis(result: Result996, parsedData: ParsedGitData): void {
  console.log(chalk.blue('📋 详细分析:'))
  console.log()

  const analysis: string[] = []

  // 1. 加班强度分析
  if (result.overTimeRadio >= 30) {
    analysis.push(`⚠️ 加班比例较高（${result.overTimeRadio}%），工作强度较大`)
  } else if (result.overTimeRadio >= 15) {
    analysis.push(`⚡ 加班比例适中（${result.overTimeRadio}%），存在一定加班情况`)
  } else if (result.overTimeRadio >= 5) {
    analysis.push(`✅ 加班比例较低（${result.overTimeRadio}%），工作节奏相对健康`)
  } else {
    analysis.push(`🎉 几乎无加班（${result.overTimeRadio}%），工作生活平衡良好`)
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

  // 5. 综合建议
  const recommendation = generateRecommendation(result, parsedData)
  console.log(chalk.bold('💬 综合建议:'))
  console.log()
  console.log(`  ${recommendation.emoji} ${chalk.bold(recommendation.action)}`)
  console.log()
  if (recommendation.reason) {
    console.log(chalk.gray(`  理由: ${recommendation.reason}`))
    console.log()
  }
}

/** 生成综合建议 */
export function generateRecommendation(
  result: Result996,
  parsedData: ParsedGitData
): { emoji: string; action: string; reason: string } {
  // 计算各项指标的严重程度分数
  let score = 0

  // 996指数权重最高
  if (result.index996 > 150) score += 40
  else if (result.index996 > 100) score += 30
  else if (result.index996 > 60) score += 20
  else if (result.index996 > 30) score += 10

  // 周末加班
  if (parsedData.weekendOvertime) {
    if (parsedData.weekendOvertime.realOvertimeDays > 15) score += 20
    else if (parsedData.weekendOvertime.realOvertimeDays > 8) score += 10
  }

  // 深夜加班
  if (parsedData.lateNightAnalysis) {
    const totalLateNight = parsedData.lateNightAnalysis.midnight + parsedData.lateNightAnalysis.dawn
    if (totalLateNight > 20) score += 20
    else if (totalLateNight > 10) score += 10

    if (parsedData.lateNightAnalysis.midnightRate > 10) score += 15
    else if (parsedData.lateNightAnalysis.midnightRate > 5) score += 8
  }

  // 根据总分给出建议
  if (score >= 70) {
    return {
      emoji: '🏃‍♂️',
      action: '快跑！这个项目加班文化严重',
      reason: '工作强度过大，长期如此会严重影响身心健康。建议尽快寻找更好的工作环境。',
    }
  } else if (score >= 50) {
    return {
      emoji: '⚠️',
      action: '需警惕，加班情况较严重',
      reason: '存在明显的加班文化，需要评估是否值得长期投入。如果短期项目可以接受，长期建议重新考虑。',
    }
  } else if (score >= 30) {
    return {
      emoji: '🤔',
      action: '谨慎评估，有一定加班但可接受',
      reason: '有一定的加班情况，但在可控范围内。建议关注自身感受，如果压力过大及时调整。',
    }
  } else if (score >= 15) {
    return {
      emoji: '👌',
      action: '可以待，工作强度适中',
      reason: '工作节奏相对健康，偶有加班属于正常范围。是个不错的工作环境。',
    }
  } else {
    return {
      emoji: '🎉',
      action: '非常好！工作生活平衡良好',
      reason: '几乎无加班，工作环境健康。这是难得的好团队，值得长期发展。',
    }
  }
}
