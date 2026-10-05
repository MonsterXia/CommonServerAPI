---
name: common-server-api
description: 用于 CommonServerAPI 的接口开发、排障和代码审查，涵盖 Hono/OpenAPI 路由、Cookie 会话、注册与密码重置、Post 管理员绑定、鹰角账号、Prisma/D1 迁移和 Workers 服务初始化。森空岛取数、签到与概览字段细节配合 skland-backend 使用。
---

# CommonServerAPI 项目基础

本 skill 适用于当前仓库，源码与命令路径均相对于仓库根目录，Markdown 链接相对于文档。内容按 2026-10-05 当前工作区（包括未提交的新模块）核对；先读 `AGENTS.md`、检查 `git status --short`，再查看任务相关源码和测试。README 的历史示例、旧原型与生成文件不能替代当前实现。

## 项目入口

项目是 TypeScript + Hono 的 Cloudflare Workers API，使用 Prisma D1 adapter、KV、R2，以及 Resend/React Email。`@/` 对应 `src/`。

| 工作内容 | 优先阅读 |
| --- | --- |
| 应用初始化、CORS、CSRF、Bindings | `src/index.ts`、`src/common/config/origin.ts` |
| OpenAPI / Swagger / 契约测试 | `src/openapi/`、`tests/openapi/`、`scripts/export-openapi.ts` |
| 路由挂载 | `src/router/router.ts`、`src/router/routerfactory.ts` |
| 用户注册、登录与超管 | `src/router/user/`、`src/controller/user/`、`src/service/user/` |
| 密码重置、旧会话失效 | `src/router/user/user.ts`、`src/service/user/passwordResetService.ts`、`src/lib/jwt.ts`、`migrations/0006_password_reset.sql` |
| Post 管理员与账号绑定 | `src/router/post/postAdmin.ts`、`src/controller/post/postAdminController.ts`、`src/service/post/postAdminService.ts` |
| 鹰角绑定、角色查询、概览与签到 | `src/router/game/hypergryph/account.ts`、`src/service/game/hypergryph/accountService.ts` |
| 第三方协议与签名 | `src/common/API/`、`src/common/config/endpoints.ts`、`src/util/skLand.ts` |
| 数据模型、迁移 | `prisma/schema.prisma`、根目录 `migrations/`、`src/lib/prisma.ts` |
| 邮件、验证、对象存储 | `src/common/service/verificationService.ts`、`src/common/Email/`、`src/common/OBS/` |
| 测试与运行命令 | `vitest.config.mts`、`package.json`、`tests/` 下对应模块的 `*.test.ts` |

认证、存储或第三方服务变更时，按需阅读 [领域约定与实现注意点](references/domains.md)。

涉及森空岛取数、签到协议、概览字段、恢复公式或官方数据差异时，使用 [森空岛后端 skill](../skland-backend/SKILL.md)。游戏模块与测试导航在那里维护。

## 路由边界

- `src/router/router.ts` 挂载 `/user`、`/game`、`/post`，健康检查 `GET /` 只返回 `{ message }`，不使用业务 envelope。
- `/game/hypergryph/account` 是网站 Cookie 认证入口，包括短信、绑定/解绑、角色列表、概览、手动签到。`/game/hypergryph` 与 `/game/hypergryph/skLand` 还挂载传入上游凭证的旧协议接口，不能误写成所有游戏路由都要求网站 Cookie。
- `/post/admin` 是已挂载的独立管理员能力；前端隐藏不代表后端不存在。`superAdmin.ts` 定义 API_KEY Bearer 路由但未挂载；`endfield/endfield.ts` 是空路由，不存在独立的终末地详情 HTTP 接口。
- 保留 `hypergryph`/`hypergraph`、`skLand`/`skIsland` 的现有路径和大小写。`src/resources/SKIslandCheckIn.ts` 是有顶层执行的历史脚本，不是应用入口、测试或自动签到 Workflow，不作为验证命令运行。

## 接口开发约定

通常沿 `router → controller → service → 存储/外部 API` 跟踪请求。模型放在 `src/model/`，共享组件放在 `src/common/`，已初始化服务通过 `src/lib/` 获取。部分路由（例如 `account.ts`）直接调用 service；小改动沿用邻近结构，不顺带重构整个模块。

