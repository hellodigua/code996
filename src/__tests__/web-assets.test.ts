import fs from 'fs'
import path from 'path'

const projectRoot = path.resolve(__dirname, '../..')

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

describe('Web 报告资产', () => {
  test('保留旧版视觉组件和双语资源', () => {
    const migratedFiles = [
      'web/src/components/charts/BaseChart.vue',
      'web/src/components/charts/BarChart.vue',
      'web/src/components/charts/PieChart.vue',
      'web/src/components/LanguageSwitcher.vue',
      'web/src/components/GithubCorner.vue',
      'web/src/i18n/locales/zh-CN.ts',
      'web/src/i18n/locales/en-US.ts',
      'web/src/styles/_tokens.scss',
      'web/public/fonts/vcr-osd.ttf',
      'web/public/fonts/zpix.woff2',
    ]

    for (const relativePath of migratedFiles) {
      expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(true)
    }

    expect(fs.existsSync(path.join(projectRoot, 'web/public/fonts/zpix.ttf'))).toBe(false)
  })

  test('Web 入口不依赖 CDN 或远程脚本', () => {
    const html = readProjectFile('web/index.html')
    const viteConfig = readProjectFile('web/vite.config.mts')

    expect(html).not.toMatch(/<script[^>]+https?:\/\//i)
    expect(viteConfig).not.toContain('externalGlobals')
    expect(viteConfig).not.toMatch(/external\s*:/)
  })

  test('主构建会同时生成 CLI 和 Web 产物', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.['build:cli']).toBeTruthy()
    expect(packageJson.scripts?.['build:cli']).toContain('clean-cli-dist.mjs')
    expect(packageJson.scripts?.['build:cli']).toContain('finalize-cli-dist.mjs')
    expect(packageJson.scripts?.['build:web']).toBeTruthy()
    expect(packageJson.scripts?.build).toContain('build:cli')
    expect(packageJson.scripts?.build).toContain('build:web')
  })
})
