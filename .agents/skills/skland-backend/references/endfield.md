# 终末地概览与详细记录

按 2026-10-05 工作区实现核对。以下模块均在 `src/service/game/hypergryph/skIsland/`；类型在 `src/model/game/hypergraph/skIsland/overview.ts`，HTTP schema 在 `src/openapi/schemas.ts`。输入为已解开 data 的 `detail`。

## 模块与数据可用性

`overview.ts` 输出基础 profile/operators/metrics，并调用 `endfieldOverview.ts` 生成旧 metrics/sections；完整记录另外输出可选 gloryRoad、warEchoes、regionalDevelopment、monolith。详情新增字段不取代旧摘要。

| 输出/来源 | 缺失与空值规则 |
| --- | --- |
| gloryRoad ← detail.achieve | 属性不存在时省略；achieveMedals 非数组时 medals=null，空数组时 medals=[]。display 独立读取对象映射：{} 转 []，数组或缺失转 null。 |
| regionalDevelopment ← detail.domain | 非数组时省略；空数组返回 regions=[]；缺 settlements 为 null。 |
| warEchoes ← detail.warEchoesFull / warEchoes | 两侧均无 seasons 数组则省略；full.seasons 是数组（含 []）时 detailAvailable=true，否则 false。 |
| monolith ← detail.monolithFull / indieHard | 两侧均无 indieHardGroups 数组则省略；full 数组存在（含 []）时 detailAvailable=true。 |

可选请求失败如何进入 detail 见 [协议](protocol.md)。`detailAvailable` 反映数组结构是否可用，不代表每条记录完整或用户已完成玩法。null 是未知；false、0、[] 是已提供的值。

## 基础资料与干员

- level 是权限等阶，worldLevel 是探索等级，createTime 是苏醒日；收藏总数来自 base.charNum/weaponNum/docNum，不用展示干员列表长度替代。
- operators 的 ID 优先外层 char.id，再 charData.id；名字来自 charData.name，缺失回退 ID；按 level 降序。rarity.key 去掉 rarity_ 前缀直接得到显示星数；potentialLevel 原值保留（0 有效），不套用方舟 +1。
- profession/property 的 value 作为职业/属性；头像优先 charData.avatarSqUrl，非法或缺失回退 avatarRtUrl，全部通过 artworkUrl 校验。只有简表字段，没有逐干员技能/装备请求。
- 理智直接 curStamina/maxStamina，maxTs 只提供回满时刻，0 输出无倒计时；不套方舟每六分钟恢复公式。
- overview 顶层时钟沿通用规则；warEchoes/endfieldRecords/endfieldDevelopment 与 gloryRoad 获得时间只接受正值且 <1e11 的秒时间，毫秒输入不转换，非法/0 为 null。bestRecord.passTs 是耗时，绝不是日期。

## 帝江号、探索与蚀像寻遗

实现 `endfieldOverview.ts`，测试 `tests/endfieldOverview.test.ts`。

- 帝江号 type 按 0 总控、1 制造、2 培养、5 会客排序，未知房间类型不输出。nameKey 保留同类房间序号；所有支持房间驻员容量为 3，maxLevel 总控 5、其余 3；旧 cnsLevel metric 继续保留。
- `spaceShip.rooms[].chars` 才是真实驻员。staff 的 null 表示详情未知，[] 表示无人；不能拿持有列表猜派驻。
- 姓名按房间 charId **先匹配 charData.id 定义 ID，再匹配外层持有记录 id**，两个索引分开。实际关系可能与两种 ID 都不对应，此时允许用房间完整官方头像 URL 唯一匹配档案的 avatarSqUrl/avatarRtUrl；同记录两种相同 URL 去重，不同记录共用 URL 保持未知。不能按文件名、片段、外观或顺序猜测。
- 驻员头像优先房间 avatarUrl，再取匹配档案 avatarSqUrl/avatarRtUrl。所有 URL 通过 artworkUrl，不增加网络请求。
- 地区 moneyMgr.count/total 为调度券，据点 remainMoney/moneyMax 为储存量。旧 sections 保留 domain/settlement 摘要，完整地区关系看下一节。
- 探索从 domain.levels 的六组 count/total 读取：puzzleCount、trchestCount、pieceCount、blackboxCount、equipTrchestCount、trstarCount；缺某组就不生成该组行。piece 对应维修灵感点，未知分类不推测奖励。
- domain.collections 只供 ether/chests/pieces 收藏汇总，不从分子臆造上限；任一地区缺 collections 或某计数则汇总为 null，total 仍为 null。详情 total=0 不意味着已完成。
- 蚀像寻遗 `seekSuspicion` 存在时生成 daily metric：count/total 都已知则 current=min(count,total)，缺 total 保留 count，0 保留。当前没有蚀像寻遗独立详情请求。

