/// <reference types="vite/client" />

import type { ReportData } from '../../src/report/report-data'

declare global {
  interface Window {
    __CODE996_REPORT__?: ReportData
  }
}

export {}
