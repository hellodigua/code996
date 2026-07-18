declare module 'chart.xkcd' {
  interface ChartOptions {
    backgroundColor?: string
    strokeColor?: string
    unxkcdify?: boolean
  }

  interface ChartConfig {
    data: {
      labels: string[]
      datasets: Array<{ data: number[] }>
    }
    options?: ChartOptions
  }

  class Chart {
    constructor(element: SVGElement, config: ChartConfig)
  }

  const chartXkcd: {
    Bar: typeof Chart
    Pie: typeof Chart
  }

  export default chartXkcd
}
