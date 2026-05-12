import chalk from 'chalk'
import Table from 'cli-table3'
import { RepoAnalysisRecord } from '../../../types/git-types'
import { t } from '../../../i18n'

/**
 * 多仓库对比报表打印器
 */
export class MultiComparisonPrinter {
  /**
   * 打印各仓库的 996 指数对比表
   * @param records 各仓库的分析记录
   */
  static print(records: RepoAnalysisRecord[]): void {
    if (records.length === 0) {
      return
    }

    // 过滤掉提交数为 0 的项目
    const filteredRecords = records.filter((record) => {
      // 保留失败的记录（显示错误状态）
      if (record.status === 'failed') {
        return true
      }
      // 只过滤掉成功但没有提交的项目
      return record.data.totalCommits > 0
    })

    // 如果过滤后没有记录，不显示表格
    if (filteredRecords.length === 0) {
      console.log(chalk.yellow(`⚠️ ${t('multi.comparison.empty')}`))
      console.log()
      return
    }

    console.log(chalk.cyan.bold(`📊 ${t('multi.comparison.title')}`))
    console.log()

    const table = new Table({
      head: [
        chalk.bold(t('multi.comparison.index')),
        chalk.bold(t('multi.comparison.name')),
        chalk.bold(t('multi.comparison.indexValue')),
        chalk.bold(t('multi.comparison.ratio')),
        chalk.bold(t('multi.comparison.commits')),
        chalk.bold(t('multi.comparison.contributors')),
        chalk.bold(t('multi.comparison.range')),
        chalk.bold(t('multi.comparison.status')),
      ],
      colWidths: [8, 25, 12, 12, 10, 10, 24, 10],
      wordWrap: true,
      style: {
        head: [],
        border: [],
      },
    })

    // 按 996 指数降序排序
    const sortedRecords = [...filteredRecords].sort((a, b) => {
      if (a.status === 'failed' && b.status === 'success') return 1
      if (a.status === 'success' && b.status === 'failed') return -1
      if (a.status === 'failed' && b.status === 'failed') return 0
      return b.result.index996 - a.result.index996
    })

    sortedRecords.forEach((record, index) => {
      if (record.status === 'success') {
        const indexValue = record.result.index996.toFixed(1)
        const indexColor = this.getIndexColor(record.result.index996)
        const timeRange = this.formatTimeRange(record.data.firstCommitDate, record.data.lastCommitDate)
        const contributors = record.data.contributors !== undefined ? record.data.contributors.toString() : '-'

        table.push([
          (index + 1).toString(),
          this.truncateName(record.repo.name, 30),
          indexColor(indexValue),
          `${record.result.overTimeRadio.toFixed(1)}%`,
          record.data.totalCommits.toString(),
          contributors,
          timeRange,
          chalk.green('✓'),
        ])
      } else {
        table.push([
          (index + 1).toString(),
          this.truncateName(record.repo.name, 30),
          chalk.gray('-'),
          chalk.gray('-'),
          chalk.gray('-'),
          chalk.gray('-'),
          chalk.gray('-'),
          chalk.red('✗'),
        ])
      }
    })

    console.log(table.toString())
    console.log()

    // 统计信息
    const successCount = filteredRecords.filter((r) => r.status === 'success').length
    const failedCount = filteredRecords.length - successCount
    const filteredOutCount = records.length - filteredRecords.length

    console.log(chalk.blue(t('multi.comparison.stats')))
    console.log(`  ${t('multi.comparison.success', { count: chalk.green(successCount) })}`)
    if (failedCount > 0) {
      console.log(`  ${t('multi.comparison.failed', { count: chalk.red(failedCount) })}`)
    }
    if (filteredOutCount > 0) {
      console.log(`  ${t('multi.comparison.filtered', { count: chalk.gray(filteredOutCount) })}`)
    }

    // 找出加班最严重和最轻松的仓库
    const successfulRecords = filteredRecords.filter((r) => r.status === 'success')
    if (successfulRecords.length > 1) {
      const maxRecord = successfulRecords.reduce((max, r) => (r.result.index996 > max.result.index996 ? r : max))
      const minRecord = successfulRecords.reduce((min, r) => (r.result.index996 < min.result.index996 ? r : min))

      console.log()
      console.log(
        `  ${t('multi.comparison.max', {
          name: chalk.red(maxRecord.repo.name),
          index: maxRecord.result.index996.toFixed(1),
        })}`
      )
      console.log(
        `  ${t('multi.comparison.min', {
          name: chalk.green(minRecord.repo.name),
          index: minRecord.result.index996.toFixed(1),
        })}`
      )
    }

    console.log()
  }

  /**
   * 根据 996 指数选择颜色
   */
  private static getIndexColor(index: number): (text: string) => string {
    if (index < 50) {
      return chalk.green
    } else if (index < 75) {
      return chalk.yellow
    } else if (index < 100) {
      return chalk.hex('#FF8C00') // 橙色
    } else {
      return chalk.red
    }
  }

  /**
   * 截断项目名称
   */
  private static truncateName(name: string, maxLength: number): string {
    if (name.length <= maxLength) {
      return name
    }
    return name.substring(0, maxLength - 3) + '...'
  }

  /**
   * 格式化时间范围
   */
  private static formatTimeRange(firstDate?: string, lastDate?: string): string {
    if (!firstDate && !lastDate) {
      return '-'
    }
    if (!firstDate) {
      return t('multi.comparison.until', { date: lastDate || '' })
    }
    if (!lastDate) {
      return t('multi.comparison.sinceToday', { date: firstDate })
    }

    // 如果是同一天，只显示一个日期
    if (firstDate === lastDate) {
      return firstDate
    }

    return `${firstDate}~${lastDate}`
  }
}
