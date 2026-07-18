declare module 'chart.xkcd' {
  interface ChartData {
    labels: string[]
    datasets: Array<{
      data: number[]
    }>
  }

  interface ChartOptions {
    backgroundColor?: string
    strokeColor?: string
    unxkcdify?: boolean
  }

  interface ChartConfig {
    data: ChartData
    options?: ChartOptions
  }

  export class Bar {
    constructor(element: HTMLElement | SVGElement, config: ChartConfig)
  }

  export class Pie {
    constructor(element: HTMLElement | SVGElement, config: ChartConfig)
  }

  const chartXkcd: {
    Bar: typeof Bar
    Pie: typeof Pie
  }

  export default chartXkcd
}
