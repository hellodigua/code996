# code996

code996 is an analysis tool that statistics Git project commit time distribution to deduce the coding work intensity of a project.

It helps you understand new team's working patterns and identify potential overtime culture.

**Easy to use, just one command: `npx code996`**

English | [简体中文](./README.md)

## What's It For

During interviews, we ask about overtime policies, but the answers aren't always truthful. However, code commit times don't lie, which is why this tool exists.

When you join a new company, run `npx code996` to see the truth behind the data and judge the real overtime culture.

Instead of suffering for three months, better see the truth early! Don't wait until your probation ends to regret!

## Features

- **📊 996 Index**: Convert complex overtime situations into intuitive numbers, see project intensity at a glance
- **🕰️ Smart Working Hours Detection**: Uses percentile and inflection point detection algorithms to accurately reconstruct team's real start/end work time windows
- **📈 Monthly Trend Tracking**: Identify whether the project is "getting more intense" or "stabilizing" through trends
- **📅 Multi-dimensional Overtime Profile**: Comprehensive analysis, identifying not only weekday/weekend overtime peaks but also the overtime ratio of team members
- **📦 Multi-repo Comparison**: One-click scan and analyze multiple repositories under a folder, auto-generate comparisons
- **🌍 Cross-timezone Detection**: Automatically identify timezone distribution, support specified timezone for precise analysis
- **🇨🇳 Chinese Holiday Support**: Built-in Chinese holiday and makeup workday logic, precisely exclude holiday interference
- **🔒 Privacy Safe**: Pure local execution, offline analysis based on git log

## Preview

#### Core Results

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo1.png" alt="Core Results Preview" style="width:600px; max-width:100%; height:auto;"/>

<details>
<summary>

### Other Module Previews Click to Expand →

</summary>

#### Commit Time Distribution

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo2.png" alt="Commit Time Distribution" style="width:400px; max-width:100%; height:auto;"/>

#### Overtime Analysis

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo3.png" alt="Overtime Analysis" style="width:600px; max-width:100%; height:auto;"/>

#### Monthly Trend Analysis

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo4.png" alt="Monthly Trend Analysis" style="width:600px; max-width:100%; height:auto;"/>

#### Team Work Pattern Analysis

<img src="https://raw.githubusercontent.com/hellodigua/code996/main/public/images/demo5.png" alt="Team Work Pattern Analysis" style="width:600px; max-width:100%; height:auto;"/>

</details>

## 🚀 Quick Start

First make sure you have Node.js installed locally, then:

```bash
# Run in current repo or parent directory of repos
npx code996
```

You can also install it first so you don't have to re-download every time:

```bash
# Global install
npm i -g code996

# Use
code996
```

## 🤖 Smart Analysis Mode

code996 automatically selects the most suitable analysis mode based on context:

- **Running in a Git repo** → Single repo deep analysis
- **Multiple repos in directory** → Auto-enter multi-repo analysis mode

```bash
# Smart detection, auto-select analysis mode
code996                    # Smart detect current environment
code996 /path/to/repo      # Analyze specified repo
code996 /proj1 /proj2      # Auto-enter multi-repo mode
code996 /workspace         # Auto-scan subdirectories
```

## 📖 Detailed Usage

### Time Range Options

| Option           | Short | Description                                                                  |
| ---------------- | ----- | ---------------------------------------------------------------------------- |
| `--year <year>`  | `-y`  | Specify year or year range (recommended). Single: `2025`; Range: `2023-2025` |
| `--since <date>` | `-s`  | Custom start date (YYYY-MM-DD)                                               |
| `--until <date>` | `-u`  | Custom end date (YYYY-MM-DD)                                                 |
| `--all-time`     | -     | Cover entire repository history                                              |

### Filter & Display Options

