import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { copyText } from './clipboard'

let clipboardDescriptor: PropertyDescriptor | undefined
let execCommandDescriptor: PropertyDescriptor | undefined

beforeEach(() => {
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

describe('copyText', () => {
  test('优先使用 Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    await expect(copyText('npx code996')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('npx code996')
  })

  test('Clipboard API 不可用时降级为选区复制', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })

    await expect(copyText('npx code996')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  test('两种复制方式都失败时返回失败状态', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('permission denied')) },
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    })

    await expect(copyText('npx code996')).resolves.toBe(false)
  })
})
