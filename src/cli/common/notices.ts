import chalk from 'chalk'

/** 输出全局提示信息 */
export function printGlobalNotices(): void {
  console.log()
  console.log(chalk.blue('ℹ️ 使用提示:'))
  console.log()
  console.log('  ● 数据分析：脚本统计的是项目整体的 Git 提交时间，所有分析均在本地进行处理。')
  console.log(
    '  ● 分析准确性：除了编程，大部分开发的实际工作还包括开会、学习、维护文档、调试自测等其他事务，因此本报告无法覆盖全部的实际工作时间，不保证分析准确性，请谨慎参考。'
  )
  console.log(`  ● 使用限制：${chalk.bold('本项目分析结果仅供个人参考，请勿用于 “作恶”')}。`)
  console.log('  ● 命令说明：使用 code996 help 查看更多命令。')
  console.log()
  console.log('  其他说明请参考原始 README：https://github.com/hellodigua/code996，这里不再赘述')
  console.log()
}
