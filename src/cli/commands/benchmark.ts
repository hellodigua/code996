import { promises as fs } from 'fs'
import path from 'path'
import chalk from 'chalk'
import { buildAnonymousBenchmark } from '../../benchmark/benchmark-builder'
import { AnonymousBenchmarkBundle, BenchmarkOptions } from '../../benchmark/benchmark-types'
import { t } from '../../i18n'

export class BenchmarkExecutor {
  static async execute(repoPath: string, options: BenchmarkOptions): Promise<string> {
    console.log(chalk.cyan.bold(`🧪 ${t('benchmark.title')}`))
    console.log(chalk.gray(t('benchmark.localOnly')))
    console.log()

    const bundle = await buildAnonymousBenchmark(repoPath, options)
    const outputPath = path.resolve(options.output || defaultBenchmarkFileName(bundle.datasetId))
    await fs.writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })

    printPreview(bundle, outputPath)
    return outputPath
  }
}

function defaultBenchmarkFileName(datasetId: string): string {
  return `code996-benchmark-${datasetId.slice(0, 8)}.json`
}

function printPreview(bundle: AnonymousBenchmarkBundle, outputPath: string): void {
  const automatic = bundle.results.automatic
  const reference = bundle.results.reference

  console.log(chalk.green(`✓ ${t('benchmark.saved', { path: outputPath })}`))
  console.log()
  console.log(chalk.bold(t('benchmark.preview')))
  console.log(`  ${t('benchmark.datasetId')}: ${bundle.datasetId}`)
  console.log(`  ${t('benchmark.sample')}: ${bundle.sample.totalCommits}`)
  console.log(
    `  ${t('benchmark.reference')}: ${formatHour(bundle.labels.referenceWorkTime.startHour)}-${formatHour(
      bundle.labels.referenceWorkTime.endHour
    )}`
  )
  console.log(
    `  ${t('benchmark.automatic')}: ${formatHour(automatic.workTime.startHour)}-${formatHour(
      automatic.workTime.endHour
    )} / ${automatic.result996.index996}`
  )
  console.log(`  ${t('benchmark.referenceIndex')}: ${reference.result996.index996}`)
  console.log()
  console.log(chalk.yellow(`⚠️  ${t('benchmark.review')}`))
  console.log(chalk.gray(t('benchmark.excluded')))
}

function formatHour(hour: number): string {
  const minutes = Math.round(hour * 60)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
