export default {
  common: {
    back: '返回',
    viewDemo: '查看示例结果',
    switchMirror: '切换镜像节点',
    madeWithLove: 'Made with ❤️ by',
    // 新增页脚文案
    license: '协议',
  },
  nav: {
    title: '#CODE996 Result',
  },
  intro: {
    title: '#CODE996',
    subtitle: 'code996 是一个分析工具，它可以统计 Git 项目的 commit 时间分布，进而推导出这个项目的编码工作强度。',
    howToUse: {
      title: '如何使用',
      nodeJsTip: '如果你有 Node.js 环境，只需在 Git 项目的根目录执行以下命令：',
      copy: '复制',
      copied: '已复制',
      copyFailed: '请手动复制',
    },
    howItWorks: {
      title: '它怎样工作',
      step1: '1. 使用 git log 在本地读取仓库提交记录，得到提交时间、作者和时区等基础数据。',
      step2: '2. 根据提交规律分析工作时间、加班比例、月度趋势、项目类型和团队工作模式。',
      step3: '3. 输出终端报告、Markdown 报告，或可在本地网页中打开的可视化报告。',
    },
    whatIsItFor: {
      title: '它有什么用',
      intro: '它可以帮助你了解项目和团队的工作节奏，包括：',
      point1: '1. 识别工作日加班、周末工作和深夜提交。',
      point2: '2. 观察工作时间和 996 指数的月度变化。',
      point3: '3. 对比不同仓库或团队成员的工作模式。',
    },
    safety: {
      title: '它安全吗',
      point1: '1. 所有 Git 数据分析均在本地完成，不会上传仓库数据或分析结果。',
      point2: '2. 本地报告可能包含仓库路径和贡献者信息，请谨慎保存和分享。',
      point3: '3. 所有代码均已开源到',
      point3Link: 'GitHub',
      point3End: '，接受社区监督。',
    },
    faq: {
      title: '其他问题',
      q1: 'Q：996 指数是什么？',
      q1a1: '996 指数是本项目定义的，用于反映项目加班情况的数据指标。',
      q1a2: '在对加班情况标准化之后，我们可以方便的对跨团队、跨公司项目的工作强度进行对比。',
      q2: 'Q：什么情况下 code996 的分析结果不准确？',
      q2a1: '脚本默认统计的是项目整体的提交时间，代表了项目中的所有参与者在这段时间的工作状态，可能与个人的实际情况有偏差',
      q2a2: '除了 coding，我们还需要开会、写文档、学习、摸鱼等，因此它也无法覆盖实际的工作时间',
      q2a3: '跨国、跨时区开发的项目无法正确统计',
      q2a4: '工作时间不固定的项目(如个人开源项目)也无法统计',
    },
  },
  result: {
    title: '该项目的 996 指数是：',
    workingType: '推测你们的工作时间类型为：',
    overtimeRatio: '推测你们的加班时间占比为：',
    notSaturated: '(工作不饱和)',
    lowCommit: '该项目的 commit 数量过少，只显示基本信息',
    openSource: '该项目为开源项目，只显示基本信息',
    totalCommits: '总 commit 数：',
    analysisTime: '分析时间段：',
    indexExplanation: '996 指数：为 0 则不加班，值越大代表加班越严重，996 工作制对应的值为 100，负值说明工作非常轻松。',
    seeTable: '具体可参考下方表格',
    charts: {
      hourDistribution: '按小时 commit 分布',
      hourRatio: '加班/工作 commit 占比（按小时）',
      dayDistribution: '按天 commit 分布',
      dayRatio: '加班/工作 commit 占比（按天）',
    },
    compareTable: '工作时间参照表：',
    notice: {
      title: '注意事项：',
      point1: '分析结果仅供参考，不代表任何建议',
      point2: '原始分析数据通过 URL 传输，请慎重分享 URL 给第三方',
      point3: '请勿用于正式场合',
    },
    // 新增表格相关文案
    table: {
      timeType: '时间类型',
      dailyWorkTime: '日均工作时长',
      weeklyWorkTime: '每周工作时长',
      weeklyOvertime: '每周加班时长',
      overtimeRatio: '加班时间占比',
      index996: '996指数',
      highlightTip: '* 高亮列为该项目的估算指标',
    },
    // 新增工作类型模板
    workingTypeTemplate: '早 {start} 晚 {end} 一周 {days} 天',
    // 新增996指数趣味描述
    index996Descriptions: {
      excellent: ['令人羡慕的工作', '恭喜，你们没有福报', '你就是搬砖界的欧皇吧'],
      good: ['你还有剩余价值'],
      medium: ['加油，老板的法拉利靠你了'],
      bad: ['你的福报已经修满了'],
      terrible: ['你们想必就是卷王中的卷王吧'],
    },
    // 新增时间标签
    timeLabels: {
      workday: '工作日',
      weekend: '周末',
    },
    // 新增图表数据标签
    chartLabels: {
      work: '工作',
      overtime: '加班',
    },
    // 新增星期标签
    weekdays: {
      monday: '周一',
      tuesday: '周二',
      wednesday: '周三',
      thursday: '周四',
      friday: '周五',
      saturday: '周六',
      sunday: '周日',
    },
  },
}
