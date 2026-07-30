import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  assertOnlyPackageVersionChanged,
  assertSkillCliVersionMatchesPackage,
  assertSkillVersionOnlyChanged,
  compareStableVersions,
  matchesChangedFiles,
  parsePorcelainStatus,
  parseStableVersion,
  syncPackageLockVersion,
  syncSkillCliVersion,
} from './release.mjs'

test('只接受稳定版 SemVer，并正确比较版本', () => {
  assert.deepEqual(parseStableVersion('1.2.3'), [1, 2, 3])
  assert.equal(compareStableVersions('1.10.0', '1.9.9'), 1)
  assert.equal(compareStableVersions('2.0.0', '2.0.0'), 0)
  assert.throws(() => parseStableVersion('v1.2.3'), /稳定版 SemVer/)
  assert.throws(() => parseStableVersion('1.2.3-beta.1'), /稳定版 SemVer/)
})

test('package.json 只允许 version 字段发生变化', () => {
  const original = { name: 'code996', version: '1.1.1', scripts: { test: 'jest' } }
  const current = { ...original, version: '1.2.0' }
  assert.equal(assertOnlyPackageVersionChanged(original, current), '1.2.0')
  assert.throws(() => assertOnlyPackageVersionChanged(original, { ...current, name: 'changed' }), /只能修改 version/)
  assert.throws(() => assertOnlyPackageVersionChanged(original, original), /尚未修改/)
})

test('只同步 package-lock 根版本，不改动依赖内容', () => {
  const original = {
    name: 'code996',
    version: '1.1.1',
    packages: { '': { name: 'code996', version: '1.1.1' }, 'node_modules/demo': { version: '4.0.0' } },
  }
  const synced = syncPackageLockVersion(original, '1.2.0')

  assert.equal(synced.version, '1.2.0')
  assert.equal(synced.packages[''].version, '1.2.0')
  assert.equal(synced.packages['node_modules/demo'].version, '4.0.0')
  assert.equal(original.version, '1.1.1')
})

test('同步 Skill 中所有固定的 CLI 版本', () => {
  const original = '使用 code996@1.1.1\n后备命令 code996@1.1.1 --json\n'
  const expected = '使用 code996@1.2.0\n后备命令 code996@1.2.0 --json\n'

  assert.equal(syncSkillCliVersion(original, '1.1.1', '1.2.0'), expected)
  assert.equal(assertSkillVersionOnlyChanged(original, original, '1.1.1', '1.2.0'), expected)
  assert.equal(assertSkillVersionOnlyChanged(original, expected, '1.1.1', '1.2.0'), expected)
  assert.throws(
    () => assertSkillVersionOnlyChanged(original, `${expected}其他改动\n`, '1.1.1', '1.2.0'),
    /只能包含脚本自动同步/
  )
  assert.throws(() => syncSkillCliVersion('没有固定版本', '1.1.1', '1.2.0'), /未找到固定/)
  assert.throws(() => syncSkillCliVersion('code996@1.0.0', '1.1.1', '1.2.0'), /必须全部为 1.1.1/)
})

test('仓库中的 Skill CLI 版本与 package.json 一致', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const skill = fs.readFileSync(new URL('../skills/code996/SKILL.md', import.meta.url), 'utf8')

  assert.ok(assertSkillCliVersionMatchesPackage(skill, packageJson.version) > 0)
})

test('解析 git porcelain 的暂存、未暂存和未跟踪文件', () => {
  assert.deepEqual(parsePorcelainStatus(' M package.json\0M  package-lock.json\0?? note.md\0'), [
    { status: ' M', path: 'package.json' },
    { status: 'M ', path: 'package-lock.json' },
    { status: '??', path: 'note.md' },
  ])
})

test('仅允许版本文件，并支持同步 lock 和 Skill 后重试', () => {
  const optionalPaths = ['package-lock.json', 'skills/code996/SKILL.md']
  assert.equal(matchesChangedFiles(['package.json'], ['package.json'], optionalPaths), true)
  assert.equal(matchesChangedFiles(['package-lock.json', 'package.json'], ['package.json'], optionalPaths), true)
  assert.equal(
    matchesChangedFiles(
      ['package-lock.json', 'package.json', 'skills/code996/SKILL.md'],
      ['package.json'],
      optionalPaths
    ),
    true
  )
  assert.equal(matchesChangedFiles(['package.json', 'README.md'], ['package.json'], optionalPaths), false)
})
