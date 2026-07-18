import ora, { Ora } from 'ora'

export interface SpinnerLike {
  text: string
  succeed: (text?: string) => void
  fail: (text?: string) => void
  warn: (text?: string) => void
  render: () => void
}

/** 返回真实 spinner 或无操作的 stub，由 silent 参数控制 */
export function createSpinner(label: string, silent: boolean): Ora | SpinnerLike {
  if (silent) {
    return {
      text: '',
      succeed: (_?: string) => {},
      fail: (msg?: string) => {
        if (msg) process.stderr.write(msg + '\n')
      },
      warn: (_?: string) => {},
      render: () => {},
    }
  }
  return ora(label)
}
