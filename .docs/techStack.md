# Code996 项目技术栈文档

## 📋 技术栈概览

Code996 是一个基于 TypeScript 的本地 Git 分析工具：Node.js CLI 完成采集与计算，`web/` 提供按需生成的离线报告，`website/` 提供公开官网与历史结果链接兼容。本文档描述三者的依赖管理和构建流程。

### 技术选型原则

- **类型安全**: 优先选择支持 TypeScript 的工具和库
- **开发效率**: 使用现代化的开发工具和构建流程
- **用户体验**: 提供友好的命令行界面和清晰的输出格式
- **性能优化**: 优化 Git 数据采集和分析算法的性能
- **可维护性**: 采用模块化设计和清晰的代码结构

## 📦 依赖包详解

### 生产依赖 (Dependencies)

| 包名                 | 版本    | 用途                                           | 重要性  |
| -------------------- | ------- | ---------------------------------------------- | ------- |
| `commander`          | ^11.1.0 | 命令行参数解析和命令管理                       | 🟢 核心 |
| `@inquirer/checkbox` | ^3.0.1  | 多仓库交互式选择；避免引入未使用的 editor 依赖 | 🟡 重要 |
| `chalk`              | ^4.1.2  | 终端彩色输出，支持多种颜色和样式               | 🟡 重要 |
| `cli-table3`         | ^0.6.5  | 表格格式化输出，自适应终端宽度                 | 🟡 重要 |
| `ora`                | ^5.4.1  | 加载动画和 spinner，提升用户体验               | 🟢 辅助 |

#### 核心依赖说明

**Commander.js**

- 提供完整的命令行参数解析功能
- 支持子命令、选项、参数验证
- 自动生成帮助文档
- 使用示例：`code996 -y 2025 --self`

**Chalk**

- 终端彩色文本输出
- 支持链式调用和样式组合
- 跨平台兼容性好
- 使用示例：`chalk.red('错误信息')`

**CLI-Table3**

- 自适应终端宽度的表格输出
- 支持多列对齐和边框样式
- 自动处理长文本换行
- 使用示例：分析结果的数据表格展示、多仓库对比表格

**Ora**

- 简单易用的加载动画
- 支持多种 spinner 样式
- 自动检测是否支持 ANSI 转义序列
- 使用示例：Git 数据采集时的加载提示

### 开发依赖 (DevDependencies)

Web 构建与测试使用 Vue 3、Vite 8、chart.xkcd、vue-router、vue-i18n、Vitest、Vue Test Utils 和 jsdom。Vite 8 要求贡献者使用 Node.js 20.19+ 或 22.12+；发布后的 CLI 运行时最低为 Node.js 18。

| 包名              | 版本     | 用途                                    | 重要性  |
| ----------------- | -------- | --------------------------------------- | ------- |
| `typescript`      | ^5.9.3   | TypeScript 编译器和类型检查             | 🟢 核心 |
| `jest`            | ^29.7.0  | 单元测试框架                            | 🟢 核心 |
| `ts-jest`         | ^29.4.5  | Jest 的 TypeScript 支持                 | 🟡 重要 |
| `ts-node`         | ^10.9.2  | TypeScript 运行时，支持直接运行 ts 文件 | 🟢 辅助 |
| `inquirer`        | ^7.10.1  | 交互式命令行界面，支持多选和单选        | 🟡 重要 |
| `@types/node`     | ^20.14.2 | Node.js 类型定义                        | 🟡 重要 |
| `@types/jest`     | ^29.5.14 | Jest 类型定义                           | 🟡 重要 |
| `@types/yargs`    | ^17.0.32 | Yargs 类型定义（兼容性支持）            | 🟢 辅助 |
| `@types/inquirer` | ^9.0.5   | Inquirer 类型定义                       | 🟡 重要 |
| `prettier`        | ^3.6.2   | 代码格式化工具                          | 🟡 重要 |

## 🚀 构建和部署流程

### 开发流程

1. **环境准备**

   ```bash
   npm install  # 安装依赖
   ```

2. **代码编写**
   - 使用 TypeScript 编写代码
   - 遵循 Prettier 代码风格
   - 添加必要的类型定义

3. **测试验证**
   ```bash
   npm run dev           # 在 3300 端口使用匿名完整报告预览本地 Web
   npm run dev:cli       # 监听 CLI TypeScript 编译
   npm run dev:website   # 在 3310 端口预览官方站点
   npm test              # Jest + Vitest
   npm run build         # CLI + 本地 Web 生产构建
   npm run build:website # 官方站点生产构建
   ```

### 构建流程

1. **CLI TypeScript 编译**
   - 将 TypeScript 源码编译为 JavaScript
   - 生成声明文件 (.d.ts) 便于类型引用
   - 生成 SourceMap 便于调试

