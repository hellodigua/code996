import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function fail(message) {
  throw new Error(message)
}

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = capture ? (result.stderr || result.stdout || '').trim() : ''
    fail(`${command} ${args.join(' ')} 执行失败${detail ? `：${detail}` : ''}`)
  }

  return capture ? result.stdout : ''
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readHeadJson(relativePath) {
  return JSON.parse(run('git', ['show', `HEAD:${relativePath}`], { capture: true }))
}

export function parseStableVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version)
  if (!match) fail(`版本号必须是稳定版 SemVer（例如 1.2.3），当前为：${version}`)
  return match.slice(1).map(Number)
}

export function compareStableVersions(left, right) {
  const leftParts = parseStableVersion(left)
  const rightParts = parseStableVersion(right)
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1
  }
  return 0
}

export function assertOnlyPackageVersionChanged(originalPackage, currentPackage) {
  parseStableVersion(currentPackage.version)
  if (originalPackage.version === currentPackage.version) fail('package.json 的 version 尚未修改')

  const normalizedCurrent = { ...currentPackage, version: originalPackage.version }
  if (!isDeepStrictEqual(originalPackage, normalizedCurrent)) {
    fail('运行 release 前，package.json 只能修改 version 字段')
  }

  return currentPackage.version
}

export function syncPackageLockVersion(packageLock, version) {
  if (!packageLock.packages?.['']) fail('package-lock.json 缺少根包信息')
  return {
    ...packageLock,
    version,
    packages: {
      ...packageLock.packages,
      '': {
        ...packageLock.packages[''],
        version,
      },
    },
  }
}

export function parsePorcelainStatus(output) {
  return output
    .split('\0')
    .filter(Boolean)
    .map((entry) => ({ status: entry.slice(0, 2), path: entry.slice(3) }))
}

export function matchesChangedFiles(actualPaths, requiredPaths, optionalPaths = []) {
  return (
    requiredPaths.every((filePath) => actualPaths.includes(filePath)) &&
    actualPaths.every((filePath) => requiredPaths.includes(filePath) || optionalPaths.includes(filePath))
  )
}

function assertChangedFiles(requiredPaths, optionalPaths = []) {
  const entries = parsePorcelainStatus(
    run('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
      capture: true,
    })
  )
  const actualPaths = entries.map((entry) => entry.path).sort()
  if (!matchesChangedFiles(actualPaths, requiredPaths, optionalPaths)) {
    const allowedPaths = [...requiredPaths, ...optionalPaths].sort()
    fail(
      `工作区必须包含 ${requiredPaths.join('、')}，且只允许这些版本变更：${allowedPaths.join('、')}；当前为：${actualPaths.join('、') || '无变更'}`
    )
  }
}

function assertReleaseBranchIsCurrent() {
  const branch = run('git', ['branch', '--show-current'], { capture: true }).trim()
  if (branch !== 'main') fail(`只能从 main 分支发版，当前分支为：${branch || 'detached HEAD'}`)

  const upstream = run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], {
    capture: true,
  }).trim()
  if (upstream !== 'origin/main') fail(`main 必须跟踪 origin/main，当前上游为：${upstream}`)

  run('git', ['fetch', 'origin', 'main', '--tags'])
  const head = run('git', ['rev-parse', 'HEAD'], { capture: true }).trim()
  const remoteMain = run('git', ['rev-parse', 'origin/main'], { capture: true }).trim()
  if (head !== remoteMain) fail('本地 main 与 origin/main 不一致，请先同步远端代码')
}

function getLatestStableTagVersion() {
  const versions = run('git', ['tag', '--list', 'v*'], { capture: true })
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
    .map((tag) => tag.slice(1))
    .sort((left, right) => compareStableVersions(right, left))

  return versions[0]
}

function assertTagIsAvailable(version) {
  const tag = `v${version}`
  const exists = run('git', ['tag', '--list', tag], { capture: true }).trim()
  if (exists) fail(`Tag ${tag} 已存在`)
}

function assertPackageLockVersionOnlyChanged(originalLock, currentLock, oldVersion, newVersion) {
  if (originalLock.version !== oldVersion || originalLock.packages?.['']?.version !== oldVersion) {
    fail('package-lock.json 的版本与发版前 package.json 不一致')
  }
  const expectedLock = syncPackageLockVersion(originalLock, newVersion)
  if (!isDeepStrictEqual(expectedLock, currentLock)) fail('package-lock.json 出现了版本号之外的变化')
}

async function main() {
  console.log('🚀 code996 发版预检')
  assertReleaseBranchIsCurrent()
  // 上次检查中断时 package-lock.json 可能已经同步，允许直接重试。
  assertChangedFiles(['package.json'], ['package-lock.json'])

  const packagePath = path.join(repoRoot, 'package.json')
  const packageLockPath = path.join(repoRoot, 'package-lock.json')
  const originalPackage = readHeadJson('package.json')
  const currentPackage = readJson(packagePath)
  const version = assertOnlyPackageVersionChanged(originalPackage, currentPackage)
  const tag = `v${version}`

  if (compareStableVersions(version, originalPackage.version) <= 0) {
    fail(`新版本 ${version} 必须高于当前版本 ${originalPackage.version}`)
  }
  const latestTagVersion = getLatestStableTagVersion()
  if (latestTagVersion && compareStableVersions(version, latestTagVersion) <= 0) {
    fail(`新版本 ${version} 必须高于最新 Tag v${latestTagVersion}`)
  }
  assertTagIsAvailable(version)

  const originalLock = readHeadJson('package-lock.json')
  const syncedLock = syncPackageLockVersion(readJson(packageLockPath), version)
  fs.writeFileSync(packageLockPath, `${JSON.stringify(syncedLock, null, 2)}\n`)
  assertPackageLockVersionOnlyChanged(originalLock, syncedLock, originalPackage.version, version)
  assertChangedFiles(['package-lock.json', 'package.json'])

  console.log(`\n📦 准备发布 ${tag}，开始执行本地质量检查（不会发布 npm）\n`)
  run(npmCommand, ['run', 'format:check'])
  run(npmCommand, ['test'])
  run(npmCommand, ['run', 'build'])
  run('git', ['--no-pager', 'diff', '--check'])
  assertChangedFiles(['package-lock.json', 'package.json'])

  console.log(`\n✅ 质量检查全部通过，自动创建 release commit 和 ${tag}\n`)
  run('git', ['add', 'package.json', 'package-lock.json'])
  run('git', ['commit', '-m', `release: ${tag}`])
  run('git', ['tag', '-a', tag, '-m', tag])

  try {
    run('git', ['push', '--atomic', 'origin', 'main', `refs/tags/${tag}`])
  } catch (error) {
    console.error(`\n本地 release commit 和 ${tag} 已创建，但原子推送失败。修复网络或权限后执行：`)
    console.error(`git push --atomic origin main refs/tags/${tag}`)
    throw error
  }

  console.log(`\n🎉 ${tag} 已推送，GitHub Actions 将继续发布 npm 包并创建 GitHub Release。`)
  console.log('https://github.com/hellodigua/code996/actions/workflows/release.yml')
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(`\n❌ 发版失败：${error.message}`)
    process.exitCode = 1
  })
}
