---
name: skland-backend
description: 用于 CommonServerAPI 的森空岛协议与手动签到、明日方舟理智/基建/记录、终末地帝江号/探索/地区建设/光荣之路/战争回响/影拓丰碑取数、字段归一化及 OpenAPI 契约维护，也用于排查官方数据差异。不负责前端图片下载或资源打包。
---

# 森空岛后端

按 2026-10-05 当前工作区核对，包括未提交的终末地模块。源码路径相对于仓库根目录；先读 `AGENTS.md` 和 [项目 skill](../common-server-api/SKILL.md) 中相关的 Workers、鉴权、响应与 OpenAPI 约定，以实际源码和测试为准。

## 按任务定位

| 任务 | 实现入口 | 按需阅读 |
| --- | --- | --- |
| 绑定、角色归属、概览聚合 | `src/router/game/hypergryph/account.ts`、`src/service/game/hypergryph/accountService.ts` | [协议、取数与签到](references/protocol.md) |
| 凭证、角色列表、签名、签到结果 | `src/common/API/skLand.ts`、`skLandAttendance.ts`，`src/util/skLand.ts`，`src/service/game/hypergryph/skIsland/loginService.ts`、`checkIn.ts` | [协议、取数与签到](references/protocol.md) |
| 基础资料、资源时钟、干员简表 | `src/service/game/hypergryph/skIsland/overview.ts` | [通用与方舟显示规则](../common-server-api/references/skland-data.md) |
| 方舟基建、公招、助战、生息演算、引航者试炼 | `src/service/game/hypergryph/skIsland/arknightsDetails.ts` | [通用与方舟显示规则](../common-server-api/references/skland-data.md) |
| 终末地帝江号、探索、蚀像寻遗 seekSuspicion、旧摘要 | `src/service/game/hypergryph/skIsland/endfieldOverview.ts` | [终末地规则](references/endfield.md) |
| 地区建设、影拓丰碑全部主题 | `src/service/game/hypergryph/skIsland/endfieldDevelopment.ts` | [终末地规则](references/endfield.md) |
| 战争回响、最佳记录、历史编队 | `src/service/game/hypergryph/skIsland/warEchoes.ts`、`endfieldRecords.ts` | [终末地规则](references/endfield.md) |
| 光荣之路奖章与展示槽位 | `src/service/game/hypergryph/skIsland/gloryRoad.ts` | [终末地规则](references/endfield.md) |
| 类型、图片地址与 HTTP schema | `src/model/game/hypergraph/skIsland/overview.ts`、`src/service/game/hypergryph/skIsland/artwork.ts`、`src/openapi/schemas.ts` | 下列边界及领域参考 |

表中省略目录的同组文件与前一个文件位于同一目录。终末地详细技能/装备、独立角色养成详情接口目前不存在；已有 operators 仅含简表养成字段。不要由模块名 Development 推断它负责干员培养（它负责地区建设）。

## 数据与兼容边界

- 网站概览入口是 GET `/game/hypergryph/account/overview`，先查 Cookie 用户及绑定，再由上游角色列表核对 appCode/uid/gameId。旧上游凭证接口是另一条链路，不能省略绑定入口的归属检查。
- `fetchSkLandProfileAPI` 已检查业务 code 并解开外层 data；normalizer 接受方舟 status、终末地 detail.base。主资料缺失报错；终末地可选详情失败保留摘要，具体注入/合并规则见协议与终末地参考。
- 缺失/非法数值为 null，0 和 false 保留。已知空数组与未知不同；可选顶层对象可能省略。方舟 mainProgress 精确空字符串是“全部完成”哨兵，不能 trim 掉或推广到终末地。
- updatedAt 是快照时间，fetchedAt 是读取时间，calculatedAt 优先上游 currentTs，输出 Unix 秒。各模块输入时间容错不同：overview/方舟详情支持毫秒转换，新增终末地记录按秒接受；密码重置的毫秒与游戏时间无关。
- 字段变更同步 `src/model/game/hypergraph/skIsland/overview.ts` 和 `src/openapi/schemas.ts`，用合成输入验证实际输出能通过 schema。保留旧 metrics/sections；独立 gloryRoad/warEchoes/regionalDevelopment/monolith 为可选扩展，不因新增完整记录删除旧摘要。
- 前端联动属于 EasonWeb，跨仓库修改须在任务范围内再核对其 GameOverview、边界校验、国际化与渲染；此仓库不包含前端资源或浏览器测试。

## 图片和来源

`artworkUrl` 只接收已有响应中的 HTTPS URL，主机精确允许 bbs.hycdn.cn、web.hycdn.cn、assets.skland.com，并拒绝用户名、密码和非默认端口。后端返回校验后的 avatarUrl/artworkUrl，不下载/代理图片，不逐干员补图。

封面字段映射分别见方舟/终末地参考。缺失或非法图片不影响文字与数字；旧条目通常省略可选 URL，新增详情按各自 schema 返回 null。未核实的生息演算封面、独立关卡图不猜测，也不从真实账号生成公共资源清单。前端可用本地条目/分组图兜底。

方舟保留 operators[].skinId 与助战条目 skinId，均从 chars 按 charId 找当前装备皮肤；终末地头像取 charData.avatarSqUrl，再回退 avatarRtUrl。profile.endministratorGender 仅是 base.gender 的游戏主角形象兼容字段（1=male、2=female），不是账号持有者性别或头像映射来源。

历史官方 formatter/codec/页面来源及日期保留在参考文档；本次更新按本地实现核对，不等于重新验证所有 CDN 哈希。新语义需重新查官方页面与当前模块，再用开源资料交叉核对；下载模块只作文本检查。用户录屏、真实角色快照、cred/token/header 不进入仓库，回归使用合成数据。

## 验证选择

所有命令在仓库根目录执行。改归一化后运行对应行，加 `npm run typecheck` 和 `npm test -- tests/openapi`；只改 skill 则验证格式、引用和事实准确性。

| 改动 | 测试命令 |
| --- | --- |
| 基础资料、方舟基建/记录与图片白名单 | `npm test -- tests/service/game/hypergryph/skIsland` |
| 终末地帝江号、探索、蚀像寻遗摘要 | `npm test -- tests/endfieldOverview.test.ts` |
| 地区建设、影拓丰碑与共用历史记录 | `npm test -- tests/endfieldDevelopment.test.ts tests/warEchoes.test.ts` |
| 战争回响或光荣之路 | `npm test -- tests/warEchoes.test.ts tests/gloryRoad.test.ts` |
| 角色归属、主资料失败、可选详情失败 | `npm test -- tests/service/game/hypergryph/accountService.test.ts` |
| 上游查询、签名、签到线缆行为 | `npm test -- tests/common/API tests/checkInSelection.test.ts` |
| 网关 fetch adapter/options | `npm test -- tests/common/gateway` |

完整游戏回归可合并上表路径；不要只运行 tests/service 而漏掉根目录四个终末地用例。全量 `npm test` 在 Node 22.12 需 `NODE_OPTIONS=--experimental-sqlite`，按运行时能力选择。

合成用例覆盖缺失/零值/false/空数组、主线精确空字符串、时间边界/负哨兵/超上限、双 ID 与重复头像、历史属性、主/可选请求失败和 OpenAPI parse。凭证与第三方网络用 mock；真实短信、签到、账号变更不属于回归测试。导出规范使用 `npm run openapi:export`，生成 build/openapi.json 不提交；以上概览扩展没有新增数据库表。
