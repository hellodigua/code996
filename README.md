# code996

code996 是一个分析工具，它可以统计 Git 项目的 commit 时间分布，进而推导出项目的编码工作强度。

它可以帮助你了解新团队工作的时间模式，识别潜在的加班文化。

<!-- 简体中文 | [English](./README-en_US.md) -->

> 该项目为 Node.js 新版本，功能更强大，旧版本已迁移至 [code996-web](https://github.com/hellodigua/code996-web)。

## 它的用途

面试时我们会询问面试官加班情况，但得到的答案往往不太真实。

但是代码的提交时间不会骗人，因此就有了这个工具。

当你入职新公司，跑一下 `npx code996`，就可以看到数据背后的真相，从而判断这家公司的真实加班文化。

与其痛苦三个月，不如早点看清真相！别等到试用期结束才后悔。

## 预览

### 查看核心结果

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo1.png" alt="核心结果预览" style="width:600px; max-width:100%; height:auto;"/>

### 查看提交时间分布

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo2.png" alt="提交时间分布图" style="width:400px; max-width:100%; height:auto;"/>

### 加班情况分析

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo3.png" alt="加班情况分析图" style="width:600px; max-width:100%; height:auto;"/>

### 月度趋势分析

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo4.png" alt="月度趋势分析图" style="width:600px; max-width:100%; height:auto;"/>

## 🚀 快速开始

无需安装，快速使用：

```bash
# 在当前仓库或仓库上级目录运行（默认查询以上次提交为终点开始365天的commit）
npx code996
```

你也可以选择安装后再使用，这样就不用每次都重新下载：

```bash
# 全局安装
npm i -g code996

# 使用
code996
```

## 🤖 智能分析模式

code996 会根据上下文自动选择最合适的分析模式：

- **在Git仓库中运行** → 单仓库深度分析
- **目录下有多个仓库** → 自动进入多仓库分析模式

```bash
# 智能检测，自动选择分析模式
code996                    # 智能检测当前环境
code996 /path/to/repo      # 分析指定仓库
code996 /proj1 /proj2      # 自动进入多仓库模式
code996 /workspace         # 自动扫描子目录
```

## 📖 详细使用说明

### 基础命令

- `help`：显示帮助信息

#### 时间范围选项

- `-y, --year <year>`：指定年份或年份范围（推荐）
  - 单年格式：`2025` → 分析 2025-01-01 至 2025-12-31
  - 范围格式：`2023-2025` → 分析 2023-01-01 至 2025-12-31
- `-s, --since <date>`：自定义开始日期 (YYYY-MM-DD)
- `-u, --until <date>`：自定义结束日期 (YYYY-MM-DD)
- `--all-time`：覆盖整个仓库历史数据

#### 筛选与展示选项

- `-H, --hours <range>`：手动指定标准工作时间（例如：9-18 或 9.5-18.5）**重要：建议使用该参数，以获取更正确的评价结果**
- `--half-hour`：以半小时粒度展示时间分布（默认按小时展示）**统计更精确**
- `--timezone <offset>`：指定时区进行分析（例如：+0800、-0700）**适用于跨时区团队项目**
- `--self`：仅统计当前 Git 用户的提交记录
- `--ignore-author <regex>`：排除匹配特定正则表达式的作者（例如：排除 bot 或 jenkins）
- `--ignore-msg <regex>`：排除 Commit Message 中包含特定关键词的提交（例如：排除 merge 或 lint）

### 使用示例

```bash
# ===== 单仓库分析（智能模式） =====
code996                        # 分析当前仓库（最近一年）
code996 /path/to/repo          # 分析指定仓库
code996 -y 2025                # 分析2025年
code996 -y 2023-2025           # 分析2023-2025年
code996 --all-time             # 查询整个仓库历史
code996 --self                 # 只分析当前用户的提交
code996 --self -y 2025         # 分析自己在2025年的提交

# ===== 多仓库分析（智能自动检测） =====
code996                        # 如果子目录有多个仓库，自动进入多仓库模式
code996 /path/proj1 /path/proj2  # 传入多个路径，自动分析多个仓库
code996 /workspace             # 扫描指定目录的所有子仓库
code996 /workspace -y 2025     # 分析2025年的数据和趋势
code996 --self                 # 只统计当前用户在所有仓库中的提交

# 精细分析（半小时粒度）
code996 --half-hour            # 以半小时粒度展示时间分布
code996 -y 2025 --half-hour    # 结合年份分析，精细展示
code996 /proj1 /proj2 --half-hour  # 多仓库分析，半小时粒度展示

# 跨时区项目分析
code996 --timezone="+0800"     # 只分析东八区（中国）的提交
code996 --timezone="-0700"     # 只分析西七区（美国西海岸）的提交
code996 -y 2025 --timezone="+0800"  # 分析2025年特定时区的提交

# 过滤噪音数据（排除 CI/CD 机器人、合并提交等）
code996 --ignore-author "bot"                    # 排除所有包含 "bot" 的作者
code996 --ignore-author "bot|jenkins|github-actions"  # 排除多个作者（使用 | 分隔）
code996 --ignore-msg "^Merge"                    # 排除所有以 "Merge" 开头的提交消息
code996 --ignore-msg "merge|lint|format"         # 排除多个关键词
code996 --self --ignore-author "bot"             # 可以组合使用多个过滤条件
code996 -y 2025 --ignore-author "renovate|dependabot" --ignore-msg "^Merge" # 综合过滤
```

**常见排除场景**：

```bash
# 排除所有 CI/CD 机器人
--ignore-author "bot|jenkins|github-actions|gitlab-ci|circleci|travis"

# 排除依赖更新机器人
--ignore-author "renovate|dependabot|greenkeeper"

# 排除合并和格式化提交
--ignore-msg "^Merge|^merge|lint|format|prettier"

# 排除自动生成的提交
--ignore-msg "^chore|^build|^ci|auto"
```

## 它怎样工作

1. 使用 git-log 获取项目 commit 的相关数据
2. 本地计算分析，并打印出展示结果

### 数据采集流程

```
Git 仓库 → git log 采集 → 日级首提 + 小时分布 → 分位数推算上/下班 → 996 指数计算 → 结果输出
```

### 关键算法

1. **时间分布分析**：
   - 数据采集：按分钟级别采集提交时间，自动聚合为48个半小时点
   - 算法处理：自动聚合为24小时用于工作时间识别和996指数计算
   - 展示模式：默认按小时展示（24点），可选半小时模式（48点）
2. **工作时间识别**：使用最近样本的 10%-20% 分位估算上班时间区间，并结合晚间提交拐点推算下班时间
3. **996 指数计算**：依据加班比例构建指数，并输出中文描述
4. **跨时区协作检测**：通过时区离散度和"睡眠时段"提交比例识别跨时区项目（阈值：非主导时区 >1%），并提供时区过滤建议
5. **数据验证**：检验统计数据是否与总提交数一致，避免缺失导致的偏差
6. **算法优势**：新版本采用分位数与拐点估算，能更智能地排除深夜零星提交的干扰，精准定位真实的工作时间窗口

## 使用提示

- 隐私保护：所有对 Git 数据的分析均在本地进行，不会上传任何结果或日志。
- 分析局限性：工具仅统计 git log 中的 commit 时间。然而，实际工作还还包括开会、学习、维护文档、调试自测等活动。因此，报告无法覆盖全部的实际工作时间，分析结果准确性有限，请谨慎参考。
- 使用限制：本项目分析结果仅供个人参考，请勿用于 “作恶” 或不当用途。
- 免责声明：code996 不对使用、传播本程序及附属产物造成的任何后果承担任何责任。

## 关于 AI

🤖 **AI 协作伙伴注意**：本项目采用标准化的 AI 协作流程，详情请查看 [.docs/README.md](.docs/README.md) 中的协作规范。

特别鸣谢：本项目使用 KwaiKAT 的 [KAT-Coder-Pro V1](https://streamlake.com/product/kat-coder) 进行开发，感谢 KwaiKAT 提供的免费 token。

## 📄 许可证

MIT License