## 地区建设

`endfieldDevelopment.ts` 的 normalizeRegionalDevelopment 保留地区所属关系：domainId/name/level、moneyMgr.count/total，以及每个据点 id/name/level/exp/expToLevelUp/remainMoney/moneyMax。

- level=0 为未解锁，level>0 为已解锁，缺失为 null。MAX **只取 isFinalMaxLevel**，经验已满或某个固定等级都不能推导 MAX。
- 原始字段为单字符串 officerCharIds 与 officerCharAvatar；不能照搬官方 codec 转换后的 officerCharId/expMax 作为原始 API 字段。
- 派驻关系来自据点字段，匹配 detail.chars 只补姓名/头像；支持两种 ID 与唯一完整官方头像 URL。无 ID/头像时 officer=null；派驻 ID 已知但档案缺失时保留 ID 和未知姓名。
- 保留 settlements=null 与 [] 的区别；没有领域数组不虚构 regions。测试 `tests/endfieldDevelopment.test.ts`。

## 共用挑战与历史编队

`endfieldRecords.ts` 的 endfieldChallengeNormalizer 被战争回响和影拓丰碑共用：

- isPass、plusTask 使用 boolean|null，不把缺失布尔值当 false；保留 description/feature/target/recommendLevel/enemies。
- 仅 isPass===true 且 bestRecord.passTs>0 才有 record；recordedAt=bestRecord.ts（Unix 秒），durationSeconds=passTs（耗时秒），firstPassAt=firstPassTs。
- 队员 level/potentialLevel/evolvePhase/rarity/property 取 **bestRecord.chars** 的历史值，不能用当前档案养成覆盖。rarity 在战绩模型中是 string|null，与 operators 的数字星数不同。
- 名字可从档案按 ID 或唯一完整头像 URL 补齐，头像来自历史队员 avatarUrl。无法匹配时名字 null，不能凭当前持有顺序猜身份；共享头像不推断。
- enemies/team 数组缺失为 null、空数组为 []；图片失败不丢文字记录。共用规则回归同时运行 `tests/warEchoes.test.ts`、`tests/endfieldDevelopment.test.ts`。

## 战争回响

`warEchoes.ts` 从 warEchoesFull 与 warEchoes 合并赛季：以 id 为键，详情的同 ID 赛季 **整条替换** 摘要，保留摘要独有赛季；不是递归合并 weeks。

- 保留 season → week → stage → normal/hard/cruel 难度 → 最佳记录/敌人层级；season/week 星数四舍五入且最多 9，stage/honor 最多 3。
- 9 星且 allPlusTasks=true 为 S+，9 为 S，至少 7/5/3/1 为 A/B/C/D；0 或未知为 null。赛季结束与挑战通关无推导关系。
- 荣勋仅来自 full.achieves，不替换成账号 achieveMedals。保留 name、star、firstPassTs，取得状态由 firstPassTs 是否大于 0 得到；缺失未知，0 未获得，honors 缺数组为 null，空数组为 []。
- 官方 silver 页面累计档位统计（高档含低档）是历史记录的前端约定：先筛已取得荣勋，再统计；后端返回逐条 honors，不输出自行补造的累计值。
- 旧 sections 的战争回响摘要仍读取 brief，不能假设它与新对象拥有相同的完整层级或插图优先级。
- 图片取已返回赛季的 headerImage/kvImage：完整 seasons 与旧周摘要优先 headerImage，旧赛季摘要优先 kvImage，各自回退另一张；不另取独立关卡封面。
- 测试 `tests/warEchoes.test.ts`、`tests/common/API/skLand.test.ts`、`tests/service/game/hypergryph/accountService.test.ts`。

## 影拓丰碑

`endfieldDevelopment.ts` 的 normalizeMonolith 合并全部主题，按 id 将 full 主题字段浅覆盖到 brief；currentThemeId 优先 brief 第一条的 id，再回退合并后的第一项。

