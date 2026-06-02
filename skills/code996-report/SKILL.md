---
name: code996-report
description: >
  分析 Git 仓库的团队工作强度并生成 996 分析报告。当用户要求分析加班情况、
  统计团队工作时间分布、生成 996 报告、了解加班文化或评估工作强度时触发。
  Use when the user wants to analyze overtime, team work intensity, 996 index,
  or generate a work-hours report for a Git repository.
user-invocable: true
allowed-tools:
  - Bash
  - Write
---

# code996-report — 团队工作强度 / 996 分析报告

根据用户请求，调用 code996 采集结构化数据，结合 git log 语义分析和用户口述背景，生成一份面向管理者/团队的叙事化工作强度报告。

用户传入参数：`$ARGUMENTS`（可选，仓库路径或时间范围说明）

---

## 步骤 1 — 确认分析目标

### 1a. 检测当前目录环境

运行以下命令，判断当前目录的仓库情况：

```bash
# 检查当前目录是否为 git 仓库
git rev-parse --show-toplevel 2>/dev/null

# 扫描子目录中的 git 仓库（最多两层）
find . -maxdepth 2 -name ".git" -type d 2>/dev/null | sed 's|/.git||' | sort
```

根据结果分三种情况处理：

---

**情况 A：当前目录本身是 git 仓库（无子仓库）**

询问用户确认：

> 检测到当前目录是 git 仓库：`{git root 路径}`
> 直接分析这个仓库吗？还是你想分析其他路径？

- 用户确认 → 将该路径作为单一分析目标，进入步骤 1b
- 用户指定其他路径 → 以用户指定的路径为准，重新检测后进入步骤 1b

---

**情况 B：当前目录包含多个子 git 仓库**

列出所有找到的仓库，让用户勾选要分析的仓库：

> 在当前目录下发现以下 git 仓库，请选择要分析的仓库（可多选，输入序号用空格分隔，或输入 `all` 选择全部）：
>
> 1. `./repo-a`
> 2. `./repo-b`
> 3. `./repo-c`
> ...

- 用户选择一个 → 单仓库模式
- 用户选择多个或 `all` → 多仓库聚合模式，将所选路径传给 code996

---

**情况 C：当前目录既不是 git 仓库，也没有子仓库**

告知用户并请求指定路径：

> 当前目录下未找到 git 仓库。请提供要分析的仓库路径（绝对路径或相对路径，多个用空格分隔）：

用户提供路径后，验证路径是否为有效 git 仓库（`git -C <path> rev-parse --git-dir 2>/dev/null`），无效则提示并重新询问。

---

### 1b. 识别时间范围

从 `$ARGUMENTS` 或对话中提取，支持口述转换：
- 「2025 年」→ `-y 2025`
- 「最近半年」→ `-s <6个月前的 YYYY-MM-DD>`
- 未指定 → 不传参，使用 code996 默认（最后提交回溯 365 天）

### 1c. 询问团队背景（一次性提出，不拆分追问）

> 在生成报告前，我需要了解一些背景信息：
> 1. 团队规模大概是多少人？
> 2. 是弹性工作制，还是有明确的上下班时间？
> 3. 约定或法定的每天工时是多少小时（如 8h）？

收到回答后继续执行后续步骤。

---

## 步骤 2 — 采集结构化数据

**检测 code996 可用方式**（优先全局安装，后退 npx）：

```bash
which code996 2>/dev/null && CODE996=code996 || CODE996="npx code996@latest --yes"
```

**根据对话语言确定 locale**：
- 中文对话 → `LANG_FLAG="--lang zh-CN"`
- 英文对话 → `LANG_FLAG="--lang en"`

**执行采集**：

```bash
# 单仓库
$CODE996 <path> --json $LANG_FLAG [时间参数]

# 多仓库（路径空格分隔，自动聚合）
$CODE996 /path1 /path2 --json $LANG_FLAG [时间参数]
```

**解析 JSON 输出**，提取以下字段用于后续分析：

