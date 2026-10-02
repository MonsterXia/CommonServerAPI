# CommonServerAPI
Server hold at api.246801357.xyz

## Run/Deployment

### Run

```bash
npm run dev
```

### Deployment
```bash
npm run deploy
```

### Tests

业务源码放在 `src/`，测试统一放在根目录 `tests/`，并保持对应的目录结构。
例如 `src/service/user/userService.ts` 对应 `tests/service/user/userService.test.ts`。
测试使用 `@/` 导入源码及指定 mock 目标，Vitest 只收集 `tests/**/*.test.ts`。

```bash
npm run typecheck
npm test
# 运行单个模块的测试
npm test -- tests/service/user/userService.test.ts
```

密码重置测试依赖 Node 内置的 `node:sqlite`。若当前 Node 版本需要显式启用该模块（例如 Node 22.12），使用 `NODE_OPTIONS=--experimental-sqlite npm test`。

### Dependency security maintenance

Use `npm ci` to reproduce the checked-in dependency tree, then run `npx prisma generate`,
`npm run typecheck`, `npm test`, and `npx wrangler deploy --dry-run` before deploying.

The scoped `overrides` in `package.json` replace vulnerable versions pinned upstream:
Next.js in the email preview UI, MySQL2 in the Prisma CLI, and DeepmergeTS in the Prisma
config loader. The DeepmergeTS 8 override changes Map merging behavior; this project's
Prisma configuration uses plain objects. Recheck Prisma config loading and email previews
when changing these overrides, and remove them once upstream pins patched versions.

## Set Local Variables
```bash
npx wrangler secret put key
```

## Create/Update D1 databese 

### Prisma

npx prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script --output migrations/0001_create_admin_table.sql

Create migration file
```bash
npx wrangler d1 migrations create common-server-db create_admin_table
```
Write migration file
```bash
# create
npx prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script --output migrations/0001_create_admin_table.sql
# update
npx prisma migrate diff --from-schema ./prisma/differ/schema_old.prisma --to-schema ./prisma/differ/schema_new.prisma --script --output migrations/0002_create_user_table.sql
```
Apply migration
```bash
npx wrangler d1 migrations apply common-server-db --local
npx wrangler d1 migrations apply common-server-db --remote
```

Generate prisma client
```bash
npx prisma generate
```

## Deprecated

#### local

```bash
npx wrangler d1 execute common-server-db --file=./schemas/schema.sql
```

#### remote

```bash
npx wrangler d1 execute common-server-db --file=./schemas/schema.sql --remote
```

## Tips
Remember to rerun 'npx wrangler types' after you change your 'wrangler.jsonc'/'.env*' file.





### Standard API workflow

Request => router => controller => service ( => KV) (=> database)

### Post administrator accounts

Post administrator accounts use an identity and login session independent from normal users.
They may remain unbound. A normal user and a Post administrator can form an optional
one-to-one binding only while both `auth_token` and `post_auth_token` sessions are valid.

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/post/admin/register/valid-email` | Public | Check whether a Post administrator email is available |
| `POST` | `/post/admin/register/init` | Public | Hash the password and send a 30-minute verification token |
| `POST` | `/post/admin/register/validate` | Public | Verify the token and create an unbound Post administrator |
| `POST` | `/post/admin/login` | Public | Create the independent Post administrator session |
| `POST` | `/post/admin/logout` | Public | Clear the Post administrator session cookie |
| `GET` | `/post/admin/current` | Post administrator | Return the active Post administrator without its password hash |
| `POST` | `/post/admin/binding` | Normal user + Post administrator | Bind the two active identities |
| `DELETE` | `/post/admin/binding` | Normal user + Post administrator | Remove their existing binding |

Registration initialization accepts:

```json
{
  "email": "post-admin@example.com",
  "password": "Secure!Password"
}
```

Registration validation accepts the token delivered by email:

```json
{
  "email": "post-admin@example.com",
  "token": "verification-token"
}
```

The implementation reuses the existing `DB`, `KV`, `JWT_SECRET`, and `RESEND_API_KEY`
bindings. No secret value from the former PostAPI repository is required or copied.

Pending registrations store the password hash and token hash together in one KV record.
After upgrading from the older split-record format, users with an outstanding verification
link must restart registration; existing accounts and login sessions are unaffected.

#### Router

```typescript
// Default
import { Hono } from 'hono';
const somethingRouter1 = new Hono();

// If need to get this from bindings
import { createNewRouter } from '@/router/routerfactory';
const somethingRouter2 = createNewRouter();

