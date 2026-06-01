import * as fs from 'fs'
import { AnalyzeOptions, StructuredOutput } from '../../types/git-types'
import { buildMarkdown } from './md-formatter'

function defaultFileName(ext: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `code996-report-${date}.${ext}`
}

export async function writeStructuredOutput(payload: StructuredOutput, options: AnalyzeOptions): Promise<void> {
  const isJson = !!options.json
  const content = isJson ? JSON.stringify(payload, null, 2) : buildMarkdown(payload)

  // options.output 可能为 undefined（未传 --output）、true（传了但无值）或路径字符串
  if (options.output !== undefined) {
    const ext = isJson ? 'json' : 'md'
    const filePath = typeof options.output === 'string' && options.output ? options.output : defaultFileName(ext)
    await fs.promises.writeFile(filePath, content, 'utf8')
    process.stderr.write(`✓ 已保存到 ${filePath}\n`)
  } else {
    process.stdout.write(content + '\n')
  }
}