| 字段 | 用途 |
|------|------|
| `core.index996` / `core.rating` / `core.overTimeRatio` | 核心指标 |
| `workTime.startHour` / `workTime.endHour` | 推测上下班时间 |
| `hourlyDistribution[]` | 24 小时提交分布 |
| `weekdayDistribution[]` | 周一至周日分布 |
| `weekdayOvertime` | 工作日加班分布（peakDay） |
| `weekendOvertime` | 周末加班（realOvertimeDays） |
| `lateNight.midnightRate` / `lateNight.midnight` | 深夜加班比例 |
| `trend.summary` | 趋势（若有） |
| `team.contributors[]` | 各贡献者加班占比 |
| `multiRepo.repos[]` | 多仓库对比（若有） |

若 code996 执行失败（如提交数不足），告知用户原因并停止。

---

## 步骤 3 — 加班时段语义分析

基于步骤 2 的 JSON 数据，识别加班高峰窗口，对同一仓库执行 git log 获取实际 commit message，归纳「加班都在干什么」。

**提取周末提交的 commit message**（取最近 50 条）：

```bash
git -C <path> log \
  --after="<since>" --before="<until>" \
  --format="%ad|||%s" \
  --date=format:"%u" \
  | awk -F'|||' '$1>=6 {print $2}' \
  | head -50
```

**提取深夜（23:00 之后）提交的 commit message**：

```bash
git -C <path> log \
  --after="<since>" --before="<until>" \
  --format="%ad|||%s" \
  --date=format:"%H" \
  | awk -F'|||' '$1>=23 {print $2}' \
  | head -50
```

**多仓库时对每个仓库分别执行**，再合并归纳。

根据 commit message 将加班内容分类（可能重叠）：
- **赶需求 / 功能开发**：含 feat / add / implement / 新增 等
- **修线上 Bug**：含 fix / hotfix / bug / 修复 / 紧急 等
- **重构 / 技术债**：含 refactor / chore / clean / 优化 等
- **CI/CD / 发版**：含 release / deploy / ci / build 等
- **其他**：不归入以上分类的

给出各类占比估算（基于 message 数量），并列举 2-3 个典型 commit message 作为例证。

---

## 步骤 4 — 综合解读，生成报告

参照 `references/report-template.md` 的章节骨架，将以下数据整合为叙事化报告：

- **定量数据**：code996 JSON 中的所有指标
- **定性数据**：步骤 3 的加班语义分类
- **人均/贡献者对比**：`team.contributors[]` 中各人加班占比，判断是否存在个别人被迫加班
- **用户口述背景**：团队规模、是否弹性制、约定工时——用于校准「这算不算过度加班」的基准
- **多仓库视图**：`multiRepo.repos[]` 中各仓库指数对比（若适用）

报告风格：有结论（先给定性判断）、有数据支撑（引用具体数字）、有建议（可操作的改进方向）。

---

## 步骤 5 — 选择输出形态

若用户已在 `$ARGUMENTS` 或对话中指明输出格式，直接执行；否则询问：

> 报告已准备好，请选择输出方式：
> - **直接展示**：在对话中输出完整报告
> - **保存为 Markdown**：写入 `./code996-report-<日期>.md`
> - **保存为 HTML**：生成带样式的单文件 HTML，写入 `./code996-report-<日期>.html`

**保存为 Markdown**：使用 `Write` 工具写入文件，日期格式 `YYYY-MM-DD`。

**保存为 HTML**：生成自包含 HTML（内联 CSS，无外部依赖），使用 `Write` 工具写入。建议样式：白色背景、系统字体、最大宽度 800px、关键数字高亮显示。

---

## 注意事项

- 若 `lateNight.midnightRate` 为 0 且周末提交极少，跳过加班语义分析步骤，说明「未发现明显加班痕迹」。
- 若 `team` 字段为 null（如开源项目或 `--skip-user-analysis`），跳过贡献者对比章节。
- 若 `multiRepo` 为 null，跳过多仓库视图章节。
- 报告语言始终与对话语言一致，`--lang` 参数确保 code996 数据标签语言对齐。
- 不要把 `schemaVersion: "experimental"` 暴露给用户——这是内部版本标识。
