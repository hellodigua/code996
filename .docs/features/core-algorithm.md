# 核心算法

## 目标与边界

code996 通过 Git commit 的时间分布估计编码活动中的加班强度。结果只代表提交行为，不覆盖会议、沟通、调试、学习等未形成 commit 的工作，也不能作为个人绩效依据。

核心算法使用 committer date，默认忽略 merge commit。项目分类、时区过滤和中国节假日模式会影响结果是否展示以及工作日/休息日划分。

## 时间精度

- Git 采集层读取 `%H:%M`，聚合为 48 个半小时点。
- 正常工时判断将 `HH`、`HH:00`、`HH:30` 统一转为 `minuteOfDay` 比较。
- 标准工时采用左闭右开区间。例如 `9.5-18.5` 中，`09:30` 属于正常工时，`18:30` 属于加班。
- 工作日加班分布保留 `weekday + hour + minute`；多仓库合并键也包含分钟。
- 默认终端和 Web 图表仍可按 24 小时展示，但展示聚合不改变核心计算。

## 标准工时与活动结束

报告区分两个概念：

1. `standard work window`：用于判定正常工作和加班。自动模式先根据工作日每日首提的 10%～20% 分位推测开始时间，再固定增加 9 小时；`--hours` 模式直接使用用户指定的边界。
2. `observed activity end`：根据提交分布识别活动延伸到的时间，只作为诊断证据。它不能扩大标准工时，也不能把晚间提交重新吸收到正常工时。

成员自动分析使用成员自己的每日首提样本。成员样本窗口以查询的 `until` 为锚点回溯六个月；历史分析不会再被当前日期错误清空。手动 `--hours` 同时贯穿总览、月度趋势、单仓库团队和多仓库团队分析。

## 低置信度

自动开始时间的置信度由有效工作日样本数估算：

```text
confidence = round(90 × sampleDays / (sampleDays + 50))
```

置信度低于 60% 时：

- 保留自动窗口的单值，兼容已有排序和 `ReportData` 字段。
- 同时对自动窗口、`9-18`、`9.5-18.5`、`10-19` 去重计算。
- `Result996.uncertainty` 和 `ReportData.core.uncertainty` 提供指数最小值、最大值及逐场景结果。
- 终端、Markdown 和 Web 明确标记低置信度，并把单值描述为参考值。
- 手动 `--hours` 置信度为 100%，不生成场景区间。

## 996 指数公式

设：

- `x`：标准工时外提交数；
- `y`：标准工时内提交数；
- `m`：工作日提交数；
- `n`：休息日提交数。

当前公式为：

```text
amendedOvertime = round(x + y × n / (m + n))
overtimeRatio = ceil(amendedOvertime / (x + y) × 100)
index996 = overtimeRatio × 3
```

当加班比例为 0 且时间分布点少于 9 个时，算法保留原有的低工作量负值修正。第一阶段没有重新标定 `× 3`，也没有切换 author date / committer date 或重做周末修正。

## 验证

核心回归由两类测试组成：

- `src/__tests__/core-algorithm.test.ts`：半小时边界、标准/观测时间分离、工作日分钟判定、低置信度场景。
- `src/__tests__/git-minute-fixture.test.ts`：临时创建受控 Git 仓库，验证真实 Git 时间采集，并验证 `--hours` 贯穿月度趋势。

常用命令：

```bash
npm run test:cli -- --runInBand
npm test
npm run build
```

真实业务回归只读取本地仓库，结果写入系统临时目录；不把作者、邮箱和提交明细写入仓库。
