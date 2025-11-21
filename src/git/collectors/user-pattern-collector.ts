import { GitLogOptions, TimeCount } from '../../types/git-types'
import { BaseCollector } from './base-collector'

/**
 * 贡献者信息（用于过滤和排序）
 */
export interface ContributorInfo {
  author: string // 作者名 "Name <email>"
  email: string // 邮箱
  name: string // 姓名
  commits: number // 提交数
}

/**
 * 每日首次/末次提交记录
 */
export interface DailyCommitTime {
  date: string // YYYY-MM-DD
  minutesFromMidnight: number // 距离午夜的分钟数
}

/**
 * 用户工作模式数据（单个用户的原始采集数据）
 */
export interface UserPatternData {
  contributor: ContributorInfo
  timeDistribution: TimeCount[] // 时间分布（24小时）
  dayDistribution: TimeCount[] // 星期分布（1-7）
  dailyFirstCommits: DailyCommitTime[] // 每日首次提交时间（过滤后）
  dailyLatestCommits: DailyCommitTime[] // 每日末次提交时间（过滤后）
}

/**
 * 用户工作模式采集器
 * 负责为每个核心贡献者单独采集时间分布数据
 */
export class UserPatternCollector extends BaseCollector {
  /**
   * 获取所有贡献者列表及其提交数
   */
  async getAllContributors(options: GitLogOptions): Promise<ContributorInfo[]> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|ISO_TIMESTAMP"
    const args = ['log', '--format=%an <%ae>|%ai']
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 统计每个作者的提交数
    const authorCommits = new Map<string, number>()
    const authorInfoMap = new Map<string, { name: string; email: string }>()

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 2) {
        continue
      }

      const author = parts[0]
      const isoTimestamp = parts[1]

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, options.ignoreAuthor)) {
        continue
      }

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      // 提取姓名和邮箱
      const match = author.match(/^(.+?)\s*<(.+?)>$/)
      if (match) {
        const name = match[1].trim()
        const email = match[2].trim()

        // 使用邮箱作为唯一标识
        authorCommits.set(email, (authorCommits.get(email) || 0) + 1)
        if (!authorInfoMap.has(email)) {
          authorInfoMap.set(email, { name, email })
        }
      }
    }

    // 转换为ContributorInfo数组
    const contributors: ContributorInfo[] = []
    for (const [email, commits] of authorCommits.entries()) {
      const info = authorInfoMap.get(email)
      if (info) {
        contributors.push({
          author: `${info.name} <${email}>`,
          email,
          name: info.name,
          commits,
        })
      }
    }

    // 按提交数降序排序
    contributors.sort((a, b) => b.commits - a.commits)

    return contributors
  }

  /**
   * 过滤核心贡献者
   * @param contributors 所有贡献者列表
   * @param minCommits 最小提交数（默认20）
   * @param maxUsers 最大用户数（默认30）
   */
  filterCoreContributors(
    contributors: ContributorInfo[],
    minCommits: number = 20,
    maxUsers: number = 30
  ): ContributorInfo[] {
    return contributors.filter((c) => c.commits >= minCommits).slice(0, maxUsers)
  }

  /**
   * 为单个用户采集时间分布数据（24小时粒度）
   */
  async getUserTimeDistribution(email: string, options: GitLogOptions): Promise<TimeCount[]> {
    const { path } = options

    // 使用 --author 参数过滤特定用户
    // 格式: "HH:MM|ISO_TIMESTAMP"
    const args = ['log', '--format=%cd|%ai', `--date=format-local:%H:%M`, `--author=${email}`]
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 统计24小时分布（聚合到小时）
    const hourCounts = new Map<number, number>()

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 2) {
        continue
      }

      const time = parts[0]
      const isoTimestamp = parts[1]

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      const match = time.trim().match(/^(\d{2}):(\d{2})$/)
      if (match) {
        const hour = parseInt(match[1], 10)
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
      }
    }

    // 转换为TimeCount数组（补全24小时）
    const timeDistribution: TimeCount[] = []
    for (let hour = 0; hour < 24; hour++) {
      timeDistribution.push({
        time: hour.toString().padStart(2, '0'),
        count: hourCounts.get(hour) || 0,
      })
    }

    return timeDistribution
  }

  /**
   * 为单个用户采集星期分布数据
   */
  async getUserDayDistribution(email: string, options: GitLogOptions): Promise<TimeCount[]> {
    const { path } = options

    // 使用 --author 参数过滤特定用户
    // 格式: "D|ISO_TIMESTAMP" (0-6, 周日到周六)
    const args = ['log', '--format=%cd|%ai', `--date=format-local:%w`, `--author=${email}`]
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 统计星期分布
    const dayCounts = new Map<number, number>()

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 2) {
        continue
      }

      const dayStr = parts[0]
      const isoTimestamp = parts[1]

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      const dayW = parseInt(dayStr.trim(), 10)
      if (dayW >= 0 && dayW <= 6) {
        // 转换：%w 的 0(周日) -> 7, 1-6 -> 1-6
        const day = dayW === 0 ? 7 : dayW
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1)
      }
    }

    // 转换为TimeCount数组（补全7天）
    const dayDistribution: TimeCount[] = []
    for (let day = 1; day <= 7; day++) {
      dayDistribution.push({
        time: day.toString(),
        count: dayCounts.get(day) || 0,
      })
    }

    return dayDistribution
  }

  /**
   * 为单个用户采集每日首次提交时间
   * - 仅工作日（周一到周五）
   * - 上班时间范围：08:00-12:00
   * @param monthsBack 时间窗口（月数），默认6个月
   */
  async getUserDailyFirstCommits(email: string, options: GitLogOptions, monthsBack: number = 6): Promise<DailyCommitTime[]> {
    const { path } = options

    // 计算N个月前的日期
    const nMonthsAgo = new Date()
    nMonthsAgo.setMonth(nMonthsAgo.getMonth() - monthsBack)
    const sinceDate = nMonthsAgo.toISOString().split('T')[0]

    // 格式: "YYYY-MM-DD HH:MM|ISO_TIMESTAMP"
    const args = ['log', '--format=%cd|%ai', `--date=format-local:%Y-%m-%d %H:%M`, `--author=${email}`, `--since=${sinceDate}`]
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 按日期分组
    const dailyCommits = new Map<string, number[]>()

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 2) {
        continue
      }

      const timestamp = parts[0]
      const isoTimestamp = parts[1]

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      const match = timestamp.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/)
      if (match) {
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10)
        const day = parseInt(match[3], 10)
        const hour = parseInt(match[4], 10)
        const minute = parseInt(match[5], 10)

        const date = `${match[1]}-${match[2]}-${match[3]}`

        // 计算星期几（0=周日, 1=周一, ..., 6=周六）
        const dateObj = new Date(year, month - 1, day)
        const dayOfWeek = dateObj.getDay()

        // 排除周末（0=周日，6=周六）
        if (dayOfWeek === 0 || dayOfWeek === 6) continue

        // 上班时间范围：08:00-12:00
        if (hour < 8 || hour >= 12) continue

        const minutesFromMidnight = hour * 60 + minute

        if (!dailyCommits.has(date)) {
          dailyCommits.set(date, [])
        }
        dailyCommits.get(date)!.push(minutesFromMidnight)
      }
    }

    // 找每天的最早时间
    const result: DailyCommitTime[] = []
    for (const [date, minutes] of dailyCommits.entries()) {
      const minMinutes = Math.min(...minutes)
      result.push({ date, minutesFromMidnight: minMinutes })
    }

    return result
  }

  /**
   * 为单个用户采集每日末次提交时间
   * - 仅工作日（周一到周五）
   * - 下班时间范围：16:00-02:00（次日）
   * @param monthsBack 时间窗口（月数），默认6个月
   */
  async getUserDailyLatestCommits(email: string, options: GitLogOptions, monthsBack: number = 6): Promise<DailyCommitTime[]> {
    const { path } = options

    // 计算N个月前的日期
    const nMonthsAgo = new Date()
    nMonthsAgo.setMonth(nMonthsAgo.getMonth() - monthsBack)
    const sinceDate = nMonthsAgo.toISOString().split('T')[0]

    // 格式: "YYYY-MM-DD HH:MM|ISO_TIMESTAMP"
    const args = ['log', '--format=%cd|%ai', `--date=format-local:%Y-%m-%d %H:%M`, `--author=${email}`, `--since=${sinceDate}`]
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    const lines = output.split('\n').filter((line) => line.trim())

    // 按日期分组
    const dailyCommits = new Map<string, number[]>()

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length < 2) {
        continue
      }

      const timestamp = parts[0]
      const isoTimestamp = parts[1]

      // 时区过滤
      if (options.timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch || timezoneMatch[1] !== options.timezone) {
          continue
        }
      }

      const match = timestamp.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/)
      if (match) {
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10)
        const day = parseInt(match[3], 10)
        const hour = parseInt(match[4], 10)
        const minute = parseInt(match[5], 10)

        const date = `${match[1]}-${match[2]}-${match[3]}`

        // 计算星期几（0=周日, 1=周一, ..., 6=周六）
        const dateObj = new Date(year, month - 1, day)
        const dayOfWeek = dateObj.getDay()

        // 排除周末（0=周日，6=周六）
        if (dayOfWeek === 0 || dayOfWeek === 6) continue

        const minutesFromMidnight = hour * 60 + minute

        // 下班时间范围：16:00-02:00（次日凌晨）
        // 16:00 = 960分钟, 02:00 = 120分钟
        if (!(minutesFromMidnight >= 960 || minutesFromMidnight <= 120)) continue

        if (!dailyCommits.has(date)) {
          dailyCommits.set(date, [])
        }
        dailyCommits.get(date)!.push(minutesFromMidnight)
      }
    }

    // 找每天的最晚时间
    const result: DailyCommitTime[] = []
    for (const [date, minutes] of dailyCommits.entries()) {
      const maxMinutes = Math.max(...minutes)
      result.push({ date, minutesFromMidnight: maxMinutes })
    }

    return result
  }

  /**
   * 批量采集多个用户的工作模式数据
   * @param monthsBackForWorkPattern 团队工作模式的时间窗口（默认6个月）
   */
  async collectUserPatterns(
    coreContributors: ContributorInfo[],
    options: GitLogOptions,
    monthsBackForWorkPattern: number = 6
  ): Promise<UserPatternData[]> {
    const results: UserPatternData[] = []

    for (const contributor of coreContributors) {
      const [timeDistribution, dayDistribution, dailyFirstCommits, dailyLatestCommits] = await Promise.all([
        this.getUserTimeDistribution(contributor.email, options),
        this.getUserDayDistribution(contributor.email, options),
        this.getUserDailyFirstCommits(contributor.email, options, monthsBackForWorkPattern),
        this.getUserDailyLatestCommits(contributor.email, options, monthsBackForWorkPattern),
      ])

      results.push({
        contributor,
        timeDistribution,
        dayDistribution,
        dailyFirstCommits,
        dailyLatestCommits,
      })
    }

    return results
  }
}

