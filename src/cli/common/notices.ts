import chalk from 'chalk'

/** 输出全局提示信息 */
export function printGlobalNotices(): void {
  console.log()
  console.log(chalk.blue('ℹ️  使用提示:'))
  console.log()
  console.log('  ● 隐私保护：所有对 Git 数据的分析均在本地进行，不会上传任何结果或日志。')
  console.log(
    '  ● 分析局限性：工具仅统计 git log 中的 commit 时间。然而，实际工作还还包括开会、学习、维护文档、调试自测等活动。因此，报告无法覆盖全部的实际工作时间，分析结果准确性有限，请谨慎参考。'
  )
  console.log(`  ● 使用限制：${chalk.bold('本项目分析结果仅供个人参考，请勿用于“作恶”或不当用途')}。`)
  console.log('  ● 命令说明：使用 code996 help 查看更多命令。')
  console.log()
  console.log('  其他说明请参考原始 README：https://github.com/hellodigua/code996')
  console.log()
}
