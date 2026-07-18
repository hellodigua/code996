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
    expect(router).toContain('createWebHashHistory()')
    expect(router).not.toContain("createWebHashHistory('/')")
    expect(router).toContain("path: '/result'")
    expect(router).toContain("path: '/zh'")
    expect(router).toContain("path: '/en'")
  })

  test('无效结果地址按当前语言返回存在的介绍页路由', () => {
    const urlHelper = readProjectFile('website/src/view/result/core/url-helper.ts')
    const resultView = readProjectFile('website/src/view/result/index.vue')

    expect(urlHelper).toContain("meta.locale === 'en-US' ? 'en-index' : 'zh-index'")
    expect(urlHelper).not.toContain("name: 'index'")
    expect(urlHelper.match(/name: indexRouteName/g)).toHaveLength(2)
    expect(urlHelper).toContain('checkUrlQueryAndRedirect(): boolean')
    expect(urlHelper.match(/return false/g)).toHaveLength(2)
    expect(urlHelper).toContain('return true')
    expect(resultView).toContain('v-if="hasValidQuery"')
    expect(resultView).toContain('if (hasValidQuery) init()')
  })

  test('结果页在语言或查询参数变化时重新初始化', () => {
    const app = readProjectFile('website/src/App.vue')

    expect(app).toContain('<router-view :key="$route.fullPath"></router-view>')
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

  test('官网开发服务使用独立固定端口', () => {
    const viteConfig = readProjectFile('website/vite.config.mts')

    expect(viteConfig).toContain('port: 3310')
    expect(viteConfig).toContain('strictPort: true')
    expect(viteConfig).toContain('open: true')
  })

  test('官网源码和产物不会进入 CLI npm 包', () => {
    const npmIgnore = readProjectFile('.npmignore')

    expect(npmIgnore).toContain('website/')
    expect(npmIgnore).toContain('dist/website/')
  })
})
