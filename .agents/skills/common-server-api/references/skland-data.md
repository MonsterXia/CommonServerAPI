# 森空岛显示规则

核对于 2026-10-03。API 是上游当前实现，非稳定协议承诺。原始凭证、用户录屏及真实响应不得存入仓库；回归使用合成数据。

## 来源与读取流程

- [官方明日方舟页面](https://game.skland.com/)：[formatter](https://bbs.hycdn.cn/skland-fe-static/skland-game/main-0a037d97.3091b5d8.js)、[读取 SDK](https://bbs.hycdn.cn/skland-fe-static/skland-game/9560.b49ee94b.js)。
- [官方终末地页面](https://game.skland.com/endfield/game-data)：[字段 codec](https://assets.skland.com/_static_assets/game-tools/dist-BZImVwlH.js)、[页面规则](https://assets.skland.com/_static_assets/game-tools/GameData-CKtD4-ed.js)、[探索表格](https://assets.skland.com/_static_assets/game-tools/RegionExploreTable-D36RE3Dz.js)、[中文词条](https://assets.skland.com/_static_assets/game-tools/locales/zh_Hans.json)、[英文词条](https://assets.skland.com/_static_assets/game-tools/locales/en.json)。
- 开源交叉核对：[ArkScreen RealTimeMapper](https://github.com/blueskybone/ArkScreen/blob/3ab5e7f90c45a8e3925fae827ade54f9848116d6/app/src/main/java/com/blueskybone/arkscreen/data/repository/mapper/RealTimeMapper.kt)、[arknights-plugin](https://github.com/gxy12345/arknights-plugin/blob/master/model/sklandApi.js)、[终末地字段模型](https://github.com/FrostN0v0/nonebot-plugin-skland/blob/master/nonebot_plugin_skland/schemas/endfield/card.py)。

上述官方/开源明日方舟读取流程直接 GET player/info，未发现必须先调用的强制游戏同步接口。auth/refresh 是凭证刷新；SDK 中的 gameplat/game/refresh 属于 Steam 游戏，不能用于方舟。上游同步可能延迟，不能承诺重新读取一定强制同步游戏。

## 时钟和资源

`updatedAt`=游戏快照时间，`fetchedAt`=服务读取时间，`calculatedAt`=上游 currentTs（终末地优先 detail.currentTs）。全部 Unix 秒，显示时按浏览器时区格式化。前端以收到数据时的内存基准推进 calculatedAt，缓存切换不重置基准；不以客户端与上游绝对时钟的差值增加资源，不增加后台轮询。

| 游戏/字段 | 显示规则 |
| --- | --- |
| 方舟理智 | current + floor((currentTs-lastApAddTime)/360)，到 completeRecoveryTime 回满。-1 不恢复；超上限保留。 |
| 方舟无人机 | value + floor((maxValue-value) × elapsed/remainSecs)；满仓期限 lastUpdateTime+remainSecs。禁止固定通用恢复速率。 |
| 终末地理智 | 直接 curStamina/maxStamina，maxTs 仅用于回满时间；0 表示无需倒计时。不套用方舟公式。 |
| 方舟日/周任务和剿灭 | 根据 storeTs 与北京时间04:00重置比较；周一重置周任务/剿灭。保全派驻奖励每月16日04:00重置（不是旧版每月1、16日）。 |

零值有效；缺失/非法值 null；进度条仅用于正上限并最多100%。上游未提供基准，不编造恢复。静态图像和映射在前端发布，不增加图片代理或逐干员请求。

## 方舟基建与记录

- 贸易站：有驻员且时间有效，达到 completeWorkTime 后首份订单+1，之后按官方三小时近似估算，受 stockLimit 限制。completeAt 表示下一份订单，不是整个仓库完成。
- 制造站：使用 manufactureFormulaInfoMap 的重量/耗时、房间速度、队列和驻员 AP，按官方 boosted/normal 两阶段近似式；不自行模拟技能。公式可能产生非正工作时间，保留官方产物数但不输出虚构完成时间。缺少关键字段不估算。
- 宿舍：恢复率 `(1.5 + 0.1*level + 0.0004*comfort)*100`，满心情8640000；数量为已回满驻员/驻员总数。疲劳干员去重并排除宿舍成员。
- 公招：0锁定、1空闲、2招募中、3完成；finishTs到达则完成。可用总数含空闲与完成。办公室可刷新状态不等于精确次数，refreshCount保持快照，不按12小时猜未来次数。
- 训练室：targetSkill=-1空闲；remainSecs相对于currentTs，不能再从lastUpdateTime扣除。
- 会客室：board数组数量/7；自有、收到、待领取线索分别显示。dailyReward布尔含义未核实，不展示。
- 收藏总数扣除额外阿米娅形态，只保留char_002_amiya；档案列表仍可展示全部形态。稀有度及潜能rank均+1；medal.total为蚀刻章数量。
- 活动按SIDESTORY/BRANCHLINE且非复刻筛选，汇总zones的通关/总数；集成战略收藏品与投资分开；剿灭maxKills、保全best保留来源数值，不臆造上限。生息演算与引航者试炼按文末已核实的专属规则显示，不透传未知嵌套对象。缺失主线进度不推断“全部完成”。
- 主线进度：官方 [账号组件](https://bbs.hycdn.cn/skland-fe-static/skland-game/8624.b27ec983.js) 将 `status.mainStageProgress === ""` 精确映射为“全部完成”。后端保留这个空字符串哨兵，前端仅对方舟本地化为“全部完成 / All completed”；null、缺失、空白或非法值仍表示未提供。非空值按 stageInfoMap 的 code/name/原 ID 显示；不得通过等级推断通关，也不得将此规则套用终末地任务。OpenAPI 与两端类型须保留此语义。

## 终末地

- level=权限等阶，worldLevel=探索等级，createTime=苏醒日；收藏总数来自base，不能用展示干员列表长度替代。
- 干员ID优先char.id，rarity_6直接显示6，potentialLevel保持原值（0有效）；职业/属性保留上游名称。详细技能/装备不在brief返回中，不进行N+1请求补全。
- 帝江号房间type：0总控、1制造、2培养、5会客，按此顺序；驻员容量3。地区moneyMgr=调度券，据点remainMoney/moneyMax=储存量。
- 探索分子/分母来自domain.levels，不能用只有分子的collections臆造上限；total=0显示横线。保留六类计数；未核实的新增图标名称采用保守分类文案，不猜玩法奖励。piece对应维修灵感点。
- 光荣之路等级为level+achievementData.initLevel-1，分别统计1/2/3级。
- 战争回响赛季/周期星数最多9，挑战最多3；9星且allPlusTasks为S+，9为S、7为A、5为B、3为C、1为D；赛季结束不代表挑战完成。
- 影拓丰碑显示当前第一组，普通/困难isPass计算已通过数量/2；活动显示activityName。缺少布尔值不视为未通过。

## 验证

后端 normalizer 测试覆盖时间边界、负哨兵、超上限、缺失值、计数、公式和 OpenAPI parse；前端测试覆盖缓存时钟、中英文、过期状态及零上限。生产验证使用已有登录页面的只读角色查询，不触发短信、签到或账号变更。官方前端 hash 更新时重新核对规则，不盲目替换下载文件。


## 生息演算与引航者试炼（2026-10-04）

官方页面模块 [8624.b27ec983.js](https://bbs.hycdn.cn/skland-fe-static/skland-game/8624.b27ec983.js) 的 `Ho` 生息演算渲染器及 SDK [9560.b49ee94b.js](https://bbs.hycdn.cn/skland-fe-static/skland-game/9560.b49ee94b.js) 的 `getAkActInfo` 为字段依据；只作文本检查，不执行下载的模块。手机截图用于核对标签，不将账号数值写入规则或测试。

- 生息演算显示原始 sandbox 数组的最后一条（官方先倒序，再仅渲染第一条）。保留 id/name，专属 `sandbox` 对象只挑选已核实字段。
- maxDay / maxDayChallenge：常规模式 / “险途”测试演算生存日。mainQuest > 0、> 1、> 2 分别完成“疯狂的掠夺者”“暗沙涌动”“阿尔萨兰之影”；未知不等于未完成。
- subQuest 的 id/name/done 映射 subQuests；done true/false/null 分别为已完成/未完成/未提供，不强制转换字符串或数字。
- baseLv 为驻扎地等级；unlockNode 为累计探索区块次数；**enemyKill 为成功抵御敌袭次数，不能显示成击杀敌人数**；createRift 为陌域探访次数；fixRift[0]/[1] 为固有陌域委托完成数/总数。
- 所有数量保留 0，缺失/非法为 null；未知上限不画进度条。不能通过“玩过”、基地等级或另一个统计值推断任务完成。
- bossRush 数组按官方倒序，picUrl 是横幅。record.played 明确 false 才显示暂无记录，null 显示未提供；true 时解析 difficulty：NORMAL 初始、TEAM 定向、EX 恢弘、SP 最终试炼，stageId 在 stageInfoMap 查 code。未知难度保持 null，不能默认初始试炼。
- `act{数字}bossrush` 的数字为期数（补足两位）；不认识的 ID 不猜期数。即使 picUrl 缺失也保留文字记录。
- 剿灭 maxKills >= 400 显示已完成，保全 best 只显示最高进度，不伪造统一上限。


## 日常状态卡片与倒计时（2026-10-04）

官方首页当前仍加载上述 formatter；账号组件列出九项：理智、训练室、公开招募、公招刷新、每周报酬合成玉、每日任务、每周任务、数据增补仪、数据增补条。

- 理智倒计时来自 `status.ap.completeRecoveryTime`（概览 `recoveryAt`）；训练来自 `building.training.remainSecs + currentTs`，公招全部完成取未完成槽位 `finishTs` 最大值，刷新次数获取时间来自 `building.hire.completeWorkTime`（均已规范化为详情 `completeAt`）。训练保留干员姓名和设备空闲/专精完成说明；公招已完成含空闲可用槽位，与官方一致。
- 日常、周常/剿灭倒计时是按北京时间每日/每周一04:00计算，不是接口返回的说明字符串。前端复用上游计算时钟及内存接收基准，不按浏览器本地时区计算，不增加轮询，过界只调整展示副本；缺失仍为缺失。
- 保全奖励现在是每月16日04:00刷新；[官方2026年6月公告](https://ak.hypergryph.com/news/7364)、[官方5月公告](https://ak.hypergryph.com/news/4935)均列明16日04:00奖励进度更新。2026-10-04核实的森空岛 formatter 倒计时漏加4小时，显示16日00:00；按用户选择采用游戏实际04:00，不照搬这一偏差。后端用上游 storeTs 与最近一次每月16日04:00比较，月初不再错误清零。
- 前端 `dailyStatus.ts` 复用现有 metrics/sections 生成卡片，不扩展接口；`recruitRefresh` 从基建数字卡调整到日常状态卡，精确次数保留在办公室详情。公招/训练到期按已有时间更新状态，公招刷新到期只显示可用，不虚构次数。
- 倒计时沿用官方天/小时/分钟精度：天和小时都有时省略分钟；分钟向上取整但最多59。前端回归在 `tests/daily-status.test.js` 和 `tests/e2e/overview-metrics.spec.ts`。

## 方舟装备皮肤头像

2026-10-04 核对[官方 SDK](https://bbs.hycdn.cn/skland-fe-static/skland-game/9560.b49ee94b.js) 的 getAkCharInfo 与[官方账号组件](https://bbs.hycdn.cn/skland-fe-static/skland-game/8624.b27ec983.js)：头像优先 skinAvatarUrl，缺失回退 charAvatarUrl。skinId 从账号 chars 按 charId 获取，assist 模式也复用该皮肤，不使用持有 skins 列表推测。概览 operators[].skinId 与 arknightsSupport.items[].skinId 为可选可空字符串，兼容旧后端；非法/缺失上游值为 null。前端按官方 CDN 规则编码 #/@ 路径，皮肤图失败回默认图，再失败显示姓名首字；刷新换肤需清除旧图片失败状态。不增加上游请求或图片代理，终末地继续使用原 avatarUrl。