2. **Web 离线构建**
   - Vite 使用 `base: './'` 输出相对资产路径
   - Vue、chart.xkcd、样式和字体全部随 npm 包发布，不依赖 CDN
   - 生成报告时将模块脚本内联，确保 `file://` 下无需 localhost 服务

3. **官方站点构建**
   - `website/` 使用独立的 Vite 配置构建到 `dist/website`
   - 保留 hash 路由和相对资产路径，兼容 GitHub Pages 子目录及历史结果链接
   - 运行依赖和字体随产物部署，不依赖 CDN
   - `dist/website` 只作为 Pages artifact，不进入 npm 发布包

4. **构建产物结构**

   ```
   dist/
   ├── cli/
   │   ├── index.js
   │   └── commands/
   │       ├── analyze.js
   │       ├── multi.js
   │       ├── report/
   │       │   ├── index.js
   │       │   ├── printer.js
   │       │   ├── analysis.js
   │       │   ├── multi-comparison.js
   │       │   └── trend-printer.js
   │       └── help.js
   ├── core/
   ├── git/
   ├── types/
   ├── utils/
   └── web/                 # Vite 生产产物、字体和 favicon
   ```

5. **发布包结构**
   ```
   code996/
   ├── bin/code996          # CLI 入口
   ├── dist/                # 编译后的代码
   ├── package.json         # 包配置
   └── README.md           # 项目文档
   ```

### 部署配置

**Package.json 配置**

```json
{
  "bin": {
    "code996": "bin/code996"
  },
  "files": ["bin/", "dist/", "README.md"],
  "engines": {
    "node": ">=14.0.0"
  }
}
```

**发布流程**

1. 在与 `origin/main` 同步的 `main` 上只修改 `package.json.version`
2. 执行 `npm run release`
3. 本地脚本同步 `package-lock.json`，运行格式、测试、构建和打包检查
4. 脚本创建 release commit 与 annotated Tag，并原子推送到 GitHub
5. Tag 触发 GitHub Actions，通过 provenance 发布 npm 包并创建 GitHub Release

本地不直接运行 `npm publish`，以 Tag 触发的 GitHub Actions 作为唯一远端发布入口。

## 🛠️ 开发工具和流程

### 开发环境配置

**IDE 支持**

- **VSCode**: 完整的 TypeScript 支持
- **IntelliJ IDEA**: 强大的代码分析和重构功能
- **WebStorm**: 专业的 JavaScript/TypeScript 开发环境

**类型检查**

- **严格模式**: 启用所有 TypeScript 严格检查
- **类型定义**: 完整的内置和第三方库类型定义
- **接口设计**: 使用接口定义数据结构，确保类型安全

**代码格式化**

- **Prettier**: 统一的代码风格
- **Git Hooks**: 提交前自动格式化

## 📊 新增功能技术说明

### 多仓库分析功能

- **交互式选择**: 使用 `inquirer` 实现命令行多选界面
- **批量数据采集**: 串行处理多个 Git 仓库，支持错误跳过和进度显示
- **数据合并策略**: 按维度累加统计，支持小时分布、星期分布和时间合并
- **对比分析**: 生成多仓库对比表格，支持彩色标识和统计摘要

### 报表输出系统

- **模块化设计**: `report/` 目录下包含 `printer.ts` 和 `analysis.ts`
- **自适应输出**: 根据终端宽度自动调整表格列宽
- **彩色标识**: 使用 `chalk` 实现不同风险等级的颜色标识
- **智能分析**: 基于多维度指标生成人性化分析文本和建议

### 本地 Web 报告

- **统一契约**: `src/report/report-data.ts` 不引入 Node 模块，可被 CLI 与浏览器共同引用
- **输出判断**: 默认终端并保存本地 Web 但不打开；显式 `--web` 自动打开；JSON/Markdown 不额外生成网页
- **本地生成**: `web-report-writer.ts` 复制 `dist/web` 到 `Downloads/code996-report` 并安全注入数据，Downloads 不可用时降级到系统临时目录
- **安全边界**: JSON 中的 `<`、`>`、`&`、U+2028、U+2029 会转义，系统打开器使用参数数组且不经过 shell
- **测试**: Jest 验证输出模式、注入与降级；Vitest 验证双语、项目类型、多仓库和低样本状态

### 官方站点

- **源码位置**: `website/`，与 CLI 本地报告的 `web/` 分开维护
- **兼容边界**: Vue Router hash 路由继续解析历史 `time`、`hour`、`week` 查询参数
- **构建命令**: `npm run build:website`
- **部署方式**: 主仓库 GitHub Actions 上传 `dist/website` artifact，并由 `actions/deploy-pages` 发布
- **密钥边界**: 使用 GitHub Pages 的 `pages: write` 与 OIDC 权限，不使用旧仓库 deploy key
