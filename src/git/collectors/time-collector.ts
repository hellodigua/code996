import { GitLogOptions, TimeCount } from '../../types/git-types'
import { BaseCollector } from './base-collector'

/**
 * 时间分布数据采集器
 * 负责按小时和按星期统计提交分布
 */
export class TimeCollector extends BaseCollector {
  /**
   * 按半小时统计commit数据（内部采集分钟级，聚合为48个半小时点）
   */
  async getCommitsByHour(options: GitLogOptions): Promise<TimeCount[]> {
    const { path } = options

    // 采集分钟级数据：同时获取作者、本地时间和时区信息用于过滤
    // 格式: "Author Name <email@example.com>|HH:MM|2025-01-01 12:30:00 +0800"
    const args = ['log', '--format=%an <%ae>|%cd|%ai', `--date=format-local:%H:%M`]
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    return this.parseTimeData(output, 'half-hour', options.ignoreAuthor, options.timezone)
  }

  /**
   * 按星期统计commit数据
   */
  async getCommitsByDay(options: GitLogOptions): Promise<TimeCount[]> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|D|2025-01-01 12:30:00 +0800" (D为星期几，0-6)
    const args = ['log', '--format=%an <%ae>|%cd|%ai', `--date=format-local:%w`]
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    return this.parseTimeData(output, 'day', options.ignoreAuthor, options.timezone)
  }

  /**
   * 解析时间数据（支持作者过滤和时区过滤）
   * @param output git log 输出，格式: "Author Name <email@example.com>|TIME|ISO_TIMESTAMP"
   * @param type 时间类型
   * @param ignoreAuthor 排除作者的正则表达式
   * @param timezone 指定时区过滤（例如: +0800）
   */
  private parseTimeData(
    output: string,
    type: 'half-hour' | 'day',
    ignoreAuthor?: string,
    timezone?: string
  ): TimeCount[] {
    const lines = output.split('\n').filter((line) => line.trim())
    const timeCounts: TimeCount[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()

      // 分离作者、时间和ISO时间戳：格式 "Author Name <email@example.com>|TIME|ISO_TIMESTAMP"
      const parts = trimmedLine.split('|')
      if (parts.length < 3) {
        continue // 格式不正确，跳过
      }

      const author = parts[0]
      let time = parts[1]
      const isoTimestamp = parts[2] // 例如: "2025-01-01 12:30:00 +0800"

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, ignoreAuthor)) {
        continue
      }

      // 时区过滤：从ISO时间戳中提取时区信息
      if (timezone) {
        const timezoneMatch = isoTimestamp.match(/([+-]\d{4})$/)
        if (!timezoneMatch) {
          continue // 无法解析时区，跳过
        }
        const commitTimezone = timezoneMatch[1]
        if (commitTimezone !== timezone) {
          continue // 不匹配目标时区，跳过
        }
      }

      // 如果是半小时模式，需要将分钟归类到半小时
      if (type === 'half-hour' && time) {
        const match = time.match(/^(\d{2}):(\d{2})$/)
        if (match) {
          const hour = match[1]
          const minute = parseInt(match[2], 10)
          // 0-29分钟归到 :00，30-59分钟归到 :30
          time = minute < 30 ? `${hour}:00` : `${hour}:30`
        }
      }

      // 如果是星期模式，需要将 %w 格式(0-6)转换为 1-7 格式
      if (type === 'day' && time) {
        const dayW = parseInt(time, 10)
        if (!isNaN(dayW) && dayW >= 0 && dayW <= 6) {
          // 转换：%w 的 0(周日) -> 7, 1-6 -> 1-6
          time = (dayW === 0 ? 7 : dayW).toString()
        }
      }

      if (time) {
        // 查找是否已存在该时间点的计数
        const existingIndex = timeCounts.findIndex((item) => item.time === time)
        if (existingIndex >= 0) {
          timeCounts[existingIndex].count++
        } else {
          timeCounts.push({
            time,
            count: 1,
          })
        }
      }
    }

    // 确保所有时间点都有数据（补0）
    if (type === 'half-hour') {
      return this.fillMissingHalfHours(timeCounts)
    }

    return this.fillMissingDays(timeCounts)
  }

  /**
   * 补全缺失的半小时数据（48个时间点）
   */
  private fillMissingHalfHours(data: TimeCount[]): TimeCount[] {
    const halfHours: TimeCount[] = []

    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0')

      // 每小时两个时间点：:00 和 :30
      for (const suffix of ['00', '30']) {
        const timeKey = `${hour}:${suffix}`
        const existing = data.find((item) => item.time === timeKey)

        halfHours.push({
          time: timeKey,
          count: existing ? existing.count : 0,
        })
      }
    }

    return halfHours
  }

  /**
   * 补全缺失的星期数据
   */
  private fillMissingDays(data: TimeCount[]): TimeCount[] {
    const days: TimeCount[] = []

    for (let i = 1; i <= 7; i++) {
      const day = i.toString()
      const existing = data.find((item) => item.time === day)

      days.push({
        time: day,
        count: existing ? existing.count : 0,
      })
    }

    return days
  }
}
