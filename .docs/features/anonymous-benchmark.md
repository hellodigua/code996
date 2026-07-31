# 匿名 Benchmark

## 目标

`code996 benchmark` 用于低门槛收集真实工作项目的匿名聚合样本。零参数模式用于发现算法的明显误判和异常分布；知情人也可以选择提供参考工时，用于比较自动结果和人工标签。它不用于上传仓库、收集源码或评价个人绩效。

每个 JSON 只代表一个 Git 仓库和一个时间范围。无标签样本不能证明算法与真实作息的误差；参考工时即使存在，也只是知情人提供的人工标签，不是真理值。

## 使用流程

```bash
code996 benchmark
```

命令在当前 Git 仓库生成无标签样本，不进行交互。默认以仓库最后一次提交为锚点回溯 365 天，团队规模、排班类型、参考工时和标签可信度均记为未知。

全部参数都是可选的。愿意提供上下文时可以运行：

```bash
code996 benchmark /path/to/repo \
  --reference-hours 9.5-18.5 \
  --team-size 20 \
  --schedule fixed \
  --label-confidence high \
  -y 2025
```

- `--reference-hours <START-END>`：真实或典型标准工时，支持半小时小数，如 `9.5-18.5`；存在时样本标记为 `labeled`。
- `--team-size <number>`：大致团队人数，只以区间写入结果。它只用于后续按团队规模分组，不参与 996 指数计算。
- `--schedule fixed|flexible|shift|unknown`：排班类型。
- `--label-confidence high|medium|low`：对参考工时标签的把握程度。

即使不提供 `--team-size`，程序仍会从 Git 自动生成贡献者人数区间；它不能等同于真实团队人数。时间范围支持 `-y/--year`、成对的 `--since/--until` 或 `--all-time`。

默认输出 `code996-benchmark-<dataset-id-prefix>.json`。`--output` 可指定路径，但不会覆盖已有文件。文件权限在支持 POSIX 权限的平台上设为 `0600`。

## 数据流

```text
本地 Git 仓库
  → 复用 GitCollector 采集非 merge commit
  → 自动工时与指数计算
  → 若有参考工时，再计算参考结果和误差
  → 项目分类
  → 隐私字段审计
  → 本地 JSON
  → 用户人工检查后自行发送
```

程序不包含上传端点，也不自动发送文件。

## JSON 契约

顶层 `kind` 固定为 `code996-anonymous-benchmark`，`schemaVersion` 当前为 `1`。主要内容：

- `generator`：code996 版本、数据集生成日期、committer 时间源。
- `labels`：`labeled/unlabeled` 状态，以及可选的参考工时、排班类型、团队人数区间和标签可信度；缺失项使用 `unknown`。
- `scope`：范围模式、起止月份、时区摘要、节假日模式、是否排除 merge。
- `sample`：提交数、贡献者人数区间、48 点半小时分布、星期分布、星期与半小时联合分布、每日首提和末提的半小时直方图。末提直方图用 `24:00–29:30` 保留次日凌晨活动，不压缩到 `23:30`。
- `classification`：项目分类及其数值化维度。
- `results`：始终包含自动工时结果；仅有参考工时时包含参考结果，以及开始/结束时间、指数、加班比例的差异。

`datasetId` 是随机 UUID，仅用于文件去重和后续样本追踪，不从仓库信息派生。

## 隐私边界

输出明确排除：

- 仓库名称和本地路径；
- 源码和文件名；
- 作者姓名和邮箱；
- commit hash 和 message；
- branch 和 remote；
- 精确 commit 日期。

构建完成后，`assertAnonymousBenchmark` 会递归拒绝常见身份/仓库字段名，并检查完整仓库路径未进入 JSON。这个审计是最后一道程序防线，不替代人工检查。

为验证算法，JSON 会保留精确提交总数、月份范围、时区摘要及聚合后的时间直方图。聚合模式仍可能让熟悉项目的人进行关联，因此终端和 JSON 都要求用户在分享前打开检查。高度敏感或人数极少的项目不应分享。

## 关键实现

- `src/benchmark/benchmark-types.ts`：Schema 和 CLI 参数类型。
- `src/benchmark/benchmark-builder.ts`：采集、双结果计算、聚合、匿名化和隐私审计。
- `src/cli/commands/benchmark.ts`：本地写文件、预览和人工检查提醒。
- `src/cli/index.ts`：命令与选项注册。
- `src/__tests__/benchmark.test.ts`：匿名字段、写入安全和 CLI 参数回归。

## 验证基线

单元测试使用临时 Git fixture，覆盖：

1. 只输出聚合字段，不包含仓库、作者、邮箱、message 或精确日期；
2. 注入禁止字段时隐私审计失败；
3. 输出文件使用排他创建，不覆盖已有文件；
4. 当前仓库只运行 `code996 benchmark` 即可生成无标签文件；
5. `--year`、`--timezone`、`--output` 等根命令同名选项不会被 Commander 静默丢失。
6. `00:15` 与 `05:45` 分别导出为 `24:00` 与 `29:30`，不会合并成 `23:30`。
7. author/committer 时区不同时，过滤、时区摘要与时间桶统一采用 committer 时间。

2026-07-31 使用真实业务仓库 `agm-web` 做过只读回归：2025 年、`+0800`、参考工时 `9.5-18.5` 下采集 2153 条非 merge commit，自动结果和参考结果均为 `09:30-18:30 / 54`。输出文件位于系统临时目录；连续两次运行结果一致，且针对仓库名、用户目录、邮箱样式和精确提交日期的文本检查均无匹配。

同日又以零标签默认范围回归：采集 2457 条非 merge commit，输出只包含自动结果 `09:00-18:00 / 66`，`labels.status` 为 `unlabeled`，团队规模和标签可信度为 `unknown`，自动贡献者人数区间为 `2-5`。输出中唯一的 `YYYY-MM-DD` 是数据集生成日期，不包含精确 commit 日期。

## 已知限制

- 人工参考标签可能受弹性工作、轮班、节假日或知情人记忆偏差影响。
- 无标签样本只能用于人工复核、异常发现和分布研究，不能计算相对于真实作息的准确率。
- 时间直方图只能验证提交行为，不能还原会议、沟通、调试等未产生 commit 的工作。
- 匿名聚合降低但不能消除关联风险，因此不会提供自动上传。
- 当前每个文件只表示一个仓库；跨项目分析由维护者在收到并复核多个 JSON 后离线完成。
