import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useWebI18n } from '@/i18n'
import ReportCommandGuide from './ReportCommandGuide.vue'

let clipboardDescriptor: PropertyDescriptor | undefined
let execCommandDescriptor: PropertyDescriptor | undefined

beforeEach(() => {
  useWebI18n().setLocale('zh-CN')
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand')
})

afterEach(() => {
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')

  if (execCommandDescriptor) Object.defineProperty(document, 'execCommand', execCommandDescriptor)
  else Reflect.deleteProperty(document, 'execCommand')
  vi.restoreAllMocks()
})

describe('ReportCommandGuide', () => {
  test('两类命令默认折叠，并使用普通列表展示参数', () => {
    const wrapper = mount(ReportCommandGuide)

    expect(wrapper.findAll('details')).toHaveLength(2)
    expect(wrapper.get('.report-options-details').attributes('open')).toBeUndefined()
    expect(wrapper.get('.report-recipes-details').attributes('open')).toBeUndefined()
    expect(wrapper.find('dl').exists()).toBe(false)
    expect(wrapper.findAll('.report-option-list > li')).toHaveLength(22)
    expect(wrapper.findAll('.report-recipe-list > li')).toHaveLength(10)
    wrapper.unmount()
  })

  test('使用 Clipboard API 复制常用组合命令', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(ReportCommandGuide)

    await wrapper.findAll('.report-recipe-command button')[1].trigger('click')

    expect(writeText).toHaveBeenCalledWith('npx code996 --web')
    expect(wrapper.findAll('.report-recipe-command button')[1].text()).toBe('已复制')
    wrapper.unmount()
  })

  test('本地文件无法使用 Clipboard API 时降级为选区复制', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })
    const wrapper = mount(ReportCommandGuide)

    await wrapper.findAll('.report-recipe-command button')[0].trigger('click')

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(wrapper.findAll('.report-recipe-command button')[0].text()).toBe('已复制')
    wrapper.unmount()
  })
})
