# 任务：code996 结构化输出（--json / --md / --output）

> 创建日期：2026-06-02 · 完成日期：2026-06-02 · 状态：**已完成** · 类型：新功能（前置依赖）
>
> **注意**：本任务是 [code996-report-skill.md](./code996-report-skill.md) 的前置依赖，skill 消费 `--json` 的结构化数据。

## 一、背景

code996 目前只有彩色终端输出（chalk + cli-table3），无法被 AI / 脚本程序可靠解析。为让 Claude Code Skill 能读取 code996 的分析结果，需要新增结构化输出能力。

## 二、决策记录（已确认）

| 项目                | 决策                                                 |
| ------------------- | ---------------------------------------------------- |
| `--json` 时终端报表 | 静默，只输出 JSON                                    |
| JSON 落盘           | `--json` → stdout；`--json --output <path>` → 文件   |
| `--md` 内容         | 纯数据型 Markdown 表格（无叙事，AI 负责结论）        |
| `--md` 落盘         | 同 JSON，默认 stdout，`--output` 落盘                |
| 默认文件名          | `code996-report-YYYY-MM-DD.json` / `.md`，保存到 CWD |
| Schema 版本         | `schemaVersion: "experimental"`，不承诺稳定          |
| CLI 入口            | 加到现有根命令选项，不新增子命令                     |

## 三、CLI 变更

在 `src/cli/index.ts` 的根命令新增三个选项（与 `--since`、`--self` 等平级）：

```
--json              以 JSON 格式输出分析结果（静默终端报表，输出到 stdout）
--md                以 Markdown 表格格式输出分析结果（输出到 stdout）
--output <path>     将 --json 或 --md 的输出保存到文件；
                    不传文件名时用默认名 code996-report-YYYY-MM-DD.{json|md}
```

调用示例：

```bash
code996 --json                          # JSON → stdout
code996 --json | jq '.core.index996'    # 管道处理
code996 --json --output report.json     # JSON → 文件
code996 --md                            # Markdown 表格 → stdout
code996 --md --output report.md         # Markdown 表格 → 文件
code996 /proj1 /proj2 --json            # 多仓库 JSON
```

## 四、JSON Schema 设计

`schemaVersion: "experimental"`，字段名以现有 TypeScript 类型为基准（camelCase）。

```json
{
  "schemaVersion": "experimental",
  "meta": {
    "version": "1.0.1",
    "repos": ["/path/to/repo"],
    "since": "2025-06-02",
    "until": "2026-06-02",
    "rangeMode": "auto-last-commit",
    "locale": "zh-CN",
    "options": {
      "self": false,
      "allTime": false,
      "ignoreAuthor": null,
      "ignoreMsg": null,
      "timezone": null
    }
  },
  "core": {
    "index996": 142,
    "rating": "overwork",
    "overTimeRatio": 38.5,
    "totalCommits": 1024
  },
  "workTime": {
    "startHour": 9,
    "endHour": 21,
    "isReliable": true,
    "confidence": 87.3,
    "detectionMethod": "quantile-window"
  },
  "hourlyDistribution": [{ "hour": "09", "count": 42 }],
  "weekdayDistribution": [{ "day": "monday", "count": 180 }],
  "weekdayOvertime": {
    "monday": 12,
    "tuesday": 8,
    "wednesday": 15,
    "thursday": 10,
    "friday": 20,
    "peakDay": "friday",
    "peakCount": 20
  },
  "weekendOvertime": {
    "saturdayDays": 8,
    "sundayDays": 4,
    "casualFixDays": 5,
    "realOvertimeDays": 7
  },
  "lateNight": {
    "evening": 120,
    "lateNight": 45,
    "midnight": 12,
    "dawn": 3,
    "midnightDays": 10,
    "totalWorkDays": 240,
    "midnightRate": 4.2,
    "totalWeeks": 52,
    "totalMonths": 12
  },
  "trend": null,
  "team": null,
  "multiRepo": null
}
```

**特殊处理**：

- `DailyCommitHours.hours` 是 `Set<number>` → 序列化为 `number[]`。
- `team` / `multiRepo` / `trend` 在不可用时为 `null`。

### team 字段结构（非 `--self`、非 `--skip-user-analysis` 时填充）

```json
"team": {
  "contributors": [
    {
      "name": "Alice",
      "email": "alice@example.com",
      "commits": 320,
      "overtimeCommits": 85,
      "overtimeRatio": 26.6,
      "peakHour": 22,
      "weekendCommits": 30
    }
  ]
}
```

### multiRepo 字段结构（多仓库时填充）

```json
"multiRepo": {
  "repos": [
    {
      "name": "repo-a",
      "path": "/path/to/repo-a",
      "core": { "index996": 160, "rating": "terrible", "overTimeRatio": 45 },
      "totalCommits": 500
    }
  ]
}
```

