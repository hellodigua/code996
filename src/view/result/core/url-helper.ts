import { useRouter } from 'vue-router'
import { TimeCount } from '../../../typings'

/**
 * 解析url参数为标准数据格式
 * @param str 分析参数
 * @returns
 */
export function parseResult(str: string = ''): TimeCount[] {
  if (!str) {
    console.warn('解析的URL参数为空')
    return []
  }

  let list: TimeCount[] = []
  try {
    str.split(',').forEach((item) => {
      if (!item.includes('_')) {
        console.warn(`无效的格式: ${item}，应为 'count_time'`)
        return
      }

      const arr = item.split('_')
      if (arr.length !== 2) {
        console.warn(`无效的格式: ${item}，应为 'count_time'`)
        return
      }

      const count = Number(arr[0])
      if (isNaN(count)) {
        console.warn(`无效的数量值: ${arr[0]}`)
        return
      }

      list.push({
        time: arr[1],
        count: count,
      })
    })
  } catch (error) {
    console.error('解析URL参数时出错:', error)
  }

  return list
}

/**
 * 二次改造周维度数据
 * @param list
 * @returns
 */
export function parseWeekData(list: TimeCount[]): TimeCount[] {
  if (!Array.isArray(list)) {
    console.warn('parseWeekData: 输入不是数组')
    return []
  }

  const templateList = [
    { name: '周一', key: '1' },
    { name: '周二', key: '2' },
    { name: '周三', key: '3' },
    { name: '周四', key: '4' },
    { name: '周五', key: '5' },
    { name: '周六', key: '6' },
    { name: '周日', key: '7' },
  ]
  return templateList.map((tem) => {
    const item = list.find((i) => i.time === tem.key) as TimeCount

    return {
      time: tem.name,
      count: item?.count || 0,
    }
  })
}

/**
 * 检查路由参数是否合法并跳转
 */
export function checkUrlQueryAndRedirect(): void {
  const router = useRouter()
  const { query } = router.currentRoute.value

  // 检查所有必要参数是否存在
  const requiredParams = ['time', 'hour', 'week']
  const missingParams = requiredParams.filter((param) => !query[param])

  if (missingParams.length > 0) {
    console.error(`缺少必要的URL参数: ${missingParams.join(', ')}`)
    router.push({
      name: 'index',
      query: {
        error: 'url_query_error',
        missing: missingParams.join(','),
      },
    })
    return
  }

  // 检查时间参数格式
  const timeStr = query.time as string
  if (!timeStr.includes('_') || timeStr.split('_').length !== 2) {
    console.error('无效的时间参数格式')
    router.push({
      name: 'index',
      query: {
        error: 'invalid_time_format',
      },
    })
  }
}
