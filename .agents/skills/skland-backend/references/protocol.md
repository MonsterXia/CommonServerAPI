# 森空岛协议、取数与签到

按当前源码核对；参数、超时和重试以 `src/common/API/` 与 `src/util/skLand.ts` 为准。HTTP 路由声明在 `src/openapi/routes.ts`，凭证模型在 `src/model/game/hypergraph/skIsland/user.ts`。

## 身份与上游链路

网站绑定入口：`accountService.ts` 从当前 User 查 HypergryphAccount.token → `fetchHypergryphOauthToken` → `fetchSkLandCred` → `fetchSkLandGameAccounts`。`Cred.userId` 是森空岛用户 ID，不能用网站 User.id、手机号或游戏 uid 替换。

角色列表按未删除的 bindingList 展开：方舟 uid/channelMasterId，终末地 roles[].roleId/serverId（roles 为空回退 defaultRole）。serverName 来自方舟 channelName 或终末地 role.serverName，仅供展示。签到和概览的归属键始终是 appCode+uid+gameId。

`src/router/game/hypergryph/hypergraph.ts` 和 `skLand/skLand.ts` 还挂载旧凭证交换与 checkIn 接口；旧 checkIn 经 `tempCheckIn` 从调用方提交的鹰角密码登录，不是 Cookie 绑定入口。两类接口的鉴权方式和兼容输出分别检查，不能将旧接口当作绕过网站角色校验的实现模板。

## GET 资料及可选详情

固定域名由 `src/common/config/predefinedDomin.ts` 配置，以下为 `src/common/config/endpoints.ts` 的国服路径：

| 数据 | GET 路径 | 查询参数/额外头 |
| --- | --- | --- |
| 方舟资料 | `api/v1/game/player/info` | uid |
| 终末地资料 | `web/v1/game/endfield/card/detail` | roleId=uid、serverId=gameId、userId=cred.userId；sk-game-role=`3_{uid}_{gameId}` |
| 战争回响详情 | `web/v1/game/endfield/card/war-echoes` | 同终末地资料 |
| 影拓丰碑详情 | `web/v1/game/endfield/card/indie-hard` | 同终末地资料 |

`src/common/API/skLand.ts` 的 `fetchSkLandData` 复用同一 URLSearchParams 签名和发送，GET 超时 20 秒。检查 code=0 且存在 data 后返回 data；只有 Axios HTTP 401/code10003 才尝试按上游时间校正一次。不要把所有 401 都重试，也不要复制国际服 `/api/v1/game/endfield/card/detail` 替换这里的国服路径。

`getBoundGameOverview` 完成归属检查后并行读取主资料及两个终末地可选接口：

- 方舟只读主资料；终末地额外请求各自 catch 为 undefined，不使有效概览整体失败。
- 只有有效的 profile.detail 对象才注入 `warEchoesFull=extra.warEchoes`、`monolithFull=monolith.indieHard`；normalizer 直接读取该 detail。不是把整个上游 response 交给 normalizer。
- 主请求失败、非零业务 code、缺 status/detail.base 或 normalizer 抛错，返回稳定的 502；可选失败仍为 200，摘要/详情可用性由具体模块决定，见 [终末地规则](endfield.md)。
- 列表读取与凭证错误发生在聚合前，不能被可选请求容错吞掉。未归属的角色 403，任何资料/签到请求都不能先于归属判定。

当前实现直接读取资料，没有已核实的通用“强制同步游戏”步骤。auth/refresh 为凭证刷新；旧 SDK 的 gameplat/game/refresh 为 Steam 流程，不用于方舟。上游延迟不能靠承诺“再次 GET 强制同步”消除。

## 签名与网关

`src/util/skLand.ts` 组合 pathname、序列化 body/query、时间和固定签名头，经 HMAC-SHA256 后 MD5；优先复用 `getSkLandSignHeader`。其签名内部 timestamp 与对外 timeStamp 大小写有既有约定，勿自行统一命名。JSON、query 顺序及实际发送的空体必须一致。

网关使用 Axios fetch adapter、cache=no-store、AxiosRequestConfig，返回已解开的 response.data；详情 API 与签到 API 自己再校验上游业务 code。网络替身应 mock `@/lib/gatewayManager`；检查真实 fetch 行为用 `tests/common/API/attendanceWire.test.ts`，不要只依赖 mock 到 post 函数的测试。

## 手动签到

网站入口 POST `/game/hypergryph/account/check-in`：缺 body 或未给 roles 时签到所有绑定角色；roles 若提供为 1–100 项，必须全部通过归属检查后才写入。请求体为非空且不符合 JSON 媒体类型时 415。路由和 schema 保留可选 body 语义。

`src/common/API/skLandAttendance.ts` 为实际协议实现，`skLand.ts` 只 re-export：

- 方舟 POST `api/v1/game/attendance`，JSON `{ uid, gameId }`。
- 终末地 POST `web/v1/game/endfield/attendance`，**没有 body**，用空 URLSearchParams 签空串，加 sk-game-role；不要发送 `{}` 或方舟的 JSON 体。
- 单次 12 秒超时；仅一次有效的 401/code10003 时间校正重试。超时或连接中断意味着写入结果未知，返回 timeout/network_error，不能自动重发该 POST。
- code=0 表示签到已确认；奖励缺失仍成功，但 rewardsComplete=false。方舟奖励来自 awards[].resource/count；终末地来自 awardIds 与 resourceInfoMap。
- 已签到需要非零业务 code 加明确的已签到 message 匹配；包括 HTTP 403 的该结果。不能仅凭 code10001 把任意错误视为已签到。
- 错误分类由 CheckInError 给出：clock_skew、timeout、network_error、auth_expired、rate_limited、upstream_error、invalid_response、unsupported_game；输出稳定 errorCode/retryable/upstreamCode，避免透传异常或凭证。

`src/service/game/hypergryph/skIsland/checkIn.ts` 的 `skLandCheckInCore`：

- 按三元角色键去重，最大 3 个并发 worker，结果保持输入顺序；40 秒是开始下一项前检查的批次预算，不是强制取消全部在途请求的总超时。
- 逐角色 status 为 success/already_checked_in/failed；summary 分别统计。无失败 200，有任一失败为 207（**全部失败也是 207**），内部 success 仍为 true，因为 report 已生成。
- 保留 results/summary/requestId/completedAt/durationMs 与旧 checkInResults/errorResults；completedAt 用 Unix 秒、durationMs 用毫秒。
- 日志只记 requestId、耗时、计数和结构化错误类别，不含角色 UID、昵称、凭证或上游完整响应。

验证：`tests/common/API/skLand.test.ts`、`attendance.test.ts`、`attendanceWire.test.ts` 检查上游业务 code、时差、空体签名、奖励和汇总；`tests/checkInSelection.test.ts` 与 `tests/service/game/hypergryph/accountService.test.ts` 检查归属和部分失败；`tests/openapi/requests.test.ts` 检查 207 HTTP 契约。使用合成数据，不执行历史 `src/resources/SKIslandCheckIn.ts` 顶层脚本。
