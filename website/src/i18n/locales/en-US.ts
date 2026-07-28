export default {
  common: {
    back: 'Back',
    viewDemo: 'View Demo',
    switchMirror: 'Switch Mirror:',
    madeWithLove: 'Made with ❤️ by',
    // 新增页脚文案
    license: 'license',
  },
  nav: {
    title: '#CODE996 Result',
  },
  intro: {
    title: '#CODE996',
    subtitle:
      'Code996 is an analysis tool that can count the commit time distribution of Git projects, and then deduce the coding work intensity of this project.',
    howToUse: {
      title: 'How to Use',
      nodeJsTip:
        'If you have Node.js environment, simply run the following command in the root directory of your Git project:',
      copy: 'Copy',
      copied: 'Copied',
      copyFailed: 'Copy manually',
    },
    howItWorks: {
      title: 'How It Works',
      step1:
        '1. Use git log to read repository commits locally and collect basic data such as commit times, authors, and time zones.',
      step2:
        '2. Analyze working hours, overtime ratios, monthly trends, project types, and team work patterns from commit activity.',
      step3: '3. Output a terminal report, a Markdown report, or a visual report that opens as a local web page.',
    },
    whatIsItFor: {
      title: 'What Is It For',
      intro: 'It helps you understand the work patterns of projects and teams, including:',
      point1: '1. Identify weekday overtime, weekend work, and late-night commits.',
      point2: '2. Track monthly changes in working hours and the 996 index.',
      point3: '3. Compare work patterns across repositories or team members.',
    },
    safety: {
      title: 'Is It Safe',
      point1: '1. All Git data is analyzed locally. Repository data and analysis results are never uploaded.',
      point2:
        '2. Local reports may contain repository paths and contributor information. Store and share them carefully.',
      point3: '3. All source code is available on',
      point3Link: 'GitHub',
      point3End: ' for community review.',
    },
    faq: {
      title: 'Other Questions',
      q1: 'Q: What is the 996 index?',
      q1a1: 'The 996 index is a metric defined by this project to reflect project overtime intensity.',
      q1a2: 'After standardizing the overtime situation, we can conveniently compare the work intensity of cross-team and cross-company projects.',
      q2: 'Q: When are the analysis results of code996 inaccurate?',
      q2a1: 'The script counts the overall commit time of the project by default, representing the work status of all participants in the project during this period, which may deviate from personal actual conditions',
      q2a2: 'In addition to coding, we also need meetings, documentation, learning, taking breaks, etc., so it cannot cover actual working time',
      q2a3: 'Cross-national and cross-time zone development projects cannot be correctly counted',
      q2a4: 'Projects with irregular working hours (such as personal open source projects) cannot be counted either',
    },
  },
  result: {
    title: 'The 996 index of this project is:',
    workingType: 'Estimated work schedule type:',
    overtimeRatio: 'Your estimated overtime ratio:',
    notSaturated: '(Underutilized)',
    lowCommit: 'This project has too few commits, showing basic information only',
    openSource: 'This project is an open source project, showing basic information only',
    totalCommits: 'Total commits:',
    analysisTime: 'Analysis period:',
    indexExplanation:
      '996 Index: 0 means no overtime, the larger the value, the more serious the overtime. The value corresponding to the 996 work system is 100, and negative values indicate very relaxed work.',
    seeTable: 'Refer to the table below for details',
    charts: {
      hourDistribution: 'Commit Distribution by Hour',
      hourRatio: 'Overtime/Work Commit Ratio (by Hour)',
      dayDistribution: 'Commit Distribution by Day',
      dayRatio: 'Overtime/Work Commit Ratio (by Day)',
    },
    compareTable: 'Working Hours Reference Table:',
    notice: {
      title: 'Notice:',
      point1: 'Analysis results are for reference only and do not represent any recommendations',
      point2: 'Raw analysis data is transmitted through URLs, please share URLs with third parties carefully',
      point3: 'Please do not use in formal occasions',
    },
    // 新增表格相关文案
    table: {
      timeType: 'Time Type',
      dailyWorkTime: 'Daily Work Hours',
      weeklyWorkTime: 'Weekly Work Hours',
      weeklyOvertime: 'Weekly Overtime',
      overtimeRatio: 'Overtime Ratio',
      index996: '996 Index',
      highlightTip: '* Highlighted column shows estimated metrics for this project',
    },
    // 新增工作类型模板
    workingTypeTemplate: '{start}AM-{end}PM, {days} days/week',
    // 新增996指数趣味描述
    index996Descriptions: {
      excellent: ['Enviable work life', 'Congrats, no overtime culture', 'You are the lucky one in coding world'],
      good: ['You still have potential to exploit'],
      medium: ["Keep going, boss's Ferrari depends on you"],
      bad: ["You've maxed out your overtime quota"],
      terrible: ['You must be the king of overtime workers'],
    },
    // 新增时间标签
    timeLabels: {
      workday: 'Workdays',
      weekend: 'Weekends',
    },
    // 新增图表数据标签
    chartLabels: {
      work: 'Work',
      overtime: 'Overtime',
    },
    // 新增星期标签
    weekdays: {
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',
      sunday: 'Sun',
    },
  },
}
