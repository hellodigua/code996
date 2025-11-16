import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { RepoInfo } from '../types/git-types'

/**
 * 需要忽略的目录列表
 */
const IGNORED_DIRS = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'build', '.cache', 'coverage'])

/**
 * 仓库扫描器
 * 用于扫描目录中的所有 Git 仓库
 */
export class RepoScanner {
  /**
   * 扫描多个目录，返回所有找到的 Git 仓库
   * @param dirs 要扫描的目录列表
   * @returns 去重后的仓库列表
   */
  static async scan(dirs: string[]): Promise<RepoInfo[]> {
    const results: RepoInfo[] = []
    const seen = new Set<string>() // 用于去重

    for (const dir of dirs) {
      const absoluteDir = path.resolve(dir)
      const repos = await this.scanSingleDir(absoluteDir)

      repos.forEach((repo) => {
        if (!seen.has(repo.path)) {
          seen.add(repo.path)
          results.push(repo)
        }
      })
    }

    return results
  }

  /**
   * 扫描指定目录的直接子目录，查找 Git 仓库
   * @param baseDir 基础目录
   * @returns 找到的仓库列表
   */
  static async scanSubdirectories(baseDir: string): Promise<RepoInfo[]> {
    let entries: fs.Dirent[] = []

    try {
      entries = await fs.promises.readdir(baseDir, { withFileTypes: true })
    } catch {
      return []
    }

    const childDirs = entries
      .filter((entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name))
      .map((entry) => path.join(baseDir, entry.name))

    if (childDirs.length === 0) {
      return []
    }

    return this.scan(childDirs)
  }

  /**
   * 扫描单个目录及其子目录（一层）
   * @param baseDir 要扫描的目录
   * @returns 找到的仓库列表
   */
  private static async scanSingleDir(baseDir: string): Promise<RepoInfo[]> {
    // 检查目录是否存在且为目录
    try {
      const stat = await fs.promises.stat(baseDir)
      if (!stat.isDirectory()) {
        return []
      }
    } catch {
      return []
    }

    const directRepos: RepoInfo[] = []

    // 检查当前目录是否就是一个 Git 仓库
    if (await this.isGitRepo(baseDir)) {
      directRepos.push({
        name: path.basename(baseDir),
        path: await this.resolveGitRoot(baseDir),
      })
    }

    // 扫描一层子目录
    let entries: fs.Dirent[] = []
    try {
      entries = await fs.promises.readdir(baseDir, { withFileTypes: true })
    } catch {
      return directRepos
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      if (IGNORED_DIRS.has(entry.name)) {
        continue
      }

      const childPath = path.join(baseDir, entry.name)
      if (await this.isGitRepo(childPath)) {
        directRepos.push({
          name: entry.name,
          path: await this.resolveGitRoot(childPath),
        })
      }
    }

    return directRepos
  }

  /**
   * 检查目录是否为 Git 仓库
   */
  private static async isGitRepo(dir: string): Promise<boolean> {
    try {
      // 方法1：检查 .git 目录
      await fs.promises.access(path.join(dir, '.git'))
      return true
    } catch {
      // 方法2：使用 git 命令检查
      try {
        execSync('git rev-parse --is-inside-work-tree', { cwd: dir, stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    }
  }

  /**
   * 解析 Git 仓库的根目录
   */
  private static async resolveGitRoot(dir: string): Promise<string> {
    try {
      const root = execSync('git rev-parse --show-toplevel', { cwd: dir, stdio: 'pipe' }).toString().trim()
      return fs.realpathSync(root)
    } catch {
      return fs.realpathSync(dir)
    }
  }
}

