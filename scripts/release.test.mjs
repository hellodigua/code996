import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertOnlyPackageVersionChanged,
  compareStableVersions,
  parsePorcelainStatus,
  parseStableVersion,
  syncPackageLockVersion,
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

test('解析 git porcelain 的暂存、未暂存和未跟踪文件', () => {
  assert.deepEqual(parsePorcelainStatus(' M package.json\0M  package-lock.json\0?? note.md\0'), [
    { status: ' M', path: 'package.json' },
    { status: 'M ', path: 'package-lock.json' },
    { status: '??', path: 'note.md' },
  ])
})
