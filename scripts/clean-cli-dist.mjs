import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = path.join(projectRoot, 'dist')

// 只清理当前项目 dist 下的 CLI 产物；Web 由 Vite 自己清理，避免 build:cli 单独运行时误删它。
if (path.dirname(distDirectory) !== projectRoot || path.basename(distDirectory) !== 'dist') {
  throw new Error(`Refusing to clean unexpected directory: ${distDirectory}`)
}

let entries = []
try {
  entries = await readdir(distDirectory, { withFileTypes: true })
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

await Promise.all(
  entries
    .filter((entry) => entry.name !== 'web')
    .map((entry) => rm(path.join(distDirectory, entry.name), { recursive: true }))
)
