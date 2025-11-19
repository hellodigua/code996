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

    // 采集分钟级数据：同时获取作者和时间用于过滤
    // 格式: "Author Name <email@example.com>|HH:MM"
    const args = ['log', '--format=%an <%ae>|%cd', `--date=format-local:%H:%M`]
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    return this.parseTimeData(output, 'half-hour', options.ignoreAuthor)
  }

  /**
   * 按星期统计commit数据
   */
  async getCommitsByDay(options: GitLogOptions): Promise<TimeCount[]> {
    const { path } = options

    // 格式: "Author Name <email@example.com>|D" (D为星期几，1-7)
    const args = ['log', '--format=%an <%ae>|%cd', `--date=format-local:%u`]
    this.applyCommonFilters(args, options)

    const output = await this.execGitCommand(args, path)
    return this.parseTimeData(output, 'day', options.ignoreAuthor)
  }

  /**
   * 解析时间数据（支持作者过滤）
   * @param output git log 输出，格式: "Author Name <email@example.com>|TIME"
   * @param type 时间类型
   * @param ignoreAuthor 排除作者的正则表达式
   */
  private parseTimeData(output: string, type: 'half-hour' | 'day', ignoreAuthor?: string): TimeCount[] {
    const lines = output.split('\n').filter((line) => line.trim())
    const timeCounts: TimeCount[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()

      // 分离作者和时间：格式 "Author Name <email@example.com>|TIME"
      const pipeIndex = trimmedLine.lastIndexOf('|')
      if (pipeIndex === -1) {
        continue // 格式不正确，跳过
      }

      const author = trimmedLine.substring(0, pipeIndex)
      let time = trimmedLine.substring(pipeIndex + 1)

      // 检查是否应该排除此作者
      if (this.shouldIgnoreAuthor(author, ignoreAuthor)) {
        continue
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
