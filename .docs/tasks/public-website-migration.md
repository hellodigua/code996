# 任务：将官方站点部署迁入主仓库

> 日期：2026-07-18 · 状态：代码已完成，待合并后切换部署来源 · 类型：仓库整合与部署迁移

## 背景

历史 `code996-web` 仓库仍在通过 deploy key 向 `hellodigua/code996` 的 `gh-pages` 分支发布官网。因此，即使旧仓库只修改 README，也会触发 code996 官方站点部署。旧仓库计划归档，官网源码和部署责任必须迁回主仓库。

## 已完成

- 将旧站 Vue 源码、双语文案、结果页、字体和预览资产迁入 `website/`。
- 保留 `#/zh/result?...`、`#/en/result?...` 和 `#/result?...` 历史链接兼容。
- 移除 HTML 的 CDN Vue、Vue Router 和 chart.xkcd 脚本，改为 Vite 本地打包。
- 新增 `dev:website` 与 `build:website`，独立输出到 `dist/website/`。
- 新增主仓库 Pages artifact 工作流，不再需要跨仓库 deploy key。
- 将官网源码和产物排除在 CLI npm 包之外，并增加迁移边界测试。

## 合并后的切换清单

1. 在 `hellodigua/code996` 的 Pages 设置中将 Source 切换为 **GitHub Actions**。
2. 手动运行主仓库 `Deploy website`，确认首页和历史示例 URL 正常。
3. 禁用或删除 `code996-web/.github/workflows/main.yml`，防止旧仓库继续覆盖部署。
4. 从主仓库删除标题为 `Deploy from code996-web` 的 writable deploy key。
5. 从旧仓库删除对应的 `ACTIONS_DEPLOY_KEY`，随后归档旧仓库。

切换顺序不能提前：主分支尚未包含新工作流时停用旧部署会造成官网更新链路中断。