| Option                    | Short | Description                                                                         |
| ------------------------- | ----- | ----------------------------------------------------------------------------------- |
| `--hours <range>`         | `-H`  | Specify standard working hours (e.g., 9-18) ⭐ **Recommended for accurate results** |
| `--half-hour`             | -     | Display in half-hour granularity (default hourly) 📊 More precise                   |
| `--timezone <offset>`     | -     | Specify timezone (e.g., +0800, -0700) 🌍 For cross-timezone teams                   |
| `--cn`                    | -     | Force enable Chinese holiday mode (+0800 auto-enabled)                              |
| `--self`                  | -     | Only count current Git user's commits                                               |
| `--ignore-author <regex>` | -     | Exclude authors matching regex (e.g., `bot\|jenkins`)                               |
| `--ignore-msg <regex>`    | -     | Exclude commits matching regex (e.g., `^Merge\|lint`)                               |

### Usage Examples

```bash
# ===== Single Repo Analysis (Smart Mode) =====
code996                        # Analyze current repo (past year)
code996 /path/to/repo          # Analyze specified repo
code996 -y 2025                # Analyze year 2025
code996 -y 2023-2025           # Analyze 2023-2025
code996 -s 2025-01-01 -u 2025-06-30  # Custom date range (first half of year)
code996 --since 2024-07-01     # Analyze from specified date to now
code996 --all-time             # Query entire repo history
code996 --self                 # Only analyze current user's commits
code996 --self -y 2025         # Analyze your commits in 2025

# ===== Multi-repo Analysis (Smart Auto-detect) =====
code996                        # If subdirs have multiple repos, auto-enter multi-repo mode
code996 /path/proj1 /path/proj2  # Pass multiple paths, auto-analyze multiple repos
code996 /workspace             # Scan all sub-repos in specified directory
code996 /workspace -y 2025     # Analyze 2025 data and trends
code996 --self                 # Only count current user's commits across all repos

# Specify Working Hours (Recommended)
code996 --hours 9.5-18.5       # Specify 9:30-18:30 (supports decimals)
code996 --hours 9.5-19 -y 2025 # Combine with year analysis

# Fine-grained Analysis (Half-hour Granularity)
code996 --half-hour            # Display time distribution in half-hour granularity
code996 -y 2025 --half-hour    # Combine with year analysis, fine display
code996 /proj1 /proj2 --half-hour  # Multi-repo analysis, half-hour granularity

# Cross-timezone Project Analysis
code996 --timezone="+0800"     # Only analyze commits from UTC+8 (China)
code996 --timezone="-0700"     # Only analyze commits from UTC-7 (US West Coast)
code996 -y 2025 --timezone="+0800"  # Analyze 2025 commits in specific timezone

# Chinese Holiday Makeup Workday Analysis
code996                        # System auto-enables holiday mode when primary timezone is +0800
code996 --cn                   # Manually force enable holiday mode (for non +0800 timezone projects)
code996 --timezone="-0700" --cn # Analyze non-China timezone project but judge by Chinese holidays

# Filter Noise Data (Exclude CI/CD bots, merge commits, etc.)
code996 --ignore-author "bot"                    # Exclude all authors containing "bot"
code996 --ignore-author "bot|jenkins|github-actions"  # Exclude multiple authors (use | to separate)
code996 --ignore-msg "^Merge"                    # Exclude all commit messages starting with "Merge"
code996 --ignore-msg "merge|lint|format"         # Exclude multiple keywords
code996 -y 2025 --ignore-author "renovate|dependabot" --ignore-msg "^Merge" # Combined filter
```

**Common Exclusion Scenarios**:

```bash
# Exclude all CI/CD bots
--ignore-author "bot|jenkins|github-actions|gitlab-ci|circleci|travis"

# Exclude dependency update bots
--ignore-author "renovate|dependabot|greenkeeper"

# Exclude merge and formatting commits
--ignore-msg "^Merge|^merge|lint|format|prettier"

# Exclude auto-generated commits
--ignore-msg "^chore|^build|^ci|auto"
```

## How It Works

1. Use git-log to get project commit related data
2. Local computation and analysis, then print display results

### Data Collection Flow

```
Git Repo → git log collection → Daily first commit + Hourly distribution → Percentile estimation of start/end work → 996 Index calculation → Result output
```

### Key Algorithms

