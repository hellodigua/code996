import fs from 'fs'
import path from 'path'

const projectRoot = path.resolve(__dirname, '../..')

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

describe('官方站点迁移', () => {
  test('保留旧官网页面、双语资源与 hash 路由兼容', () => {
    const migratedFiles = [
      'website/src/view/intro/index.vue',
      'website/src/view/result/index.vue',
      'website/src/i18n/locales/zh-CN.ts',
      'website/src/i18n/locales/en-US.ts',
      'website/public/fonts/vcr-osd.ttf',
      'website/public/fonts/zpix.woff2',
    ]

    for (const relativePath of migratedFiles) {
      expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(true)
    }

    const router = readProjectFile('website/src/router/index.ts')
    expect(router).toContain('createWebHashHistory')
    expect(router).toContain("path: '/result'")
    expect(router).toContain("path: '/zh'")
    expect(router).toContain("path: '/en'")
  })

  test('站点运行时和字体不依赖 CDN', () => {
    const html = readProjectFile('website/index.html')
    const styles = readProjectFile('website/src/public/styles/common.scss')
    const viteConfig = readProjectFile('website/vite.config.mts')

    expect(html).not.toMatch(/<script[^>]+https?:\/\//i)
    expect(styles).not.toMatch(/url\(['"]?https?:\/\//i)
    expect(viteConfig).not.toContain('externalGlobals')
    expect(viteConfig).not.toMatch(/external\s*:/)
  })

  test('主仓库独立构建并部署官网', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      scripts?: Record<string, string>
    }
    const workflow = readProjectFile('.github/workflows/pages.yml')

    expect(packageJson.scripts?.['build:website']).toContain('website/vite.config.mts')
    expect(workflow).toContain('npm run build:website')
    expect(workflow).toContain('path: dist/website')
    expect(workflow).toContain('actions/deploy-pages@v4')
    expect(workflow).not.toContain('code996-web')
    expect(workflow).not.toContain('ACTIONS_DEPLOY_KEY')
  })

  test('官网源码和产物不会进入 CLI npm 包', () => {
    const npmIgnore = readProjectFile('.npmignore')

    expect(npmIgnore).toContain('website/')
    expect(npmIgnore).toContain('dist/website/')
  })
})
