import chalk from 'chalk'
import { ParsedGitData, Result996 } from '../../../types/git-types'
import { t, tIndexDescription } from '../../../i18n'

/** 打印详细分析和建议 */
export function printDetailedAnalysis(result: Result996, parsedData: ParsedGitData): void {
  console.log(chalk.cyan.bold(`📋 ${t('analysis.title')}`))
  console.log()

  const analysis: string[] = []
  const indexDescription = tIndexDescription(result.index996DescriptionKey)

  // 1. 加班强度分析（与 calculator 的描述保持一致）
  const index = result.index996
  if (index <= 0) {
    analysis.push(`🎉 ${t('analysis.overtimeRatio', { desc: indexDescription, ratio: result.overTimeRadio.toFixed(1) })}`)
  } else if (index <= 21) {
    analysis.push(`✅ ${t('analysis.overtimeRatio', { desc: indexDescription, ratio: result.overTimeRadio.toFixed(1) })}`)
  } else if (index <= 48) {
    analysis.push(`🤔 ${t('analysis.overtimeRatio', { desc: indexDescription, ratio: result.overTimeRadio.toFixed(1) })}`)
  } else if (index <= 63) {
    analysis.push(`⚠️ ${t('analysis.overtimeRatio', { desc: indexDescription, ratio: result.overTimeRadio.toFixed(1) })}`)
  } else if (index <= 100) {
    analysis.push(`🚨 ${t('analysis.overtimeRatio', { desc: indexDescription, ratio: result.overTimeRadio.toFixed(1) })}`)
  } else if (index <= 130) {
    analysis.push(`🔥 ${t('analysis.overtimeRatio', { desc: indexDescription, ratio: result.overTimeRadio.toFixed(1) })}`)
  } else {
    analysis.push(`💀 ${t('analysis.overtimeRatio', { desc: indexDescription, ratio: result.overTimeRadio.toFixed(1) })}`)
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
      analysis.push(
        `⚠️ ${t('analysis.weekday.heavy', {
          day: parsedData.weekdayOvertime.peakDay || '',
          count: weekdayMax,
        })}`
      )
    } else if (weekdayMax > 20) {
      analysis.push(
        `📊 ${t('analysis.weekday.some', {
          day: parsedData.weekdayOvertime.peakDay || '',
          count: weekdayMax,
        })}`
      )
    }
  }

  // 3. 周末加班分析
  if (parsedData.weekendOvertime) {
    const weekend = parsedData.weekendOvertime
    if (weekend.realOvertimeDays > 15) {
      analysis.push(`⚠️ ${t('analysis.weekend.severe', { days: weekend.realOvertimeDays })}`)
    } else if (weekend.realOvertimeDays > 8) {
      analysis.push(`📅 ${t('analysis.weekend.warn', { days: weekend.realOvertimeDays })}`)
    } else if (weekend.realOvertimeDays > 0) {
      analysis.push(`📝 ${t('analysis.weekend.occasional', { days: weekend.realOvertimeDays })}`)
    } else if (weekend.casualFixDays > 0) {
      analysis.push(`✅ ${t('analysis.weekend.none', { days: weekend.casualFixDays })}`)
    }
  }

  // 4. 深夜加班分析
  if (parsedData.lateNightAnalysis) {
    const lateNight = parsedData.lateNightAnalysis
    const totalLateNight = lateNight.midnight + lateNight.dawn

    if (totalLateNight > 20) {
      analysis.push(`🌙 ${t('analysis.lateNight.frequent', { days: totalLateNight })}`)
    } else if (totalLateNight > 10) {
      analysis.push(`🌃 ${t('analysis.lateNight.present', { days: totalLateNight })}`)
    } else if (totalLateNight > 0) {
      analysis.push(`💡 ${t('analysis.lateNight.occasional', { days: totalLateNight })}`)
    }

    if (lateNight.midnightRate > 10) {
      analysis.push(`⚠️ ${t('analysis.lateNight.risk', { rate: lateNight.midnightRate.toFixed(1) })}`)
    }
  }

  // 输出分析
  analysis.forEach((item) => {
    console.log(`  ${item}`)
  })

  console.log()
}