- 业务路由统一使用 `createNewRouter()` 创建 `OpenAPIHono`，通过 `.openapi(route, handler)` 注册并沿父路由挂载。请求/响应 schema 在 `src/openapi/schemas.ts`，方法、路径、唯一 operationId、状态码及 security 在 `src/openapi/routes.ts`；不要用裸 `.get()` / `.post()` 新增无文档的业务接口。
- Controller 通过 `src/controller/handlers.ts` 的 `createValidatedHandler(parser, service, failureMessage, source?)` 解析 JSON 对象或 query 并调用业务校验；无输入的服务使用 `createServiceHandler(service, failureMessage)`。Service 返回 `StandardServerResult<T>`。非法 JSON、null、数组及非对象 body 返回 400；parser 的业务错误与 207 等服务状态保留；未捕获异常返回稳定 500，不序列化原始错误或请求凭证。复用已有邮箱与密码校验器，避免另建不一致的规则。
- `buildStandardServerResponse` 的真实参数顺序为 `(success, message, data, error, httpStatus)`。状态码是**第五个参数**，不要将状态码误放到 error 参数中。
- `buildContextJson` 依据 `httpStatus >= 400` 判断错误，不依据 `success`：正常响应为 `{ message, data, httpStatus }`，错误响应为 `{ message, error, httpStatus }`。内部 `success` 不会自动出现在 HTTP 响应中；错误为空时这里回退为 `Unknown error`，而 `buildErrorContextJson` 原样保留 error（可为 null）。
- HTTP 状态码常量统一从 `@/util/hono` 导入 `businessStatusCode`。

例如 service 中的拒绝响应：

```ts
return buildStandardServerResponse(
    false,
    'Missing username',
    null,
    null,
    businessStatusCode.BAD_REQUEST
);
```

修改响应时同时验证实际 HTTP 状态和 JSON 内容，避免内部失败却向客户端返回 200。

## OpenAPI 契约

- `/docs` 提供 Swagger UI，`/openapi.json` 提供 OpenAPI 3.0.3；`npm run openapi:export` 导出被忽略的 `build/openapi.json`，不手工维护或提交生成规范。
- `.openapi()` 根据同一 Zod 声明校验输入；保留 service 的邮箱规范化和业务规则。JSON 结构错误统一 400，不支持的 body 媒体类型为 415；`routerfactory.ts` 将校验异常转为现有错误封装，不能暴露原始凭证。响应不自动校验/裁剪，修改响应时在测试中核对实际 JSON 与 schema。
- `security` 只描述鉴权，不能替代 middleware。`authMiddleware` / `postAdminAuthMiddleware` 必须在校验器之前；Post 绑定/解绑是同一个 security 对象内的两个 Cookie（AND），不要写成两个对象（OR）。Swagger 登录后依赖浏览器 Cookie，不能在 Authorize 中手动设置 HttpOnly Cookie。
- schema 明确区分可空字段与可选字段，保留实际 201 / 207 / 410 等状态以及旧路径大小写。未挂载超管路由保持关闭，不为补文档而开放。
- `tests/openapi/document.test.ts` 对比实际挂载路由和规范，当前断言 32 个 operation（含健康检查，不含 docs/spec），并检查唯一 operationId；新增接口更新该断言。`tests/openapi/requests.test.ts` 检查媒体类型、鉴权顺序和响应兼容；新增或修改接口运行 `npm test -- tests/openapi`、类型检查和相关 service 测试。Swagger UI CDN 版本固定在 `document.ts`，关闭持久授权、外部 validator 与 URL 配置覆盖。
- `createServiceHandler` 隐藏未捕获异常，但不能自动清理 service 主动返回的 error；旧协议和部分 service 仍有自身错误转换。审查时沿完整链路核对，不宣称所有历史接口都已脱敏。登录/注册及旧凭证交换有明确的 token 响应契约；普通账号与概览响应则只选取公开字段。

## Workers 与数据变更

按根目录 `AGENTS.md` 的要求，在 Workers 或相关产品任务开始前检索当前官方文档，不凭记忆写 API 或限制：

