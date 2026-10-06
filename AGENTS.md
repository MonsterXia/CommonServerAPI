# CommonServerAPI 协作指南

本文件适用于整个仓库。以当前源码、配置和测试为准；README 中的历史示例与旧脚本不能替代现有实现。

## 开始工作

- 先执行 `git status --short`，保留已有修改，不覆盖与任务无关的工作。
- 接口开发、排障和审查先读 [common-server-api skill](.agents/skills/common-server-api/SKILL.md)；涉及森空岛协议、签到、方舟或终末地取数时，再读 [skland-backend skill](.agents/skills/skland-backend/SKILL.md)。按任务读取其中引用的领域资料。
- 沿请求链路查阅相关实现和测试，小改动沿用邻近结构，不顺带做全仓重构或格式化。
- 临时执行计划、调研输出放在仓库外（例如 `/tmp/common-server-api/`）；长期维护的项目文档、测试与接口说明可放入仓库。

## 项目结构

这是 TypeScript + Hono 的 Cloudflare Workers API，使用 Prisma D1 adapter、KV、R2，以及 Resend / React Email。TypeScript 开启 strict，`@/` 映射到 `src/`。

| 位置 | 职责 |
| --- | --- |
| `src/index.ts` | Worker 入口、服务初始化、Bindings、CORS / CSRF |
| `src/router/` | 路由注册；`router.ts` 挂载 `/user`、`/game`、`/post` |
| `src/controller/` | 输入解析与服务调用；公共 handler 在 `handlers.ts` |
| `src/service/` | 用户、Post 管理员及游戏业务逻辑 |
| `src/model/` | 业务类型与请求解析 |
| `src/openapi/` | Zod schema、路由契约、Swagger UI 与规范生成 |
| `src/middleware/`、`src/lib/` | 身份认证、会话、共享服务的初始化与获取 |
| `src/common/` | 上游 API、网关、配置、校验、邮件与对象存储 |
| `prisma/schema.prisma`、`migrations/` | 数据模型与根目录下的 D1 增量 SQL 迁移 |
| `tests/` | Vitest 测试，包含按领域分组的测试和根目录游戏测试 |
| `wrangler.jsonc` | Workers 配置与资源绑定 |

通常沿 `router → controller → service → 存储 / 外部 API` 跟踪请求；部分路由直接调用 service，修改时遵循现有模块结构。

## 常用命令

以下命令在仓库根目录运行，以 `package.json` 为准。使用 npm 和已提交的 `package-lock.json`。

| 目的 | 命令 |
| --- | --- |
| 按锁文件准备依赖 | `npm ci` |
| 生成 Prisma Client | `npx prisma generate` |
| 本地开发 | `npm run dev`（设置 `APP_ENV:development`） |
| 类型检查 | `npm run typecheck` |
| 全量测试 | `npm test` |
| 指定测试 | `npm test -- tests/service/user/userService.test.ts` |
| OpenAPI 契约测试 | `npm test -- tests/openapi` |
| 导出 OpenAPI | `npm run openapi:export` |
| Workers 打包验证 | `npx wrangler deploy --dry-run` |
| 生成绑定类型 | `npm run cf-typegen` |
| 应用本地 D1 迁移 | `npx wrangler d1 migrations apply common-server-db --local` |
| 邮件模板预览 | `npm run email:dev` |
| 发布（任务已授权时） | `npm run deploy`（先生成 Prisma Client） |

当前没有独立的 lint 脚本。不要把尚未运行的命令报告为通过。

## 接口与响应约定

- 业务路由使用 `src/router/routerfactory.ts` 的 `createNewRouter()` 和 `.openapi(route, handler)` 注册，并沿父路由挂载。不要新增未纳入规范的裸 `.get()` / `.post()` 业务接口。
- 请求 / 响应 schema 在 `src/openapi/schemas.ts`；方法、路径、唯一 `operationId`、状态码和 security 在 `src/openapi/routes.ts`。修改接口时同步实际响应、契约和相关测试。
- Controller 优先复用 `createValidatedHandler` 或 `createServiceHandler`，Service 返回 `StandardServerResult<T>`；邮箱规范化和密码策略复用 `src/common/validation/`。
- `buildStandardServerResponse(success, message, data, error, httpStatus)` 的状态码是**第五个参数**。状态码常量使用 `@/util/hono` 的 `businessStatusCode`。
- `buildContextJson` 按 `httpStatus >= 400` 选择错误响应，而非依据内部 `success`。正常响应为 `{ message, data, httpStatus }`，错误响应为 `{ message, error, httpStatus }`；健康检查 `GET /` 仅返回 `{ message }`。
- 同时验证 HTTP 状态和响应 JSON。保留已有 201、207、410 等业务语义；非法 JSON / 非对象输入返回 400，不支持的 body 媒体类型返回 415。
- OpenAPI 的 `security` 只是描述，不能代替鉴权中间件。鉴权必须在请求校验之前执行；响应不会被 schema 自动校验或裁剪。
- `/docs` 提供 Swagger UI，`/openapi.json` 提供规范；`build/openapi.json` 是生成产物，不手工维护或提交。新增接口时更新 `tests/openapi/document.test.ts` 的覆盖断言。
- 保留现有路径拼写和大小写，例如 `hypergryph`、`skLand`、`checkIn`，不要因目录命名不同而改变公开接口。

