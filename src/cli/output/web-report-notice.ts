import chalk from 'chalk'
import { t } from '../../i18n'
import { printGlobalNotices } from '../common/notices'
import type { LocalWebReportResult } from './web-report-writer'

/** 在全部终端内容结束后，统一输出本地 Web 报告的生成结果。 */
export function printLocalWebReportResult(webReport?: LocalWebReportResult): void {
  if (!webReport) return

  const messageKey = webReport.opened ? 'analyze.web.opened' : 'analyze.web.saved'
  console.log(`🌐 ${t(messageKey, { path: chalk.cyanBright.bold(webReport.indexPath) })}`)

  if (webReport.storageFallback) {
    console.log(chalk.yellow(t('analyze.web.storageFallback', { message: webReport.storageFallback.message })))
  }
  if (webReport.openError) {
    console.log(chalk.yellow(t('analyze.web.openFailed', { message: webReport.openError.message })))
  }
}

/** 保证使用提示在前，本地报告结果始终作为整次分析的收尾信息。 */
export function printAnalysisFooter(includeGlobalNotices: boolean, webReport?: LocalWebReportResult): void {
  if (includeGlobalNotices) printGlobalNotices()
  printLocalWebReportResult(webReport)
}