- **旧 endfieldMonolith section 只取 brief 当前第一组**，统计 normal/hard 两个 isPass 的通过数/2；任一布尔缺失则计数 null。完整 monolith.themes 保留全部主题、普通/苦难记录，不能裁剪成旧摘要。
- 主题封面取本组 pic；旧 section 条目复用当前组 pic。图片统一校验，缺图保留记录，前端本地资源兜底。
- normalDungeon 为普通（官方 Off），hardDungeon 为苦难（官方 On）。活动字段保留 activityName/isInActivity/activityStartTs/activityEndTs，未知活动状态不等于未开启。
- medal 来自主题 achieve.achievementData；obtainTs>0 已获得、0 未获得、缺失未知。isPlated 独立三态；镀层图优先 platedIcon，否则按 level 3/2/default 选 reforge3Icon/reforge2Icon/initIcon，URL 非法回退 initIcon。此处 medal.level 保留原始 level，不套用光荣之路的合成等级公式。
- 详情成功空数组仍 detailAvailable=true；两侧都缺数组时省略 monolith。挑战/编队按共用 normalizer，测试 `tests/endfieldDevelopment.test.ts`，请求/容错配合 API 和 accountService 测试。

## 光荣之路

`gloryRoad.ts` 只消费已有 card/detail 的 achieve，没有额外请求。

- count 直接取总数；tiers 对原始 achieveMedals 用 level+achievementData.initLevel-1 分别统计 1/2/3，合法等级为正整数，某条等级未知则档位计数为 null。统计不因展示列表过滤而改写。
- medals 要求 achievementData.id，obtainTs=0 明确未获得时排除；日期缺失仍保留记录但 acquiredAt=null。不要将列表长度当 count。
- 图片优先 isPlated 的 platedIcon，否则按原始 level 3/2/default 选对应图，回退 initIcon；显示 level 则用合成等级。category/canCertify 保留。
- display 是玩家选择的 1–10 槽位映射，按 slot 升序；未匹配 medalId 保留，不用最新奖章补位。后端 medals 保留来源顺序，未按日期自动排序。
- 已记录的前端约定：canCertify=true 且合成等级 3 才显示认证资格；可按获得时间/等级排序。涉及 UI 时到 EasonWeb 核对，不把这些排序写成后端现状。
- 测试 `tests/gloryRoad.test.ts` 验证合成等级、图片优先级、展示槽位和缺失/空值。

## 既有来源索引与前端兼容

这些是此前 skill/源码记录的核对来源（2026-10-03 至 2026-10-05），本次未重新执行或逐个下载核验。哈希变化后从 [官方终末地页](https://game.skland.com/endfield/game-data) 找当前模块：

- [字段 codec](https://assets.skland.com/_static_assets/game-tools/dist-BZImVwlH.js)、[GameData 页面](https://assets.skland.com/_static_assets/game-tools/GameData-CKtD4-ed.js)、[探索表格](https://assets.skland.com/_static_assets/game-tools/RegionExploreTable-D36RE3Dz.js)。
- [地区建设](https://assets.skland.com/_static_assets/game-tools/region-dev-detail-Cq-A_xh2.js)、[影拓丰碑](https://assets.skland.com/_static_assets/game-tools/umbral-monument-jhlt_L1E.js)、[历史编队](https://assets.skland.com/_static_assets/game-tools/DungeonRecordCard-u3WKcZOq.js)、[战争回响荣勋](https://assets.skland.com/_static_assets/game-tools/silver-CMo64lkE.js)。
- [中文词条](https://assets.skland.com/_static_assets/game-tools/locales/zh_Hans.json)、[英文词条](https://assets.skland.com/_static_assets/game-tools/locales/en.json)；[开源字段交叉参考](https://github.com/FrostN0v0/nonebot-plugin-skland/blob/master/nonebot_plugin_skland/schemas/endfield/card.py) 不是稳定协议承诺。

前端 EasonWeb 的 skland-frontend skill 承接资源、UI 和边界校验。既有约定包括把重复 cnsLevel 合入帝江号同时兼容旧后端、头像失败使用姓名首字、profile.endministratorGender 不再用于选头像；这些文件不在本仓库，跨仓库工作时先核对实际实现。
