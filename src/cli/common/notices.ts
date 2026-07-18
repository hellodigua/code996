import chalk from 'chalk'
import { t } from '../../i18n'

/** 输出全局提示信息 */
export function printGlobalNotices(): void {
  console.log()
  console.log(chalk.cyan.bold(`ℹ️  ${t('notices.title')}`))
  console.log()
  console.log(`  ● ${t('notices.privacy')}`)
  console.log(`  ● ${t('notices.limit')}`)
  console.log(`  ● ${chalk.bold(t('notices.usage'))}`)
  console.log(`  ● ${chalk.bold(t('notices.web'))}`)
  console.log(`  ● ${t('notices.help')}`)
  console.log()
  console.log(`  ${t('notices.github')} ${chalk.cyan.bold('https://github.com/hellodigua/code996')}`)
  console.log()
}
