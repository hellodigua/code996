import chalk from 'chalk'
import Table from 'cli-table3'
import { AuthorGroup, MergeResult } from '../../../core/author-merger'

export class MergePrinter {
  /**
   * 打印作者合并分析结果
   */
  public static printMergeAnalysis(result: MergeResult, showAll: boolean = false): void {
    const { groups, stats } = result

    // 1. 打印统计摘要
    this.printStats(stats)

    // 2. 打印需要合并的作者组
    const groupsToShow = showAll ? groups : groups.filter((g: AuthorGroup) => g.needsMerge)

    if (groupsToShow.length === 0) {
      console.log(chalk.green('\n✓ 所有作者身份唯一,无需合并'))
      return
    }

    console.log(chalk.yellow(`\n发现 ${groupsToShow.length} 个作者存在多个邮箱:\n`))

    for (const group of groupsToShow) {
      this.printAuthorGroup(group)
    }
  }

  /**
   * 打印统计摘要
   */
  private static printStats(stats: { totalAuthors: number; uniqueNames: number; needsMerge: number }): void {
    const table = new Table({
      head: [chalk.cyan('统计项'), chalk.cyan('数值')],
      colWidths: [30, 15],
    })

    table.push(
      ['总身份数（名称+邮箱组合）', stats.totalAuthors],
      ['唯一作者名称数', stats.uniqueNames],
      ['需要合并的作者数', chalk.yellow(stats.needsMerge.toString())]
    )

    console.log(table.toString())
  }

  /**
   * 打印单个作者组
   */
  private static printAuthorGroup(group: AuthorGroup): void {
    console.log(chalk.bold.white(`📦 ${group.primaryName}`))
    console.log(chalk.gray(`   总提交数: ${group.totalCommits}`))

    const table = new Table({
      head: [chalk.cyan('名称'), chalk.cyan('邮箱'), chalk.cyan('提交数')],
      colWidths: [25, 35, 12],
      style: {
        head: [],
        border: ['gray'],
      },
    })

    for (const identity of group.identities) {
      const isPrimary = identity === group.identities[0]
      const nameDisplay = isPrimary ? chalk.green(`${identity.name} (主)`) : identity.name
      const emailDisplay = isPrimary ? chalk.green(identity.email) : chalk.gray(identity.email)

      table.push([nameDisplay, emailDisplay, (identity.commitCount || 0).toString()])
    }

    console.log(table.toString())
    console.log() // 空行
  }

  /**
   * 打印 .mailmap 内容预览
   */
  public static printMailmapPreview(mailmapContent: string): void {
    console.log(chalk.bold.cyan('\n📄 .mailmap 文件内容预览:'))
    console.log(chalk.gray('─'.repeat(80)))

    const lines = mailmapContent.split('\n')
    for (const line of lines) {
      if (line.startsWith('#')) {
        console.log(chalk.gray(line))
      } else if (line.trim()) {
        console.log(chalk.white(line))
      } else {
        console.log()
      }
    }

    console.log(chalk.gray('─'.repeat(80)))
  }

  /**
   * 打印应用建议
   */
  public static printApplyInstructions(repoPath: string, hasMailmap: boolean): void {
    console.log(chalk.bold.yellow('\n💡 应用建议:'))

    if (hasMailmap) {
      console.log(chalk.yellow(`  仓库已存在 .mailmap 文件,使用 --force 强制覆盖`))
    }

    console.log(chalk.white('  1. 预览合并结果:'))
    console.log(chalk.cyan(`     code996 merge "${repoPath}"`))

    console.log(chalk.white('\n  2. 生成 .mailmap 文件:'))
    console.log(chalk.cyan(`     code996 merge "${repoPath}" --apply`))

    console.log(chalk.white('\n  3. 验证效果 (Git 会自动使用 .mailmap):'))
    console.log(chalk.cyan(`     git shortlog -sn`))
    console.log(chalk.cyan(`     code996 ranking "${repoPath}"`))

    console.log(chalk.gray('\n  提示: .mailmap 是 Git 标准功能,不会影响历史记录'))
  }

  /**
   * 打印成功消息
   */
  public static printSuccess(path: string): void {
    console.log(chalk.green(`\n✓ 已成功写入 ${path}`))
    console.log(chalk.gray('  Git 将自动应用此映射规则到所有统计命令'))
  }

  /**
   * 打印警告消息
   */
  public static printWarning(message: string): void {
    console.log(chalk.yellow(`\n⚠️  ${message}`))
  }

  /**
   * 打印错误消息
   */
  public static printError(message: string): void {
    console.log(chalk.red(`\n❌ ${message}`))
  }
}