## 五、Markdown 输出内容

`--md` 输出纯数据表格，无叙事，无建议。章节如下（与终端输出对应）：

```markdown
# code996 分析报告 · 2026-06-02

## 基本信息

| 项目     | 值                      |
| -------- | ----------------------- |
| 仓库     | /path/to/repo           |
| 分析区间 | 2025-06-02 → 2026-06-02 |
| 总提交数 | 1024                    |
| 996 指数 | 142                     |
| 加班比例 | 38.5%                   |

## 每日提交时段分布

| 时段  | 提交数 |
| ----- | ------ |
| 09:00 | 42     |

...

## 工作日加班分布

...

## 周末加班统计

...

## 深夜加班统计

...

## 团队贡献者（可选）

...

## 各仓库对比（多仓库，可选）

...
```

## 六、改动范围与关键文件

### 需修改

| 文件                          | 改动说明                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/cli/index.ts`            | 根命令新增 `--json`、`--md`、`--output` 选项；传入 `handleSmartMode` → `handleAnalyze` / `handleMulti` |
| `src/types/git-types.ts`      | 新增 `AnalyzeOutput` / `JsonOutput` 等接口；为 `AnalyzeOptions` 新增 `json?`, `md?`, `output?` 字段    |
| `src/cli/commands/analyze.ts` | 在 `printResults` 调用前，若 `--json`/`--md` 则走结构化输出路径（跳过 print 函数）                     |
| `src/cli/commands/multi.ts`   | 同上，多仓库场景序列化 `repoRecords[]` 和合并后的 `parsedData`                                         |

### 需新增

| 文件                                        | 说明                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/cli/commands/output/json-formatter.ts` | 把 `{result, parsedData, rawData, teamAnalysis?, repoRecords?}` 序列化为上述 JSON schema（含 `Set → Array` 处理） |
| `src/cli/commands/output/md-formatter.ts`   | 把同样的数据集渲染为纯数据 Markdown 表格                                                                          |
| `src/cli/commands/output/file-writer.ts`    | 统一处理 stdout 输出 vs 文件落盘（含默认文件名生成）                                                              |

## 七、Set 序列化处理

`DailyCommitHours.hours: Set<number>` 需要显式转换：

```typescript
// json-formatter.ts 内部
function serializeDailyCommitHours(arr: DailyCommitHours[]): object[] {
  return arr.map((item) => ({
    ...item,
    hours: Array.from(item.hours).sort((a, b) => a - b),
  }))
}
```

JSON.stringify 时使用 replacer 或提前转换，不依赖默认序列化。

## 八、对现有行为的影响

- 不加 `--json`/`--md`：行为**完全不变**。
- 加 `--json` 或 `--md`：静默所有 chalk/ora/spinner 输出，只走结构化输出路径。
- 进度指示器（ora spinner）在结构化模式下需禁用或转 stderr。

## 九、验证方式

```bash
# JSON 到 stdout
code996 --json | jq '.core.index996'

# JSON 落盘
code996 --json --output /tmp/r.json && cat /tmp/r.json | jq '.meta'

# 默认文件名
code996 --json --output
# → 应生成 ./code996-report-$(date +%F).json

# Markdown 到 stdout
code996 --md | head -30

# 多仓库 JSON
code996 /proj1 /proj2 --json | jq '.multiRepo.repos[].name'

# 原有终端行为不受影响
code996                  # 正常彩色输出
code996 --self --year 2025  # 正常输出
```

### 类型检查

```bash
npx tsc --noEmit   # 必须通过，新增接口不引入类型错误
```

## 十、skill 所需的字段映射（衔接 code996-report-skill.md）

| skill 要求的字段 | JSON schema 路径        | 来源模块                          |
| ---------------- | ----------------------- | --------------------------------- |
| 996 指数         | `.core.index996`        | `Result996.index996`              |
| 加班比例         | `.core.overTimeRatio`   | `Result996.overTimeRadio`         |
| 时段分布         | `.hourlyDistribution[]` | `ParsedGitData.hourData`          |
| 工作日加班       | `.weekdayOvertime`      | `ParsedGitData.weekdayOvertime`   |
| 周末加班         | `.weekendOvertime`      | `ParsedGitData.weekendOvertime`   |
| 深夜加班         | `.lateNight`            | `ParsedGitData.lateNightAnalysis` |
| 推测工时         | `.workTime`             | `ParsedGitData.detectedWorkTime`  |
| 趋势             | `.trend`                | `TrendAnalyzer`                   |
| 贡献者对比       | `.team.contributors[]`  | `GitTeamAnalyzer.analyzeTeam()`   |
| 多仓库对比       | `.multiRepo.repos[]`    | `RepoAnalysisRecord[]`            |
