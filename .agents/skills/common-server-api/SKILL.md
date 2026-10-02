---
name: common-server-api
description: 用于 CommonServerAPI 仓库的接口开发、问题排查和代码审查。当任务涉及此项目的 Hono 路由、用户与 Post 管理员认证、鹰角/森空岛服务、Prisma/D1 数据模型或 Workers 绑定时使用，提供项目入口、响应契约和验证方式。
---

# CommonServerAPI 项目基础

本 skill 适用于当前仓库，路径均相对于仓库根目录。先读 `AGENTS.md`，再查看任务相关源码；下列内容是导航和现有约定，若实现发生变化，以当前源码和测试为准。

## 项目入口

项目是 TypeScript + Hono 的 Cloudflare Workers API，使用 Prisma D1 adapter、KV、R2，以及 Resend/React Email。`@/` 对应 `src/`。

| 工作内容 | 优先阅读 |
| --- | --- |
| 应用初始化、CORS、CSRF、Bindings | `src/index.ts`、`src/common/config/origin.ts` |
| 路由挂载 | `src/router/router.ts`、`src/router/routerfactory.ts` |
| 用户注册、登录与超管 | `src/router/user/`、`src/controller/user/`、`src/service/user/` |
| Post 管理员与账号绑定 | `src/router/post/postAdmin.ts`、`src/controller/post/postAdminController.ts`、`src/service/post/postAdminService.ts` |
| 鹰角绑定、角色查询、概览与签到 | `src/router/game/hypergryph/account.ts`、`src/service/game/hypergryph/accountService.ts` |
| 第三方协议与签名 | `src/common/API/`、`src/common/config/endpoints.ts`、`src/util/skLand.ts` |
| 数据模型、迁移 | `prisma/schema.prisma`、根目录 `migrations/`、`src/lib/prisma.ts` |
| 邮件、验证、对象存储 | `src/common/service/verificationService.ts`、`src/common/Email/`、`src/common/OBS/` |
| 测试与运行命令 | `vitest.config.mts`、`package.json`、`tests/` 下对应模块的 `*.test.ts` |

认证、存储或第三方服务变更时，按需阅读 [领域约定与实现注意点](references/domains.md)。

## 接口开发约定

通常沿 `router → controller → service → 存储/外部 API` 跟踪请求。模型放在 `src/model/`，共享组件放在 `src/common/`，已初始化服务通过 `src/lib/` 获取。部分路由（例如 `account.ts`）直接调用 service；小改动沿用邻近结构，不顺带重构整个模块。

- 需要绑定类型的路由使用 `createNewRouter()`，并沿现有父路由挂载；不要只新增一个未接入的路由文件。
- Controller 负责解析请求、调用 parser/service、转换响应。Service 返回 `StandardServerResult<T>`。复用已有邮箱与密码校验器，避免另建不一致的规则。
- `buildStandardServerResponse` 的真实参数顺序为 `(success, message, data, error, httpStatus)`。状态码是**第五个参数**，README 的部分旧示例将它放在第四个参数，不应照抄。
- `buildContextJson` 依据 `httpStatus >= 400` 判断错误，不依据 `success`：正常响应为 `{ message, data, httpStatus }`，错误响应为 `{ message, error, httpStatus }`。内部 `success` 不会自动出现在 HTTP 响应中。
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
| Workers 打包验证 | `npx wrangler deploy --dry-run` |
| 本地迁移验证 | `npx wrangler d1 migrations apply common-server-db --local` |
| 邮件模板预览 | `npm run email:dev` |

按改动范围选择验证：业务逻辑运行类型检查与相关测试；数据库变更增加本地迁移验证；入口、依赖或运行时变更增加 dry-run。仅编辑文档或 skill 时检查格式、引用和描述准确性即可。

测试统一放在根目录 `tests/`，按 `src/` 的目录结构组织，使用 `@/` 导入被测源码及 mock 目标；不要将测试放回 `src/`。

测试使用 Vitest 的 Node 环境，并非默认 Workers pool。已有测试使用模块 mock、Hono `app.request`，密码重置测试还使用 `node:sqlite` 的内存数据库模拟 D1 调用；需要支持该模块的 Node 运行时。不要把这些测试通过描述成真实 Cloudflare D1/KV 验证。

接口测试关注权限、状态码、响应字段及数据变化；邮件、短信和真实游戏 API 使用替身。发布任务可使用 `npm run deploy`，它会先生成 Prisma Client 再部署；普通开发验证不等于授权部署、远程迁移或真实账号签到。
