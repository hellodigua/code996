# 官方站点

## 目标与边界

官方站点部署在 `https://hellodigua.github.io/code996/`，提供项目介绍、双语切换、新版示例报告和历史 URL 结果页。官网外壳位于 `website/`，新版示例报告直接复用本地完整报告 `web/`：

- `website/` 是可公开访问的静态站点，继续兼容早期 shell 脚本生成的 URL 参数。
- `web/` 同时服务于 CLI 本地报告和官网 `/preview/` 示例页，两者使用同一套组件与样式；官网只注入匿名示例数据。
- CLI 生成的真实报告仍只保存在用户本地，官网不会接收或托管用户仓库数据。
- 官方站点不承担当前 CLI 报告托管职责，也不会接收 CLI 自动上传的数据。

## 路由兼容

站点使用 Vue Router hash history，GitHub Pages 只需提供一个 `index.html`。以下入口必须继续可用：

- `#/zh/`、`#/en/`：中英文介绍页。
- `#/zh/result?...`、`#/en/result?...`：中英文历史结果页。
- `#/result?...`：旧格式兼容入口，根据 `lang` 参数或本地语言偏好重定向。
- `/preview/?lang=zh-CN`、`/preview/?lang=en`：当前版本的匿名完整报告，不使用 hash 路由。

历史结果数据来自 URL 的 `time`、`hour` 和 `week` 参数。页面只在浏览器本地解析这些参数；用户分享 URL 时也会同时分享其中的统计数据，因此页面必须保留相应提醒。

首页“查看示例结果”只进入 `/preview/`；新版预览顶栏提供返回对应语言官网首页的入口。旧结果页不再作为首页示例，但源码和路由必须保留，以继续打开旧 shell 脚本生成或用户已收藏的链接。

## 构建与资源

- `npm run dev:website` 同时启动官网和 Web 预览开发服务，只自动打开 `http://localhost:3310/`；无需另外运行 `npm run dev:web`。
- 官网开发页的“查看示例结果”停留在 `http://localhost:3310/preview/`；官网开发服务会代理内部 Web 预览及其热更新连接，不在地址栏暴露 `3300` 端口。
- `npm run build:website` 分别检查 `website/` 和 `web/` 的类型，构建官网外壳后，再以 `preview` 模式把匿名示例报告构建到 `dist/website/preview/`。
- Vite 使用 `base: './'`，保证资产路径适配 `/code996/` 子目录。
- Vue、vue-router、vue-i18n 和 chart.xkcd 由 Vite 打包；字体、favicon 和历史预览图来自 `website/public/`。
- HTML、CSS 和字体不加载 CDN 运行时资源。`dist/website/` 不进入 CLI 的 npm 发布包。
- 普通 `npm run build:web` 仍输出不含示例数据的 `dist/web/`，由 CLI 注入真实 `ReportData`；只有官网 `preview` 构建会把匿名示例写进 HTML。

## 部署

`.github/workflows/pages.yml` 在主仓库 `main` 的 `website/`、`web/`、`ReportData` Schema、锁文件或工作流变化时运行，也支持手动触发：

1. `npm ci` 安装锁定依赖。
2. `npm run build:website` 生成 `dist/website/`。
3. 上传 GitHub Pages artifact。
4. 使用 `actions/deploy-pages` 和 `github-pages` environment 发布。

该流程只使用仓库内建的 `pages: write` 与 `id-token: write` 权限，不向 `gh-pages` 分支写入，也不依赖旧 `code996-web` 仓库的 `ACTIONS_DEPLOY_KEY`。

首次切换时需要在仓库 Pages 设置中将发布来源改为 **GitHub Actions**。确认主仓库部署成功后，才能停用旧仓库工作流、删除跨仓库 deploy key 并归档旧仓库。

## 质量门槛

- `npm run build:website` 类型检查和生产构建通过，同时产出 `dist/website/index.html` 与 `dist/website/preview/index.html`。
- Jest 固定检查双语页面、hash 路由、无 CDN 运行时、Pages artifact 路径和 npm 包排除规则。
- 普通 `dist/web/index.html` 不含匿名示例数据，官网 `preview/index.html` 含完整匿名 `ReportData`。
- 旧示例 URL 在中文、英文和兼容入口下均能显示结果；首页入口则打开新版双语报告。
- Pages 部署后核对官网首页、新版预览、静态字体、语言切换和历史结果链接。
