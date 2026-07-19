import chalk from 'chalk'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { t } from '../../i18n'
import type { LocalWebReportResult } from './web-report-writer'
import { openLocalFile } from './web-report-writer'

export type WebReportOpenPreference = 'ask' | 'always' | 'never'

export interface WebReportOpenChoice {
  open: boolean
  remember?: Exclude<WebReportOpenPreference, 'ask'>
}

interface WebReportOpenDependencies {
  isInteractive?: boolean
  openFile?: (filePath: string) => Promise<void>
  prompt?: () => Promise<WebReportOpenChoice | undefined>
  readPreference?: () => WebReportOpenPreference
  writePreference?: (preference: Exclude<WebReportOpenPreference, 'ask'>) => void
}

interface Code996Config {
  openWebReport?: Exclude<WebReportOpenPreference, 'ask'>
}

export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDirectory = os.homedir()
): string {
  const baseDirectory =
    platform === 'win32'
      ? env.APPDATA || path.join(homeDirectory, 'AppData', 'Roaming')
      : env.XDG_CONFIG_HOME || path.join(homeDirectory, '.config')

  return path.join(baseDirectory, 'code996', 'config.json')
}

export function readWebReportOpenPreference(configPath = resolveConfigPath()): WebReportOpenPreference {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Code996Config
    return config.openWebReport === 'always' || config.openWebReport === 'never' ? config.openWebReport : 'ask'
  } catch {
    return 'ask'
  }
}

export function writeWebReportOpenPreference(
  preference: Exclude<WebReportOpenPreference, 'ask'>,
  configPath = resolveConfigPath()
): void {
  let config: Code996Config = {}
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Code996Config
  } catch {
    // 配置不存在或损坏时，从可用的最小配置重新开始。
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, `${JSON.stringify({ ...config, openWebReport: preference }, null, 2)}\n`, 'utf8')
}

export function resetCode996Config(configPath = resolveConfigPath()): void {
  fs.rmSync(configPath, { force: true })
}

export async function promptWebReportOpen(): Promise<WebReportOpenChoice | undefined> {
  const { default: select } = await import('@inquirer/select')
  try {
    return await select<WebReportOpenChoice>({
      message: t('prompt.webReportOpen.question'),
      choices: [
        { name: `${t('prompt.webReportOpen.onceYes')} ${chalk.gray(t('prompt.default'))}`, value: { open: true } },
        { name: t('prompt.webReportOpen.onceNo'), value: { open: false } },
        { name: t('prompt.webReportOpen.always'), value: { open: true, remember: 'always' } },
        { name: t('prompt.webReportOpen.never'), value: { open: false, remember: 'never' } },
      ],
      pageSize: 4,
    })
  } catch {
    return undefined
  }
}

/** 根据显式参数、持久偏好和 TTY 状态决定是否打开已生成报告。 */
export async function handleWebReportOpen(
  webReport: LocalWebReportResult | undefined,
  explicitOpen: boolean | undefined,
  dependencies: WebReportOpenDependencies = {}
): Promise<void> {
  if (!webReport || webReport.opened || webReport.openError || explicitOpen !== undefined) return

  const isInteractive = dependencies.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
  if (!isInteractive) return

  const preference = (dependencies.readPreference ?? readWebReportOpenPreference)()
  let choice: WebReportOpenChoice | undefined

  if (preference === 'always') {
    choice = { open: true }
  } else if (preference === 'never') {
    choice = { open: false }
  } else {
    choice = await (dependencies.prompt ?? promptWebReportOpen)()
  }

  if (!choice) return
  if (choice.remember) {
    const writePreference = dependencies.writePreference ?? writeWebReportOpenPreference
    try {
      writePreference(choice.remember)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(chalk.yellow(t('prompt.webReportOpen.saveFailed', { message })))
    }
  }
  if (!choice.open) return

  try {
    await (dependencies.openFile ?? openLocalFile)(webReport.indexPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(chalk.yellow(t('analyze.web.openFailed', { message })))
  }
}
