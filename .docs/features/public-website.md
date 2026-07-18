# 官方站点

## 目标与边界

官方站点部署在 `https://hellodigua.github.io/code996/`，提供项目介绍、双语切换、示例结果和历史 URL 结果页。源码位于 `website/`，与 CLI 的本地完整报告 `web/` 相互独立：

- `website/` 是可公开访问的静态站点，继续兼容早期 shell 脚本生成的 URL 参数。
- `web/` 只随 `code996 --web` 在用户本地生成，展示当前 CLI 的完整 `ReportData`，不上传仓库数据。
- 官方站点不承担当前 CLI 报告托管职责，也不会接收 CLI 自动上传的数据。

## 路由兼容

站点使用 Vue Router hash history，GitHub Pages 只需提供一个 `index.html`。以下入口必须继续可用：

- `#/zh/`、`#/en/`：中英文介绍页。
- `#/zh/result?...`、`#/en/result?...`：中英文历史结果页。
- `#/result?...`：旧格式兼容入口，根据 `lang` 参数或本地语言偏好重定向。

历史结果数据来自 URL 的 `time`、`hour` 和 `week` 参数。页面只在浏览器本地解析这些参数；用户分享 URL 时也会同时分享其中的统计数据，因此页面必须保留相应提醒。

## 构建与资源

- `npm run dev:website` 启动官网开发服务。
- `npm run build:website` 先执行 Vue 类型检查，再构建到 `dist/website/`。
- Vite 使用 `base: './'`，保证资产路径适配 `/code996/` 子目录。
- Vue、vue-router、vue-i18n 和 chart.xkcd 由 Vite 打包；字体、favicon 和历史预览图来自 `website/public/`。
- HTML、CSS 和字体不加载 CDN 运行时资源。`dist/website/` 不进入 CLI 的 npm 发布包。

## 部署

`.github/workflows/pages.yml` 在主仓库 `main` 的官网源码、锁文件或工作流变化时运行，也支持手动触发：

1. `npm ci` 安装锁定依赖。
2. `npm run build:website` 生成 `dist/website/`。
3. 上传 GitHub Pages artifact。
4. 使用 `actions/deploy-pages` 和 `github-pages` environment 发布。

该流程只使用仓库内建的 `pages: write` 与 `id-token: write` 权限，不向 `gh-pages` 分支写入，也不依赖旧 `code996-web` 仓库的 `ACTIONS_DEPLOY_KEY`。

首次切换时需要在仓库 Pages 设置中将发布来源改为 **GitHub Actions**。确认主仓库部署成功后，才能停用旧仓库工作流、删除跨仓库 deploy key 并归档旧仓库。

## 质量门槛

- `npm run build:website` 类型检查和生产构建通过。
- Jest 固定检查双语页面、hash 路由、无 CDN 运行时、Pages artifact 路径和 npm 包排除规则。
- 旧示例 URL 在中文、英文和兼容入口下均能显示结果。
- Pages 切换后核对官网首页、静态字体、语言切换和历史结果链接，再清理旧部署链路。
