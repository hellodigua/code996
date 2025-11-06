import { Command } from 'commander';

export const helpCommand = new Command('help')
  .description('显示帮助信息')
  .action(() => {
    console.log(`
code996-cli - Git 996 指数分析工具

使用方法:
  code996 [选项]

命令:
  help              显示帮助信息

全局选项:
  -h, --help        显示帮助信息

分析选项:
  -s, --since <date>      开始日期 (YYYY-MM-DD)
  -u, --until <date>      结束日期 (YYYY-MM-DD)
  --all-time              查询所有时间的数据（覆盖整个仓库历史）

默认策略:
  自动以最后一次提交为基准，回溯365天进行分析

示例:
  code996
  code996 --since 2024-01-01
  code996 --all-time

更多详情请访问: https://github.com/code996/code996-cli
    `);
  });
