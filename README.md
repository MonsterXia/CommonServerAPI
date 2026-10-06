# CommonServerAPI

基于 TypeScript、Hono 和 Cloudflare Workers 的后端 API，为 EasonWeb 等客户端提供用户账号、Post 管理员身份、鹰角账号绑定、森空岛游戏概览与手动签到能力。

- [线上服务](https://api.246801357.xyz/)
- [Swagger UI](https://api.246801357.xyz/docs)
- [OpenAPI JSON](https://api.246801357.xyz/openapi.json)

## 功能与技术栈

| 模块 | 能力 |
| --- | --- |
| 普通用户 | 邮箱验证码、注册、登录 / 登出、当前用户、密码重置与旧会话失效 |
| Post 管理员 | 独立注册验证与登录会话，可与普通用户建立可选的一对一绑定 |
| 鹰角账号 | 短信 / 密码登录后绑定账号、刷新凭证、解绑与角色列表查询 |
| 森空岛概览 | 明日方舟理智、基建与记录；终末地帝江号、探索、地区建设、光荣之路、战争回响和影拓丰碑等数据 |
| 手动签到 | 全部或指定角色签到、逐角色结果、奖励与可重试错误信息 |
| 接口文档 | OpenAPI 3.0.3、Swagger UI、Zod 请求校验与契约测试 |

运行时使用 Workers；数据库为 D1，通过 Prisma D1 adapter 访问；KV 保存验证码及待验证注册等临时数据，R2 提供对象存储封装，邮件使用 Resend / React Email，测试使用 Vitest。

当前没有定时签到任务。Workflow 仅包含初始步骤，超管路由尚未挂载；终末地概览由统一账号接口提供，没有独立的角色技能 / 装备详情接口。

## 快速开始

### 1. 准备环境与依赖

使用 Node.js 24 和 npm。当前锁文件中的 Prisma 支持 Node `^22.12` / `>=24` 等版本，Wrangler 要求 Node 22 及以上；选择 Node 24 也可避免旧版 Node 的 `node:sqlite` 开关问题。

在仓库根目录执行：

```bash
npm ci
npx prisma generate
```

### 2. 配置本地变量

在根目录创建 `.dev.vars`，填写自己的开发配置：

```dotenv
JWT_SECRET="replace-with-a-long-random-development-secret"
RESEND_API_KEY="replace-with-your-resend-api-key"
```

`JWT_SECRET` 用于会话签名和密码重置验证码哈希。邮件服务在首个请求时初始化，因此也需要提供 `RESEND_API_KEY`；实际发送邮件还需使用已在 Resend 验证的发件域名，发件地址配置见 [email.ts](src/common/config/email.ts)。

本地秘密变量放在 `.dev.vars` 或 `.env` 中，两者选其一；存在 `.dev.vars` 时，Wrangler 不会把 `.env` 中的值加载到本地 Worker 的 `env`。这些文件已被 Git 忽略。详见 [Cloudflare 本地变量说明](https://developers.cloudflare.com/workers/local-development/environment-variables/)。

### 3. 初始化本地数据库并启动

```bash
npx wrangler d1 migrations apply common-server-db --local
npm run dev
```

`npm run dev` 会设置 `APP_ENV:development`。以 Wrangler 输出的地址为准，默认可访问：

- [本地健康检查](http://localhost:8787/)
- [本地 Swagger UI](http://localhost:8787/docs)
- [本地 OpenAPI JSON](http://localhost:8787/openapi.json)

健康检查返回：

```json
{ "message": "Common Server API is running." }
```

本地模式使用本地 Cloudflare 资源模拟，但邮件、鹰角短信、游戏查询和签到仍会请求真实上游；Swagger 的 Try it out 也会实际执行相应操作。自动化测试使用 mock。

## 配置说明

### 资源绑定与变量

资源配置见 [wrangler.jsonc](wrangler.jsonc)，手写类型见 [src/index.ts](src/index.ts)。

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `DB` | D1 | 数据库 `common-server-db` |
| `KV` | KV Namespace | 验证码、待验证注册等临时数据 |
| `OBS` | R2 Bucket | 对象存储，当前桶名为 `common-server-r2` |
| `COMMON_SERVER_API` | Workflow | 对应导出的 `CommonServerAPI` 类 |
| `APP_ENV` | 普通变量 | `production` / `development`，影响来源策略和前端链接 |
| `JWT_SECRET` | Secret | JWT 签名与密码重置验证码哈希 |
| `RESEND_API_KEY` | Secret | 邮件服务凭证 |
| `API_KEY` | Secret | 仅用于尚未挂载的超管 Bearer 鉴权 |
| `PUBLIC_ACCESS_KEY` | 类型声明 | 当前业务源码未使用 |

部署到自己的 Cloudflare 账号时，需要将 D1、KV、R2 的资源标识及名称替换为自己的配置；修改数据库名后也应调整命令中的 `common-server-db`。

修改绑定后运行 `npm run cf-typegen`（即 `wrangler types`），同时检查手写 `Bindings`。当前 Workflow 配置名为 `COMMON_SERVER_API`，手写类型却是 `CommonServerAPI`，接入该绑定前需处理这一差异。

### 浏览器会话与来源

普通用户使用 `auth_token`，Post 管理员使用 `post_auth_token`。两者均为 HttpOnly Cookie，`SameSite=lax`，通过 HTTPS 请求设置时启用 Secure。跨源浏览器请求需携带 Cookie，例如 `fetch` 使用 `credentials: 'include'`。

[来源策略](src/common/config/origin.ts) 在生产环境允许 `246801357.xyz` 的 HTTPS 子域，不包含根域；开发环境额外允许 `localhost`。本地前后端建议统一使用 `localhost`，不要混用 `127.0.0.1`。自部署需同步调整该策略、[邮件前端链接](src/common/config/frontend.ts)和发件地址。

当前 Post 邮件验证链接在开发环境指向 `http://localhost:5173`，生产环境指向 `https://post.246801357.xyz`。CORS 允许来源不等于已通过身份认证，接口仍会校验自己的 Cookie 或上游凭证。

## 接口文档与接入

完整参数、响应字段和状态码以同一版本服务的 `/docs` 与 `/openapi.json` 为准。保留路径大小写，例如 `/skLand` 和 `/checkIn`。

Swagger 使用同源 API：先调用登录接口建立 Cookie，再调用受保护接口。浏览器不能通过 Authorize 手动设置 HttpOnly Cookie。UI 不持久化授权信息，并关闭外部规范校验和 URL 配置覆盖。

### 普通用户

以下路径均以 `/user` 为前缀；“公开”表示不要求登录，仍受请求校验和来源策略约束。

| 方法 | 路径 | 身份 | 用途 |
| --- | --- | --- | --- |
| GET | `/username/{username}/exist` | 公开 | 检查用户名 |
| POST | `/email/verify` | 公开 | 请求邮箱验证码 |
| POST | `/register` | 公开 | 注册并建立会话 |
| POST | `/login` | 公开 | 登录 |
| POST | `/logout` | 公开 | 清除普通用户 Cookie |
| GET | `/current` | 普通用户 | 查询当前用户及公开关联信息 |
| POST | `/password/reset/code` | 公开 | 使用 `{ username, email }` 请求重置码 |
| POST | `/password/reset` | 公开 | 使用 `{ username, email, code, password }` 重置密码 |

密码重置使用专用接口，不使用旧 `/email/verify` 的 `reset_password` 类型。重置码有效期为 5 分钟，最多 5 次错误尝试，仅保存与服务端密钥关联的哈希。重置成功后递增 `User.sessionVersion`、消费挑战并清除当前 Cookie，之前签发的用户会话随即失效。

### Post 管理员

以下路径均以 `/post/admin` 为前缀。Post 管理员与普通用户拥有独立身份；管理员可以保持未绑定状态，绑定为可选的一对一关系。

| 方法 | 路径 | 身份 | 用途 |
| --- | --- | --- | --- |
| POST | `/register/valid-email` | 公开 | 检查邮箱是否可用 |
| POST | `/register/init` | 公开 | 接受 `{ email, password }`，发送 30 分钟有效的验证 token |
| POST | `/register/validate` | 公开 | 接受 `{ email, token }`，创建管理员 |
| POST | `/login` | 公开 | 建立管理员会话 |
| POST | `/logout` | 公开 | 清除管理员 Cookie |
| GET | `/current` | Post 管理员 | 查询当前管理员公开信息 |
| POST | `/binding` | 普通用户 + Post 管理员 | 绑定当前两种身份 |
| DELETE | `/binding` | 普通用户 + Post 管理员 | 解除当前绑定 |

绑定接口必须同时具备两个 Cookie。任一身份已绑定其他账号时返回 409。待验证注册将密码哈希与 token 哈希保存在同一条 KV 记录中；从历史分离记录版本升级后，尚未完成验证的用户需要重新发起注册。

### 鹰角绑定、概览与手动签到

以下路径均以 `/game/hypergryph/account` 为前缀，全部要求普通用户 Cookie。此流程的上游 token 保存在后端，账号公开响应不返回该 token。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/sms` | 使用 `{ phone }` 请求鹰角短信验证码 |
| POST | `/` | 使用 `{ phone, method: 'sms', code }` 或 `{ phone, method: 'password', password }` 绑定 / 刷新凭证 |
| DELETE | `/` | 解除绑定 |
| GET | `/games` | 获取绑定账号下的游戏角色 |
| GET | `/overview` | 使用 query 参数 `appCode`、`uid`、`gameId` 获取指定角色概览 |
| POST | `/check-in` | 全部或指定角色手动签到 |

概览和签到使用 `/games` 返回的角色标识；`appCode` 为 `arknights` 或 `endfield`，`gameId` 是区服标识，不是显示名称。后端检查角色归属，两个接口均返回 `Cache-Control: private, no-store`。

概览包含基础资料、资源时钟、指标、分区记录及干员简表；终末地还提供可选的光荣之路、战争回响、地区建设与影拓丰碑扩展。上游缺失数据可能为 `null` 或省略可选对象，不能当成 0；可选详情失败时可保留已有摘要。图片字段仅返回校验后的 URL，后端不下载或代理图片。

签到不传 body 时处理全部已绑定角色，也可选择角色或重试失败项：

```json
{
  "roles": [
    { "appCode": "arknights", "uid": "role_uid", "gameId": "server_id" }
  ]
}
```

选择器最多 100 项，整批归属校验通过后才发送签到请求。结果包含 `results`、`summary`、`requestId`、`completedAt`（Unix 秒）、`durationMs`，并保留 `checkInResults` / `errorResults`。

- 角色状态为 `success`、`already_checked_in` 或 `failed`；已签到视为成功结果。
- 有失败角色时返回 HTTP 207，包括全部角色失败的情况；客户端应读取逐角色状态。
- 奖励明细缺失不推翻已确认的签到成功；未知名称 / 数量为 `null`，`rewardsComplete=false`。
- 网络或超时错误不会自动重发签到 POST，结果可能已在上游生效；可根据 `retryable` 手动重试。`clock_skew` 表示时间校正失败，不应直接要求重新登录。

故障排查可使用 `requestId` 对照 `skland.check_in` 日志。协议、签名和错误分类见[协议参考](.agents/skills/skland-backend/references/protocol.md)，字段与模块导航见[森空岛后端指南](.agents/skills/skland-backend/SKILL.md)。

### 旧协议接口

`/game/hypergryph` 下仍保留短信、token 校验与 OAuth 交换接口，`/game/hypergryph/skLand` 下保留 cred、角色查询及 `/checkIn` 等旧接口。这些接口接收上游凭证，鉴权与响应契约不同于网站 Cookie 账号流程；新的浏览器客户端优先使用上面的绑定账号接口，完整旧契约查阅 OpenAPI。

### 响应格式

业务正常响应（包括 HTTP 207）使用：

```json
{ "message": "OK", "data": {}, "httpStatus": 200 }
```

错误响应使用：

```json
{ "message": "Invalid request", "error": null, "httpStatus": 400 }
```

`GET /` 健康检查是例外，仅返回 `message`。内部 `success` 字段不会自动输出给客户端。JSON 结构 / 字段错误返回 400，不支持的 body 媒体类型返回 415，鉴权先于请求结构校验；其他状态如 201、409、410、502、503 以各接口契约为准。

## 数据库迁移

模型定义在 [prisma/schema.prisma](prisma/schema.prisma)，增量 SQL 位于根目录 [migrations/](migrations/)。使用 Wrangler 管理 D1 迁移，流程见 [Cloudflare D1 迁移文档](https://developers.cloudflare.com/d1/reference/migrations/)。

已有数据库按顺序应用待执行迁移：

```bash
npx wrangler d1 migrations list common-server-db --local
npx wrangler d1 migrations apply common-server-db --local
```

新增模型变更时：

1. 修改 Prisma schema，并用 `npx wrangler d1 migrations create common-server-db describe_change` 创建新的迁移文件。
2. 在新文件中编写、审查增量 SQL；如使用 Prisma diff，先核对旧 schema 基线，再将结果写入这个新文件。
3. 本地应用迁移，运行 `npx prisma generate`，检查类型及相关测试。
4. 将 schema 与迁移一起提交；不要修改已执行的历史迁移，也不要用 `--from-empty` 生成的全量建表 SQL 覆盖现有增量文件。

`prisma/differ/` 中的快照不保证与当前模型同步。`prisma.config.ts` 指向本机 Wrangler SQLite 路径，且配置的 `prisma/migrations` 与实际目录不同；不要直接照搬该路径或使用 `prisma migrate dev` 代替上述流程。生成目录 `src/generated/prisma/` 不提交。

从旧版本升级时需包含 [0006_password_reset.sql](migrations/0006_password_reset.sql)：它添加 `User.sessionVersion` 和 `PasswordResetChallenge`。先完成迁移再发布依赖这些字段的代码。

## 部署

部署前配置自己的 Cloudflare 资源及域名相关代码，并确认目标账号。云端 Secret 使用以下命令交互输入；它们会修改远程配置，不能替代本地 `.dev.vars`。详见 [Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。

```bash
npx wrangler login
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
```

先执行发布验证：

```bash
npx prisma generate
npm run typecheck
npm test
npx wrangler deploy --dry-run
```

确认目标数据库、迁移内容及备份后，执行远程迁移和发布：

```bash
npx wrangler d1 migrations list common-server-db --remote
npx wrangler d1 migrations apply common-server-db --remote
npm run deploy
```

`npm run deploy` 会先生成 Prisma Client 再运行 `wrangler deploy`，不会自动应用数据库迁移。`--dry-run` 仅验证打包，不会发布服务，也不代表线上资源或第三方接口已验证。

## 开发与测试

### 项目目录

```text
src/
  index.ts       Worker 入口、初始化、Bindings、CORS / CSRF
  router/        路由挂载与 OpenAPI 注册
  controller/    请求处理器与业务调用
  service/       用户、Post 管理员和游戏业务
  model/         业务类型与请求解析
  openapi/       请求 / 响应 schema、路由契约和文档
  middleware/    身份认证中间件
  lib/           会话和共享服务初始化 / 获取
  common/        上游 API、配置、校验、邮件、网关和存储
prisma/          数据模型与历史差异快照
migrations/      D1 增量迁移
scripts/         OpenAPI 导出脚本
tests/           Vitest 回归测试
```

通常沿 `router → controller → service → 存储 / 外部 API` 组织代码，部分路由直接调用 service。`@/` 指向 `src/`，测试统一放在 `tests/`，游戏回归也包含 `tests/` 根目录的用例。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` / `npm start` | 本地开发，设置开发环境 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 全量测试 |
| `npm test -- tests/service/user/userService.test.ts` | 指定测试 |
| `npm test -- tests/openapi` | OpenAPI 覆盖、请求与响应契约测试 |
| `npm run openapi:export` | 导出 `build/openapi.json` |
| `npm run cf-typegen` | 生成 Workers 绑定类型 |
| `npm run email:dev` | 预览邮件模板 |

Vitest 使用 Node 环境，不是 Workers pool。密码重置测试通过 `node:sqlite` 内存数据库模拟 D1；Node 22.12 等需要显式启用该模块的版本使用：

```bash
NODE_OPTIONS=--experimental-sqlite npm test
```

mock 与内存 SQLite 测试不代表真实 D1 / KV 或第三方平台验证。`src/resources/SKIslandCheckIn.ts` 是有顶层执行的历史脚本，不作为测试运行。

新增或修改接口时同步 `src/openapi/schemas.ts`、`src/openapi/routes.ts` 和测试；业务路由通过 `createNewRouter()` / `.openapi()` 注册。导出的 `build/openapi.json` 不提交。Controller / Service 约定、响应封装与验证范围见 [AGENTS.md](AGENTS.md) 和[项目开发指南](.agents/skills/common-server-api/SKILL.md)。

### 依赖维护

使用 `npm ci` 复现锁文件中的依赖树。`package.json` 的 scoped overrides 用于替换上游固定的依赖：邮件预览 UI 的 Next.js、Prisma CLI 的 MySQL2，以及 Prisma 配置加载器的 DeepmergeTS。调整时重新检查当前上游版本及修复情况，不仅为了简化依赖树删除 overrides。

DeepmergeTS 8 的 Map 合并行为有变化，当前 Prisma 配置使用普通对象。依赖更新后核对 Prisma 配置加载、Client 生成、类型检查、测试和 Workers dry-run；涉及邮件 UI 时还需检查模板预览。

Workers API、绑定和限制可能变化，相关开发先查 [Cloudflare 官方文档](https://developers.cloudflare.com/workers/)，并遵循 [AGENTS.md](AGENTS.md) 的文档检索与协作要求。