## 身份、数据与外部调用

- 普通用户使用 `auth_token`，Post 管理员使用独立的 `post_auth_token`。绑定 / 解绑需同时校验两种身份，OpenAPI 中两个 Cookie 放在同一个 security 对象内（AND）。
- 当前用户身份从鉴权后的 Context 获取，不信任请求传入的用户 ID。普通用户会话需校验数据库中的 `sessionVersion`；密码重置必须保留旧会话失效及挑战一次性消费的行为。
- `User.isAdmin`、`Admin` 与 `PostAdmin` 是不同概念。`src/router/user/superAdmin.ts` 尚未挂载，不因补文档或复用代码而将其开放。
- `/game/hypergryph/account` 使用网站 Cookie；旧鹰角 / 森空岛协议接口另有上游凭证契约，不能笼统认定所有游戏路由都使用网站 Cookie。
- 游戏角色取数和签到前检查绑定与角色归属；保留概览、签到的 `private, no-store` 缓存策略。上游协议和字段归一化遵循森空岛 skill。
- 保留绑定操作的唯一约束、条件更新及冲突处理；不能只做预检查后无条件写入。
- CORS / CSRF 来源规则集中在 `src/common/config/origin.ts`，环境由 `APP_ENV` 区分。调整来源策略时同步检查入口中间件和对应测试，不为本地调试放宽生产规则。
- 不把密码、验证码、Cookie、密钥或上游凭证写入日志、文档、测试 fixture 或普通账号响应。保留已有明确的登录 / 凭证交换响应契约；新错误处理不直接序列化原始异常。
- 本地秘密配置使用被忽略的 `.dev.vars` / `.env` 文件；不要提交其值。邮件、短信和游戏 API 测试使用 mock。
- `src/resources/SKIslandCheckIn.ts` 是有顶层执行的历史脚本，不作为测试或验证命令运行。当前 Workflow 只有初始步骤，不能据此声称已实现自动签到。

## Workers 与数据库变更

- 修改 Workers 或相关产品前，先遵循下方 Cloudflare 文档要求检索当前官方资料。
- 绑定配置在 `wrangler.jsonc`，手写 `Bindings` 在 `src/index.ts`。修改绑定后同时核对两处并运行 `npm run cf-typegen`（即 `wrangler types`），不要手改生成类型。
- 注意已有 Workflow 命名差异：配置的 binding 为 `COMMON_SERVER_API`，入口手写类型为 `CommonServerAPI`；涉及该绑定时核实，不能把类名当成 binding 名。
- 模型变更同步更新 `prisma/schema.prisma` 与根目录 `migrations/` 中的新 SQL 迁移。先检查现有编号，不覆盖或重写历史迁移；`prisma/differ/` 中的快照需核对基线后使用。
- 模型更新后运行 `npx prisma generate`；`src/generated/prisma/` 被忽略，不手工编辑或提交。
- D1 迁移使用 Wrangler。`prisma.config.ts` 配置的 `prisma/migrations` 与实际根目录 `migrations/` 不同，且含本机 Wrangler SQLite 路径；不要直接照搬该路径或改用 `prisma migrate dev`。
- 不照抄 README 中固定旧编号的迁移输出示例。使用新编号生成增量 SQL，并检查表结构、索引和数据迁移是否符合预期。
- 普通开发验证使用本地迁移和 dry-run；部署、远程迁移或真实账号操作须在用户授权的任务范围内执行。

## 验证与交付

- 业务逻辑变更运行类型检查和相关测试；接口变更额外运行 `tests/openapi`，核对权限、实际状态码和响应字段。
- 数据库变更增加本地迁移验证；入口、依赖或运行时变更增加 Workers dry-run。依赖更新同步锁文件，并核对 README 中 scoped overrides 的用途。
- 测试统一放在 `tests/`，使用 `@/` 导入源码和指定 mock 目标。现有游戏测试也位于 `tests/` 根目录，只运行 `tests/service/` 不足以覆盖游戏逻辑。
- Vitest 使用 Node 环境，并非 Workers pool。密码重置测试依赖 `node:sqlite`；若 Node 版本需显式开启（如 22.12），使用 `NODE_OPTIONS=--experimental-sqlite npm test`。mock / 内存 SQLite 测试通过不能表述为线上 D1 / KV 验证通过。
- 仅编辑文档时检查格式、路径、命令及描述准确性即可，无需运行业务测试。
- 完成后简要说明改动内容、已执行验证及未验证的限制；不要把 dry-run 描述为部署成功。

## Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

### Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

### Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

### Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

### Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

### Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`
