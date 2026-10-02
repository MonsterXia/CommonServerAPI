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
| 方舟日/周任务和剿灭 | 根据 storeTs 与北京时间04:00重置比较；周一重置周任务/剿灭。保全派驻奖励每月1、16日04:00重置。 |

零值有效；缺失/非法值 null；进度条仅用于正上限并最多100%。上游未提供基准，不编造恢复。静态图像和映射在前端发布，不增加图片代理或逐干员请求。

## 方舟基建与记录

- 贸易站：有驻员且时间有效，达到 completeWorkTime 后首份订单+1，之后按官方三小时近似估算，受 stockLimit 限制。completeAt 表示下一份订单，不是整个仓库完成。
- 制造站：使用 manufactureFormulaInfoMap 的重量/耗时、房间速度、队列和驻员 AP，按官方 boosted/normal 两阶段近似式；不自行模拟技能。公式可能产生非正工作时间，保留官方产物数但不输出虚构完成时间。缺少关键字段不估算。
- 宿舍：恢复率 `(1.5 + 0.1*level + 0.0004*comfort)*100`，满心情8640000；数量为已回满驻员/驻员总数。疲劳干员去重并排除宿舍成员。
- 公招：0锁定、1空闲、2招募中、3完成；finishTs到达则完成。可用总数含空闲与完成。办公室可刷新状态不等于精确次数，refreshCount保持快照，不按12小时猜未来次数。
- 训练室：targetSkill=-1空闲；remainSecs相对于currentTs，不能再从lastUpdateTime扣除。
- 会客室：board数组数量/7；自有、收到、待领取线索分别显示。dailyReward布尔含义未核实，不展示。
- 收藏总数扣除额外阿米娅形态，只保留char_002_amiya；档案列表仍可展示全部形态。稀有度及潜能rank均+1；medal.total为蚀刻章数量。
- 活动按SIDESTORY/BRANCHLINE且非复刻筛选，汇总zones的通关/总数；集成战略收藏品与投资分开；剿灭maxKills、保全best保留来源数值，不臆造上限。生息演算目前仅支持明确返回的ID/名称，不将未知嵌套对象塞进页面。缺失主线进度不推断“全部完成”。

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