1. **Time Distribution Analysis**:
   - Data collection: Collect commit times at minute-level, auto-aggregate into 48 half-hour points
   - Algorithm processing: Auto-aggregate into 24 hours for work time identification and 996 index calculation
   - Display mode: Default hourly display (24 points), optional half-hour mode (48 points)
2. **Work Time Identification**: Use 10%-20% percentile of recent samples to estimate start work time window, combined with evening commit inflection point to estimate end work time
3. **996 Index Calculation**: Build index based on overtime ratio, output Chinese description
4. **Project Type Identification**: Through work time regularity, weekend activity, evening activity patterns, auto-identify whether project is "corporate project" or "open source project"
5. **Cross-timezone Collaboration Detection**: Identify cross-timezone projects through timezone dispersion and "sleep period" commit ratio (threshold: non-dominant timezone >1%), provide timezone filter suggestions
6. **Holiday Makeup Workday Recognition**: When primary timezone is +0800 and accounts for >50%, auto-enable Chinese holiday judgment (workday/weekend considers legal holidays and makeup workdays), other timezones can manually enable via `--cn` parameter
7. **Data Validation**: Verify statistical data matches total commit count, avoid deviation from missing data
8. **Algorithm Advantages**: New version uses percentile and inflection point estimation, can more intelligently filter out late-night sporadic commits, precisely locate real work time windows

## Usage Tips

- Privacy Protection: All Git data analysis is performed locally, no results or logs are uploaded.
- Analysis Limitations: The tool only counts commit times in git log. However, actual work also includes meetings, learning, maintaining documentation, debugging, testing, etc. Therefore, reports cannot cover all actual work time, analysis results have limited accuracy, please use with caution.
- Usage Restrictions: This project's analysis results are for personal reference only, please do not use for "evil" or improper purposes.
- Disclaimer: code996 is not responsible for any consequences caused by using, distributing this program and its derivatives.

## Other Questions

> Here are some common questions. If you have other questions, feel free to open an issue.

### 💡 Need code to analyze, isn't it too late to use after joining?

Not really. The core value of code996 is breaking information asymmetry, using real data to counter verbal promises.

1. Probation is "inspection period": Joining doesn't mean selling yourself. The legal probation period is also our inspection period for the company. If you find it's a pit on day one, cutting losses early is also an avoidance strategy.
2. Background check during referral: Think bigger! You can totally ask your inside friend at that company to run it for you. Isn't that the most hardcore referral background check? 🐶
3. Decision basis: Even after joining, having solid overtime evidence in hand, whether to use it as reason for transfer, or as basis for resignation decision, is much better than self-doubt.

### 📉 Will Squash commits affect accuracy if the project habit is local multiple commits then Squash before push?

There will be some impact, but code996 relies on statistical patterns. As long as commit samples reach a certain number, what's finally shown is the team's collective work pattern, special commit habits will be filtered out as "noise" statistically.

### 🛡️ Why not support viewing individual member's 996 index?

Although technically feasible, we deliberately abandoned this feature:

Viewing 996 index by user, this feature is too easy to be misused and abused. It can easily be used by some people to analyze team members' "overtime situation".

Although I've emphasized the tool's limitations more than once (actual work also includes meetings, learning, maintaining documentation, debugging, testing, etc.), you just can't stop some people from only looking at numbers 🤦

The original intention of this project is to help avoid pit projects, not to provide new ammunition for internal competition. Therefore, the project only provides two perspectives: viewing team and viewing yourself (--self).

Finally, code commit volume and timing don't equal work output. If used for performance evaluation, it will not only cause the team to produce lots of junk commits for stats, but also destroy team trust.

### 🚀 What's the project roadmap?

Future features will follow the WLB and work pit-avoidance line, including: more refined overtime ratio analysis, and analyzing code's shit-mountain index (complexity analysis), after all maintaining shit-mountains is also one of the culprits of 996.

## AI Collaboration

🤖 **Note for AI Collaboration Partners**: This project adopts standardized AI collaboration workflow, please check [.docs/README.md](.docs/README.md) for collaboration guidelines.

## 📄 License

MIT License