- [Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 文档](https://developers.cloudflare.com/d1/)、[KV 文档](https://developers.cloudflare.com/kv/)、[R2 文档](https://developers.cloudflare.com/r2/)
- [Node.js 兼容性](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- 涉及限额时读取对应产品的 `/platform/limits/` 页面，例如 [Workers 限额](https://developers.cloudflare.com/workers/platform/limits/)。

绑定配置在 `wrangler.jsonc`，手写 `Bindings` 在 `src/index.ts`。更改绑定后核对两处并运行 `npm run cf-typegen`；生成的类型不能替代手写声明的一致性检查。

数据模型变更需同步 `prisma/schema.prisma` 与根目录的增量 SQL 迁移。先查看已有迁移编号，不覆盖旧迁移；`prisma/differ/` 下的快照可能过期，应先核对差异基线。更新模型后运行 `npx prisma generate`，不要手改被忽略的 `src/generated/prisma/`。

本项目的 D1 迁移使用 Wrangler。`prisma.config.ts` 中配置的 `prisma/migrations` 与实际根目录 `migrations/` 不同，还包含本地 Wrangler SQLite 路径；不要直接把该路径用于其他机器，也不要未经核对改用 `prisma migrate dev`。

## 验证方式

所有命令在仓库根目录执行；具体命令以当前 `package.json` 为准。

| 目的 | 命令 |
| --- | --- |
| 按锁文件安装依赖（需要准备环境时） | `npm ci` |
| 生成 Prisma Client | `npx prisma generate` |
| 本地开发（设置 `APP_ENV:development`） | `npm run dev` |
| 类型检查 | `npm run typecheck` |
| 相关测试 | `npm test -- tests/service/post/postAdminService.test.ts`（换为相关路径） |
| 全量测试 | `npm test` |
| 导出 OpenAPI 规范 | `npm run openapi:export` |
| Workers 打包验证 | `npx wrangler deploy --dry-run` |
| 本地迁移验证 | `npx wrangler d1 migrations apply common-server-db --local` |
| 邮件模板预览 | `npm run email:dev` |

按改动范围选择验证：业务逻辑运行类型检查与相关测试；数据库变更增加本地迁移验证；入口、依赖或运行时变更增加 dry-run。仅编辑文档或 skill 时检查格式、引用和描述准确性即可。

测试统一放在根目录 `tests/`，新测试沿现有领域位置组织，使用 `@/` 导入被测源码及 mock 目标。现有终末地测试直接在 `tests/` 下（如 `tests/endfieldDevelopment.test.ts`），只运行 `tests/service/` 不会覆盖它们。

测试使用 Vitest 的 Node 环境，并非 Workers pool。已有测试使用模块 mock、Hono `app.request`，密码重置测试还使用 `node:sqlite` 的内存数据库模拟 D1 调用。Node 22.12 需 `NODE_OPTIONS=--experimental-sqlite npm test`；其他版本按实际运行时能力选择，不能笼统认为所有 Node 22 都需此开关。不要把这些测试通过描述成真实 Cloudflare D1/KV 验证。

按领域查回归：认证/注册看 `tests/lib/jwt.test.ts`、`tests/service/user/`、`tests/common/validation/` 和 `tests/common/service/`；Post 看 `tests/service/post/`；路由与网关看 `tests/controller/`、`tests/openapi/`、`tests/common/gateway/`；来源策略看 `tests/common/config/origin.test.ts`。游戏测试清单见森空岛 skill。

接口测试关注权限、状态码、响应字段及数据变化；邮件、短信和真实游戏 API 使用替身。发布任务可使用 `npm run deploy`，它会先生成 Prisma Client 再部署；普通开发验证不等于授权部署、远程迁移或真实账号签到。

## 中间过程与提交

- Superpowers plan 等执行计划保存在仓库外（例如 `/tmp/eason-legacy-refactor/`），不创建在项目目录、不提交。持久维护的开发约定、测试和 API 文档可随代码提交。
- 控制器回归在 `tests/controller/`，同时验证真实路由、无效请求的状态码与鉴权。网关使用 `AxiosRequestConfig` 传递选项，保留 Workers fetch adapter / `cache: no-store`，不添加无行为的拦截器。
