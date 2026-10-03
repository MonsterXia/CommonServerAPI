---
name: skland-backend
description: 维护 CommonServerAPI 的森空岛明日方舟与终末地角色取数、字段归一化、理智与基建计算、主线和探索显示契约及 OpenAPI。用于排查官方数据差异或扩展游戏概览，不负责前端图片下载。
---

# 森空岛后端数据处理

路径相对于 CommonServerAPI 仓库根目录。先读 `AGENTS.md` 和 [项目 skill](../common-server-api/SKILL.md) 的 Workers、鉴权及 OpenAPI 约定。游戏特定规则集中在 [两游戏显示规则](../common-server-api/references/skland-data.md)，修改对应字段前阅读，不复制一套计算公式。

## 数据链路

`src/router/game/hypergryph/account.ts` → `src/service/game/hypergryph/accountService.ts` → `src/common/API/skLand.ts` → `src/service/game/hypergryph/skIsland/overview.ts`；详细分组分别在 `arknightsDetails.ts` 与 `endfieldOverview.ts`。

- 公共接口 `GET /game/hypergryph/account/overview` 接收 appCode/uid/gameId；先校验网站 Cookie 身份与鹰角绑定，再获取官方角色列表核实该角色归属。不得因客户端传来合法格式 UID 就读取任意账号。
- 方舟上游为 `api/v1/game/player/info?uid=...`；终末地为 `web/v1/game/endfield/card/detail`，参数 roleId/serverId/userId 并带 `sk-game-role`。当前端点见 `src/common/config/endpoints.ts`。
- 复用 `getSkLandSignHeader` 的签名与时差重试，网关使用现有 Workers fetch adapter。401/code10003 最多一次按上游时间修正，不能无限重试或打印 cred/token/header。
- 响应先检查业务 code；只将 data 交给 normalizer。终末地使用 detail.base，方舟使用 status；主资料缺失应失败，不能返回伪造的全零概览。
- 官方当前读取流程直接 GET 资料，尚未核实通用“强制同步游戏”接口。auth/refresh 是凭证刷新；gameplat/game/refresh 是 Steam 游戏流程，不能移用于方舟。上游可能延迟，重新读取不等于强制同步。

## 归一化与显示契约

数值 0 有效；缺失、非法值用 null，数量/容量不可从未知嵌套结构猜测。主线是例外语义：方舟精确空字符串代表全部完成，必须保留 `""`；null/缺失/空白仍为未知，不以等级推断。非空按 stageInfoMap 的 code/name/原 ID；终末地 mainMission.description 不使用方舟通关规则。

updatedAt 是上游快照时间，fetchedAt 是本次读取，calculatedAt 优先上游 currentTs（终末地 detail.currentTs 优先），都用 Unix 秒。恢复公式、负哨兵、超上限、北京时间04:00重置、基建估算与终末地探索规则均按显示规则文档，两个游戏不得共用未经证实的恢复公式。返回 recovery 基线允许前端本地计时，不要求每秒访问后端。

业务数据契约在 `src/model/game/hypergraph/skIsland/overview.ts` 与 `src/openapi/schemas.ts` 同步维护。新增字段同时协调前端 GameOverview、国际化和渲染。schema 中写明可空、单位与哨兵；不要把上游凭证、完整私有响应、头像 URL 或图片目录塞进概览。

## 资料与图片边界

核对依据优先官方页面/formatter/codec，再以开源实现交叉验证，具体链接和日期在显示规则文档。用户录屏用于核对标签、单位与展示条件，不作为可提交 fixture。官方哈希版本可能变化，查新字段时重新验证来源。

公共图像及链接由 EasonWeb 的 `src/assets/game-avatars/`、`src/assets/skland/` 管理；需要图片规则时读前端仓的 `.agents/skills/skland-frontend/SKILL.md`。后端只给稳定 game/char/region ID 与确实需要的游戏内形象字段，不代理图片，不逐干员请求补图，不从账号持有列表生成公共资源清单。

## 验证

- 改 normalizer：运行 `npm test -- tests/service/game/hypergryph/skIsland`、`npm test -- tests/openapi` 和 `npm run typecheck`。Node 22 的 SQLite 测试需要 `NODE_OPTIONS=--experimental-sqlite`；遵循当前运行时要求。
- 用合成数据覆盖缺失/零值/精确空字符串、时间边界、超上限、两游戏差异与 OpenAPI parse。不要提交用户录屏、真实角色快照或凭证。
- API 变更检查 `tests/service/game/hypergryph/accountService.test.ts` 的角色归属/错误契约，新增路由同时更新 OpenAPI；`npm run openapi:export` 生成 build/openapi.json，不提交生成文件。
- 发布沿项目授权与流程执行；实际生产只读角色查询与页面显示才是线上验证。测试替身不证明官方服务可用，短信/签到/解绑不是只读检查。中间执行计划保存在仓库外。
