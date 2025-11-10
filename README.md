# code996

code996 是一个分析工具，它可以统计 Git 项目的 commit 时间分布，进而推导出项目的编码工作强度。

它可以帮助你了解新团队工作的时间模式，识别潜在的加班文化。

<!-- 简体中文 | [English](./README-en_US.md) -->

> 该项目为 Node.js 新版本，功能更强大，旧版本已迁移至 [code996-web](https://github.com/hellodigua/code996-web)。

## 它的用途

面试时我们会询问面试官加班情况，但得到的答案往往不太真实。

但是代码的提交时间不会骗人，因此就有了这个工具。

当你入职新公司，跑一下 `npx code996`，就可以看到数据背后的真相，从而判断这家公司的真实加班文化。

## 预览

### 查看核心结果

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo1.png" alt="核心结果预览" style="width:600px; max-width:100%; height:auto;"/>

### 查看提交时间分布

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo2.png" alt="提交时间分布图" style="width:400px; max-width:100%; height:auto;"/>

### 加班情况分析

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo3.png" alt="加班情况分析图" style="width:600px; max-width:100%; height:auto;"/>

### 综合建议

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo4.png" alt="综合建议图" style="width:600px; max-width:100%; height:auto;"/>

## 🚀 快速开始

无需安装，快速使用：

```bash
# 在当前仓库运行分析（默认查询以上次提交为终点开始365天的commit）
npx code996
```

你也可以选择安装后再使用，这样就不用每次都重新下载：

```bash
# 全局安装
npm i -g code996

# 使用
code996
```

## 📖 详细使用说明

### 命令与选项

- `trend`：查看月度996指数和工作时间的变化趋势
- `ranking`：统计排序所有提交者的996指数（卷王排行榜）🆕
- `help`：显示帮助信息

- `-y, --year <year>`：指定年份或年份范围（推荐）
  - 单年格式：`2025` → 分析 2025-01-01 至 2025-12-31
  - 范围格式：`2023-2025` → 分析 2023-01-01 至 2025-12-31
- `-s, --since <date>`：自定义开始日期 (YYYY-MM-DD)
- `-u, --until <date>`：自定义结束日期 (YYYY-MM-DD)
- `--all-time`：覆盖整个仓库历史数据
- `--self`：仅统计当前 Git 用户的提交记录（等价于自动推断对应的 `--author`）
- `--author <name>`：仅统计指定作者的提交（支持名称或邮箱部分匹配，适用于所有命令）🆕
- `--exclude-authors <names>`：排除指定作者（逗号分隔，支持名称或邮箱部分匹配，适用于所有命令，可用于排除 bot/CI）🆕
- `--merge`：合并同名不同邮箱的作者统计（适用于 `ranking` 和 `trend` 命令）🆕

### 使用示例

```bash
# 按年份分析
code996 -y 2025                # 分析2025年
code996 -y 2023-2025           # 分析2023-2025年

# 精确时间范围
code996 --since 2024-01-01 --until 2024-06-30

# 查询整个仓库历史
code996 --all-time

# 仅分析当前用户的提交记录
code996 --self
code996 --self -y 2025         # 分析自己在2025年的提交
code996 trend --self           # 查看自己的趋势分析

# 🆕 查看卷王排行榜
code996 ranking                # 查看所有提交者的996指数排名
code996 ranking -y 2024        # 查看2024年的排名
code996 ranking --author 张三   # 查看指定作者的详细信息
code996 ranking --exclude-authors bot,CI  # 排除机器人账号

# 🆕 过滤示例（同样适用于 trend / 基础分析）
code996 --author alice         # 只看 alice 的整体分析
code996 trend --exclude-authors bot,CI,dependabot  # 趋势分析中排除自动化账号

# 🆕 合并同名作者（处理一人多邮箱的情况）
code996 ranking --merge        # 自动合并同名不同邮箱的作者
code996 ranking --merge --exclude-authors jenkins  # 合并作者并排除机器人
code996 trend --merge -y 2025  # 查看合并后的月度趋势
```

## 🔄 作者合并功能

在实际项目中，同一个开发者可能使用不同的邮箱或名称提交代码（例如个人邮箱、公司邮箱、不同电脑的配置等）。`--merge` 选项可以智能识别并合并这些身份的统计数据。

### 合并规则

- **按名称分组**：工具会按照作者名称（不区分大小写）进行分组
- **智能去重**：同一名称下的不同邮箱会被识别为同一作者
- **主身份选择**：自动选择提交数最多的邮箱作为主身份
- **数据合并**：将所有身份的提交数、996指数、加班率等指标合并计算

### 使用场景

```bash
# 场景1: 发现排行榜中有重复的同名作者
code996 ranking --all-time
# 输出：jinxin (586 commits), jinxin3 (586 commits) ← 疑似同一人

code996 ranking --all-time --merge
# 输出：jinxin3 (1172 commits) ← 已合并

# 场景2: 排除机器人后合并真实作者
code996 ranking --exclude-authors bot,ci,jenkins --merge

# 场景3: 查看合并后的趋势变化
code996 trend --merge -y 2024
```

### 效果对比

| 功能 | 不使用 --merge | 使用 --merge |
|------|----------------|--------------|
| 作者数量 | 14 | 7 |
| 数据准确性 | 分散到多个身份 | 聚合为真实个人 |
| 排名准确性 | 可能低估真实贡献 | 反映真实工作量 |

## 它怎样工作

1. 使用 git-log 获取项目 commit 的相关数据
2. 本地计算分析，并打印出展示结果

### 数据采集流程

```
Git 仓库 → git log 采集 → 日级首提 + 小时分布 → 分位数推算上/下班 → 996 指数计算 → 结果输出
```

### 关键算法

1. **时间分布分析**：按小时、按星期统计提交数量，绘制 24 小时热力条形图
2. **工作时间识别**：使用最近样本的 10%-20% 分位估算上班时间区间，并结合晚间提交拐点推算下班时间
3. **996 指数计算**：依据加班比例构建指数，并输出中文描述
4. **数据验证**：检验统计数据是否与总提交数一致，避免缺失导致的偏差
5. **算法优势**：新版本采用分位数与拐点估算，能更智能地排除深夜零星提交的干扰，精准定位真实的工作时间窗口

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
