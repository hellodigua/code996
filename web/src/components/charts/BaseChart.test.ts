import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { nextTick } from 'vue'
import BaseChart from './BaseChart.vue'

const chartState = vi.hoisted(() => ({ renderedHeights: [] as number[] }))

vi.mock('chart.xkcd', () => {
  class Chart {
    constructor(element: SVGElement) {
      chartState.renderedHeights.push(window.innerHeight)
      element.setAttribute('width', String(element.parentElement?.clientWidth ?? 0))
      element.setAttribute('height', String(window.innerHeight))
    }
  }

  return {
    default: {
      Bar: Chart,
      Pie: Chart,
    },
  }
})

afterEach(() => {
  chartState.renderedHeights.length = 0
  vi.restoreAllMocks()
})

describe('BaseChart', () => {
  test('宽屏模式按目标高度重新绘制，并在完成后恢复窗口高度', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1040)
    const originalInnerHeight = window.innerHeight

    const wrapper = mount(BaseChart, {
      props: {
        data: [{ time: '09', count: 10 }],
        chartType: 'Bar',
        label: '一天中的提交轨迹',
        wide: true,
      },
    })
    await nextTick()

    expect(chartState.renderedHeights).toEqual([400])
    expect(wrapper.get('svg').attributes('height')).toBe('400')
    expect(window.innerHeight).toBe(originalInnerHeight)

    wrapper.unmount()
  })
})
