import { spawn } from 'child_process'
import { GitLogOptions } from '../../types/git-types'

/**
 * 基础Git命令执行器
 * 提供Git命令执行、仓库验证和通用过滤功能
 */
export class BaseCollector {
  /**
   * 执行git命令并返回输出
   */
  protected async execGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // 确保路径是绝对路径
      const absolutePath = require('path').resolve(cwd)

      const child = spawn('git', args, {
        cwd: absolutePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_DIR: `${absolutePath}/.git`,
          GIT_WORK_TREE: absolutePath,
        },
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Git命令执行失败 (退出码: ${code}): ${stderr}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`无法执行git命令: ${err.message}`))
      })
    })
  }

  /**
   * 检查是否为有效的Git仓库
   */
  async isValidGitRepo(path: string): Promise<boolean> {
    try {
      await this.execGitCommand(['status'], path)
      return true
    } catch {
      return false
    }
  }

  /**
   * 为 git 命令附加通用过滤条件（时间范围、作者包含、消息排除）
   */
  protected applyCommonFilters(args: string[], options: GitLogOptions): void {
    // 默认忽略合并提交
    args.push('--no-merges')

    if (options.since) {
      args.push(`--since=${options.since}`)
    }
    if (options.until) {
      args.push(`--until=${options.until}`)
    }
    if (options.authorPattern) {
      args.push('--regexp-ignore-case')
      args.push('--extended-regexp')
      args.push(`--author=${options.authorPattern}`)
    }
    // 排除特定提交消息（使用 Git 原生的 --grep + --invert-grep）
    if (options.ignoreMsg) {
      args.push('--regexp-ignore-case')
      args.push('--extended-regexp')
      args.push(`--grep=${options.ignoreMsg}`)
      args.push('--invert-grep')
    }
  }

  /**
   * 解析 format-local 输出的时间戳，提取日期和小时信息
   */
  protected parseLocalTimestamp(timestamp: string): { dateKey: string; hour: number; minute: number } | null {
    const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
    if (!match) {
      return null
    }

    const [, year, month, day, hourStr, minuteStr] = match
    const hour = parseInt(hourStr, 10)
    const minute = parseInt(minuteStr, 10)

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return null
    }

    return {
      dateKey: `${year}-${month}-${day}`,
      hour,
      minute,
    }
  }

  /**
   * 读取 git config 配置项（不存在时返回 null）
   */
  private async getGitConfigValue(key: string, path: string): Promise<string | null> {
    try {
      const value = await this.execGitCommand(['config', '--get', key], path)
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    } catch {
      return null
    }
  }

  /**
   * 转义正则特殊字符，构造安全的 --author 匹配模式
   */
  private escapeAuthorPattern(source: string): string {
    return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 根据 CLI 选项解析作者身份，生成正则用于 git --author 过滤
   */
  async resolveSelfAuthor(path: string): Promise<{ pattern: string; displayLabel: string }> {
    const email = await this.getGitConfigValue('user.email', path)
    const name = await this.getGitConfigValue('user.name', path)

    if (!email && !name) {
      throw new Error('启用 --self 需要先配置 git config user.name 或 user.email')
    }

    const hasEmail = Boolean(email)
    const hasName = Boolean(name)

    const displayLabel = hasEmail && hasName ? `${name} <${email}>` : email || name || '未知用户'

    const pattern = hasEmail ? this.escapeAuthorPattern(email!) : this.escapeAuthorPattern(name!)

    return {
      pattern,
      displayLabel,
    }
  }

  /**
   * 检查作者是否应该被排除（用于后处理过滤）
   * @param authorLine git log 输出的作者行，格式: "Author Name <email@example.com>"
   * @param ignorePattern 排除作者的正则表达式
   * @returns true 表示应该排除，false 表示保留
   */
  protected shouldIgnoreAuthor(authorLine: string, ignorePattern?: string): boolean {
    if (!ignorePattern) {
      return false
    }

    try {
      const regex = new RegExp(ignorePattern, 'i') // 不区分大小写
      return regex.test(authorLine)
    } catch (error) {
      // 如果正则表达式无效，打印警告并不排除
      console.warn(`警告: 无效的作者排除正则表达式 "${ignorePattern}": ${(error as Error).message}`)
      return false
    }
  }
}
