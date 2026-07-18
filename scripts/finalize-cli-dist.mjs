import { chmod, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliEntry = path.join(projectRoot, 'dist', 'index.js')

// npm link 在 Unix 上直接链接 bin 目标，因此构建后必须恢复 CLI 入口的可执行位。
if (path.dirname(cliEntry) !== path.join(projectRoot, 'dist') || path.basename(cliEntry) !== 'index.js') {
  throw new Error(`Refusing to update unexpected CLI entry: ${cliEntry}`)
}

await stat(cliEntry)
await chmod(cliEntry, 0o755)
