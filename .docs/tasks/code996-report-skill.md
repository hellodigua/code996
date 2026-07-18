# 任务：为 code996 增加「团队工作强度 / 996 分析报告」Claude Code Skill

> 创建日期：2026-06-02 · 状态：已完成（最终方案已调整） · 类型：Agent Skill

## 现状修订（2026-07-18）

最终交付与本文最初草案不同：skill 名称为 `code996`，面向支持 Agent Skills 的多种 AI 工具，通过 `npx skills add hellodigua/code996 --skill code996 -g` 安装。正式 JSON Schema 已落地为 `ReportData` v1；CLI 也已内置本地双语 Web 报告，因此 skill 继续负责需要语义解读的叙事报告，而不再自行维护基础 HTML 可视化模板。下文保留为早期需求与决策演进记录。

## 一、背景（Context）

code996 目前只能在终端输出彩色报表（chalk + cli-table3），数据是「冷」的：用户拿到一堆表格后，需要自己解读「这意味着什么、团队加班严不严重、加班都在干什么、有什么风险」。

本任务为 code996 配一个 **Claude Code Skill**，让用户在 Claude Code 里一句话即可：调用 code996 拿到结构化数据 → 结合 git log 提交语义、多仓库聚合、人均对比、用户口述背景 → 由 Claude 生成一份**面向管理者/团队的「工作强度 / 996 分析报告」**（叙事化、有结论、有业务解读、有建议），并按用户选择输出为 Markdown / HTML / 对话内文本。

读者定位：管理者 / 团队，侧重加班文化、工作时间分布、多人对比，是对 code996 原本 996 主题的深度解读。

## 二、决策记录（已确认）

- **核心职责**：以「AI 解读 + 生成叙事报告」为主，code996 是主数据源，但需结合多源数据综合。
- **跨工具**：只做 Claude Code skill（`SKILL.md`），不做 codex / 其它工具适配。
- **安装方式**：只提供手动复制说明（README 指引复制到 `~/.claude/skills/`），不做自动安装命令。
- **报告用途**：团队工作强度 / 996 分析（非个人周报）。
- **多源数据**（全部纳入）：① git log 提交信息语义分析（加班时段在干什么）② 多仓库聚合 ③ 贡献者/人均对比 ④ 用户口述上下文（团队规模、是否弹性、法定工时）。
- **报告输出**：用户自选 —— 保存为 .md / 生成 .html / 对话内输出。
- **命令调用**：`npx code996@latest` 优先，检测到全局安装则直接用。
- **报告语言**：跟随对话语言，并用 `code996 --lang <locale>` 传递保证数据与报告语言一致，默认中文。
- **时间范围**：沿用 code996 默认（最后一次提交回溯 365 天），用户可口述「分析 2025 年」等，由 Claude 转成 `-y/-s/-u`。

## 三、⚠️ 前置依赖（另列任务，不在本任务实现）

本 skill 依赖 code996 新增结构化输出能力。**该能力作为独立大任务实现**，本任务仅列出 skill 所需的契约：

1. 新增 `--json` 输出模式：输出机器可读的结构化分析结果。
2. 新增 `--md` 输出模式：输出 Markdown 报告。
3. 两种模式都支持**保存到文件**（如 `--output <path>` 或 `--json --save`）。

**skill 消费 `--json` 所需的字段清单**（实现前置任务时需覆盖，对应现有计算模块）：

| 字段                                                | 含义                                       | 对应模块                                                    |
| --------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `meta`                                              | 仓库路径、时间范围、过滤条件、locale、版本 | `cli/commands/analyze.ts`                                   |
| `core`                                              | 996 指数 / 核心结论                        | `report/printer.ts#printCoreResults`                        |
| `hourlyDistribution`                                | 0–23 时各时段提交量                        | `printTimeDistribution`                                     |
| `weekdayDistribution`                               | 周一至周日提交量                           | —                                                           |
| `workTimeSummary`                                   | 推算上班/下班/工作跨度                     | `core/work-span-calculator.ts` / `printWorkTimeSummary`     |
| `weekdayOvertime` / `weekendOvertime` / `lateNight` | 加班统计                                   | `core/overtime-analyzer.ts` 及三个 print 函数               |
| `trend`                                             | 趋势数据                                   | `core/trend-analyzer.ts` / `trend-printer.ts`               |
| `contributors`                                      | 各贡献者提交量、活跃时段、加班占比         | `core/user-analyzer.ts`、`git/collectors/*`                 |
| `multiRepo`                                         | 多仓库聚合结果                             | `git/multi-repo-team-analyzer.ts`、`git/git-data-merger.ts` |