// Mount other router
import somethingRouter0 from './something0';
somethingRouter2.route('something0', somethingRouter0);

// Mount methods .get/.put/.post/.delete
import somethingController0 from '@/controller/something0/somethingController0';
somethingRouter2.post('/method1', somethingController0.method1);

// If use middleware
import { authMiddleware } from '@/middleware/auth';
somethingRouter2.get('/method2', authMiddleware, somethingController0.method2);

// export router
export default somethingRouter2;
```

#### Controller 与 Service

控制器复用请求处理器，不复制 JSON 解析、校验与 try/catch：

```typescript
import { createValidatedHandler } from '@/controller/handlers';
import { setAdminParser, setAdminService } from '@/service/user/superAdminService';

const setUserAsAdmin = createValidatedHandler(
    setAdminParser,
    setAdminService,
    'Set User As Admin Failed',
);
```

默认输入为 JSON 对象；query 接口传第四个参数 `'query'`。无输入的服务使用
`createServiceHandler(service, failureMessage)`。路由原有鉴权中间件仍需显式挂载。
非法 JSON、null、数组等 body 返回 400，业务校验错误沿用 parser 的状态；未捕获异常
返回稳定的 500 JSON，不将原始异常对象发给客户端。服务自己返回的业务错误和 207 部分成功保持不变。

Service 返回 `StandardServerResult<T>`；`buildStandardServerResponse` 参数顺序为
`(success, message, data, error, httpStatus)`，状态码必须是第五个参数：

```typescript
return buildStandardServerResponse(false, 'Missing username', null, 'Username is required', 400);
// 成功响应允许 data 为 false、null 或对象。
return buildStandardServerResponse(true, 'OK', data, null, 200);
```

测试位于 `tests/controller/` 与对应 service/gateway 目录。运行 `npm run typecheck`、
`npm test` 和 `npx wrangler deploy --dry-run`。测试包含 Node 内存 SQLite，Node 22.12
需 `NODE_OPTIONS=--experimental-sqlite npm test`；推荐使用支持 `node:sqlite` 的 Node 24。

## EasonWeb 账号功能

EasonWeb 现已接入普通用户登录/注册、邮箱验证码、密码重置、鹰角绑定、
森空岛角色查询和手动签到。

新增接口（响应保持 `{ message, data, httpStatus }`）：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/user/password/reset/code` | `{ username, email }` 请求重置验证码 |
| POST | `/user/password/reset` | `{ username, email, code, password }` 设置新密码 |
| POST | `/game/hypergryph/account/sms` | 已登录用户请求鹰角短信验证码，参数 `{ phone }` |
| POST | `/game/hypergryph/account/` | `{ phone, method: 'sms', code }` 或 `{ phone, method: 'password', password }` 登录并绑定/更新会话 |
| DELETE | `/game/hypergryph/account/` | 解除当前用户的鹰角绑定 |
| GET | `/game/hypergryph/account/games` | 查询绑定账号下的明日方舟及终末地角色 |
| POST | `/game/hypergryph/account/check-in` | 对该账号的角色签到，部分失败返回 207 和明细 |

鹰角账号接口均要求普通用户 `auth_token`。第三方 token 只存于后端，不返回给这些页面。
Post 绑定接口仍保留 `/post/admin/binding`，同时要求普通用户与管理员 Cookie；当前 EasonWeb 不展示该功能。

### 数据库升级与会话失效

发布前先执行 `migrations/0006_password_reset.sql`，再部署后端和前端：

```sh
npx wrangler d1 migrations apply common-server-db --local
# 生产发布时，备份/核对数据库后由发布流程执行：
# npx wrangler d1 migrations apply common-server-db --remote
npx prisma generate
```

本迁移添加 `User.sessionVersion`（默认 0）和 `PasswordResetChallenge` 表。
现有未重置密码的用户可以继续使用旧会话；重置成功会递增版本并拒绝之前签发的 Cookie。
重置码仅保存与服务端密钥关联的哈希，有效期 5 分钟，最多 5 次错误尝试；D1 原子批处理
更新密码并消费挑战。相同未过期挑战不会重复发信，发送失败会清理对应记录。
旧 `/user/email/verify` 的 `reset_password` 类型不用于新流程，请调用专用重置接口。

自动化测试通过 mock 与 Node 内存 SQLite 验证注册、登录、Post 绑定和密码重置；
不代表真实 Cloudflare D1/KV 或第三方平台验证。测试不会发送真实验证码或执行账号签到。
