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
      localAnalysis: '你也可以选择运行 shell 命令：（此为旧版本，功能更少）',
      scriptUrl: 'https://fastly.jsdelivr.net/gh/hellodigua/code996/bin/code996.sh',
      onlineAnalysis: '在线分析 Gitlab 项目，可以使用该',
      userscript: '油猴脚本',
    },
    howItWorks: {
      title: '它怎样工作',
      step1: '1. 使用 git-log 对项目当前的分支进行查询，得到以小时汇总和以天汇总的 commit 统计结果',
      step2: '2. 将本地脚本得到的查询结果转为 URL 参数，并打开 URL 到浏览器',
      step3: '3. 从 URL 拿到数据，并使用一些规则处理，并将结果可视化展现',
    },
    whatIsItFor: {
      title: '它有什么用',
      intro: '它可以帮助你分辨 996 的公司和行为并远离它，具体包括：',
      point1: '1. 在入职的当天即可知道新公司的加班情况如何',
      point2: '2. 对比不同项目的加班强度',
    },
    safety: {
      title: '它安全吗',
      point1: '1. 脚本端和 Web 端均不会收集任何数据',
      point2: '2. 除分析的起始时间、commit结果等通用数据外，URL 本身不泄露如项目名等敏感信息',
      point3: '3. 所有代码均已开源到',
      point3Link: 'GitHub',
      point3End: '，接受社区监督',
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
      q3: 'Q：脚本遇到问题？',
      q3a1: '无法使用 curl 的 Windows 用户， 可下载',
      q3a1Link: '该脚本',
      q3a1LinkUrl: 'https://fastly.jsdelivr.net/gh/hellodigua/code996/bin/code996.sh',
      q3a1End: '并使用',
      q3a2: '备用脚本地址：',
      q3a2ScriptUrl: 'https://raw.githubusercontent.com/hellodigua/code996/master/bin/code996.sh',
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