> 说明：上述数据 code996 内部均已计算并用于终端打印，前置任务核心是把中间结果**序列化为 JSON** 并支持落盘，而非新增分析逻辑。

## 四、本任务交付物（skill 本体）

### 1. 新增 skill 源文件

目录：`skills/code996-report/`（随 npm 包发布，需确认未被 `.npmignore` 排除）。

- `skills/code996-report/SKILL.md`：skill 主文件（frontmatter + 指令体）。
- 可选 `skills/code996-report/references/report-template.md`：报告结构模板，供 Claude 参考章节骨架（保持 SKILL.md 精简）。

### 2. SKILL.md 内容设计

**Frontmatter**

- `name: code996-report`
- `description`：明确触发场景，包含「996 / 加班 / 工作强度 / 团队 / 报告」等关键词，例如：「分析 Git 仓库的团队工作强度 / 996 / 加班文化并生成分析报告时使用。当用户要求统计团队工作时间分布、加班情况、做 996 分析或生成工作强度报告时触发。」

**指令体（Claude 执行流程）**

1. **确认范围与背景**：识别目标仓库（单/多路径，默认当前目录）、时间范围（默认沿用 code996）；询问 3 个口述背景问题：团队规模、是否弹性工作制、法定/约定工时。
2. **采集结构化数据**：`npx code996@latest <paths...> --json --lang <locale>`（多路径自动进入多仓库模式）；检测到全局 `code996` 则直接用。
3. **加班时段语义分析**：基于 JSON 识别的加班窗口（深夜 / 周末），对目标仓库执行限定时间段的 `git log`（输出 commit message），归纳「加班都在干什么」（赶需求 / 修线上 bug / 重构等）。
4. **综合解读**：整合 code996 数据 + 加班语义 + 人均对比 + 用户口述背景，形成叙事化团队 996 分析。
5. **选择输出形态**：询问用户要 Markdown 文件 / HTML 文件 / 对话内输出；据此落盘（如 `./code996-report-<日期>.md` 或 `.html`）或直接展示。HTML 无现成模板，由 Claude 直接生成自包含样式的 HTML。
6. **语言**：报告语言跟随对话语言，并据此设置 `--lang`。

**报告章节骨架**（写入 references 模板）

- 概览与核心结论（996 指数 / 一句话定性）
- 工作时间分布（每日时段、工作日 vs 周末）
- 加班分析（工作日 / 周末 / 深夜）+ 加班在干什么（git log 语义）
- 贡献者 / 人均对比（谁加班最多、时段差异、是否个别人被迫加班）
- 多仓库聚合视图（若适用）
- 结合用户背景的风险评估与改进建议

### 3. README 增补

`README.md` / `README_en.md` 新增「在 Claude Code 中生成分析报告」章节：

- 手动复制安装：复制 `skills/code996-report` 到 `~/.claude/skills/code996-report` 或项目 `.claude/skills/`。
- 触发示例：「用 code996 分析这个团队的工作强度并生成报告」。
- 前置：Node ≥ 16（npx 可用）。

## 五、关键文件

- 新增：`skills/code996-report/SKILL.md`、`skills/code996-report/references/report-template.md`
- 修改：`README.md`、`README_en.md`
- 确认：`.npmignore`（确保 `skills/` 随包发布）
- 依赖（前置任务，非本任务）：`src/cli/commands/analyze.ts`、`src/cli/commands/report/*`、各 `core/*` 与 `git/collectors/*` 的 JSON 序列化

## 六、验证方式

本任务不改 TS 源码，验证以 skill 行为为主（前置 `--json` 落地后才能端到端跑通）：

1. **安装验证**：复制 `skills/code996-report` 到 `~/.claude/skills/`，刷新 Claude Code，确认 skill 出现在可用列表。
2. **触发验证**：在真实 git 仓库里对 Claude 说「分析这个团队的 996 情况并出报告」，确认 skill 被自动选中。
3. **端到端验证**（依赖前置任务完成）：
   - Claude 成功执行 `npx code996@latest --json` 并解析数据；
   - 对加班时段执行 `git log` 并给出语义归纳；
   - 询问输出形态，正确生成 `.md` / `.html` 或对话内输出；
   - 切换对话语言（中/英），报告语言与 `--lang` 一致。
4. **多仓库验证**：传入多个仓库路径，确认进入多仓库聚合并在报告中体现对比。

## 七、待前置任务就绪后的衔接点

前置 `--json` schema 一旦确定，需回头校准 SKILL.md 中引用的字段名，确保指令与真实输出一致。
