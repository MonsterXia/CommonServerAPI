# 领域约定与实现注意点

按 2026-10-05 当前源码核对。路径相对于仓库根目录；按领域读取实现和测试，不将这里的实现摘要当作新的功能要求。

## 身份与权限

| 身份 | 实现与边界 |
| --- | --- |
| 普通用户 | `src/lib/jwt.ts`、`authMiddleware`；Cookie `auth_token`，拒绝带 kind 的 payload，校验 username，随后查 User 并比对 sessionVersion。旧 token 未带版本按 0 处理。 |
| Post 管理员 | `src/lib/postAdminJwt.ts`、`postAdminAuthMiddleware`；独立 Cookie `post_auth_token`，要求 kind='post-admin'、数字 postAdminId、字符串 email；getCurrentPostAdmin 只校验 token，current/binding service 再查数据库。 |
| 超管 | `src/router/user/superAdmin.ts` 使用 API_KEY Bearer，但未挂载；User.isAdmin、独立 Admin 表和 PostAdmin 不是同一身份。 |

JWT 共用 `src/lib/jwtCore.ts` 与 `src/common/config/jwtConfig.ts`：HS256、一天过期，Cookie 为 HttpOnly、SameSite=lax、path=/，Secure 根据请求 HTTPS 判断。普通用户修改密码依靠数据库 sessionVersion 使旧会话失效，不能退化为仅解码/验签。Post JWT 没有同样的 sessionVersion 机制。

`src/common/config/origin.ts` 要求规范化 Origin：生产接受 `246801357.xyz` 的 HTTPS 子域（不含根域），development 额外允许 localhost；不是任意本地 IP。`src/index.ts` 的 CORS 开启 credentials，只有 POST `/user/logout` 单独跳过 CSRF。维护对应行为时检查 `tests/common/config/origin.test.ts` 与 `tests/lib/jwt.test.ts`。

## 普通用户注册与校验

- 路由/控制器/服务：`src/router/user/user.ts`、`src/controller/user/userController.ts`、`src/service/user/userService.ts`。邮箱 trim/lowercase 及 Joi 格式校验在 `src/common/validation/email.ts`；新密码在 `password.ts` 要求 6–128 字符、最多 72 UTF-8 字节、大写/小写/指定特殊字符。登录只校验既有凭证输入，不把新密码强度策略追加到登录。
- `src/common/service/verificationService.ts` 负责随机验证码/token、哈希、定时比较、KV 与邮件。普通注册使用 `email-verification-code-{email}-register`，五分钟有效；当前注册验证码是 KV 中的原码，不要与 Post 的 tokenHash 或密码重置的密钥哈希混淆。
- 注册消费验证码后创建 User，返回 201 并设置 Cookie，响应包含 user 和 token。`/user/current` 的关联账号使用公开字段；不要复用内部全记录 helper 暴露 password 或 Hypergryph token。
- 旧 `/user/email/verify` 仍接受多种 type，但新密码重置走下节独立接口。测试：`tests/service/user/userService.test.ts`、`tests/common/validation/password.test.ts`、`tests/common/service/verificationService.test.ts`、`tests/controller/`、`tests/openapi/requests.test.ts`。

## 密码重置与 D1 一致性

`src/router/user/user.ts` 直接调用 `src/service/user/passwordResetService.ts`，不是 userController 包装；异常统一 503。入口 POST `/user/password/reset/code` 和 POST `/user/password/reset`，无需登录。同步检查 `migrations/0006_password_reset.sql`、`prisma/schema.prisma`、`src/openapi/routes.ts`。

- username/email 必须配对，邮箱规范化；不存在的身份与有效期内重复发送均返回相同的 200 提示。发送失败返回 503，并按 username+codeHash 清理本次挑战。
- D1 `PasswordResetChallenge` 以 username 为主键，codeHash 为服务端 JWT_SECRET、username、code 拼接后的 SHA-256；时间戳使用 **Date.now() 毫秒**。有效期五分钟，未到期不覆盖旧挑战，错误次数最多五次。
- 重置要求六位数字验证码和共享新密码策略。首次读取验证后，写入仍通过 EXISTS 再检查 email、hash、有效期、attempts，不能以预检查代替写时条件。
- 密码更新、sessionVersion+1、updatedAt 更新与挑战消费放在同一 `DB.batch`，检查首条 UPDATE 的 meta.changes。成功清除当前 auth_token，所有旧版本用户会话失效。
- 修改原子行为前读取 [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)，不要把 KV get/delete 或 Prisma 普通多次写等同于该 batch。
- 已有回归包括顺序重复消费、到期、五次错误、邮箱不匹配、发送抑制与失败清理：`tests/service/user/passwordResetService.test.ts`；旧 JWT 失效单独见 `tests/lib/jwt.test.ts`。调整并发行为时需另加真实竞争场景，不能将顺序重复提交测试声称为并发覆盖。SQLite 内存测试验证模拟事务，不代表线上 D1 验证。

## Post 注册、登录与绑定

实现集中在 `src/service/post/postAdminService.ts`，请求解析和公共类型在 `src/model/post/postAdmin.ts`，公开投影用 `toPublicPostAdmin`。

- 注册待验证记录为 KV `post-admin-registration:{email}`，30 分钟，一条 JSON 同时保存 passwordHash/tokenHash。重复初始化 409；邮件失败清理记录；缺失/旧分离记录返回 410；token 错误 400；唯一约束冲突 409；创建成功 201 并删除待验证记录。核对 `src/common/config/frontend.ts` 的邮件链接目标，不从请求 Origin 拼接链接。
- `/post/admin/binding` 的 POST/DELETE 同时运行两种认证中间件。OpenAPI 的两个 Cookie 在同一 security 对象（AND）。身份从 Context 读取，不由请求指定。
- `PostAdmin.userId` 可空且唯一，删除 User 时 SetNull；用户与 Post 管理员是可选一对一。重复绑定同一对身份为 200，任一方已绑定其他账号为 409。
- 写入保留条件：绑定 where 中 userId=null，解绑 where 中 userId=当前用户；Prisma P2002/P2025 转 409，防止预检查后的并发覆盖。
- 回归在 `tests/service/post/postAdminRegistration.test.ts`、`postAdminService.test.ts`、`postAdminBinding.test.ts`，并配合 `tests/openapi/requests.test.ts` 验证双身份先于输入校验。

## 鹰角账号与角色权限

- Cookie 接口位于 `src/router/game/hypergryph/account.ts` 和 `src/service/game/hypergryph/accountService.ts`。从 `c.get('user').username` 查 User，再取绑定，不信任客户端 userId。
- `HypergryphAccount.phone` 主键、userId 唯一；同手机号重新绑定可刷新 token，换手机号先解绑，跨用户占用/并发 P2002、P2025 返回 409。返回仅选 phone/userId/createdAt/updatedAt。
- 获取角色/概览/签到时以保存的 token 换 OAuth code，再换森空岛 cred，再读取绑定角色；缺 User 为 404，未绑定为 409，上游登录/凭证/角色列表失败为 502。
- 角色列表只保留未删除绑定：方舟 uid/channelMasterId/channelName → uid/gameId/serverName；终末地展开 roles，空列表回退 defaultRole，roleId/serverId/serverName 对应同名展示字段。区服名称不能替代签到区服 ID。
- 概览与选定角色签到都按 appCode+uid+gameId 核对归属，全部校验后才发送签到写请求。概览和签到设置 `Cache-Control: private, no-store`。
- 第三方协议、重试和签到汇总见 [森空岛协议](../../skland-backend/references/protocol.md)；概览字段见 [显示规则](skland-data.md) 和 [终末地详细记录](../../skland-backend/references/endfield.md)。回归入口为 `tests/service/game/hypergryph/accountService.test.ts`。

## 初始化、数据库与外部服务

- `src/index.ts` 首次请求初始化 Prisma、KV、网关、OBS、邮件服务，以全局 servicesInitialized 标识；`src/lib/` 提供各 getter/init。不要把缺初始化引起的测试失败当业务结果；parser/路由单测通常不需要导入含 `cloudflare:workers` 的入口。
- Prisma 由 `src/lib/prisma.ts` 的 `PrismaD1(env.DB)` 创建。模型是 Admin、User、PostAdmin、HypergryphAccount、PasswordResetChallenge；`User.email` 并无数据库唯一约束，不能仅据注册前查询就宣称有唯一索引。
- Wrangler 绑定为 DB、KV、OBS、Workflow COMMON_SERVER_API。`src/index.ts` 手写类型却是 CommonServerAPI，属于待核对差异；Workflow 类仅有 initial step，配置没有签到 cron。不要把类名误当 binding 名，也不要承诺已具备自动签到。
- 网关 `src/common/gateway/axiosClient.ts` 使用 Axios fetch adapter 与 `fetchOptions.cache='no-store'`；`gatewayManager.ts` 参数采用 AxiosRequestConfig，返回 response.data，不返回 AxiosResponse。固定上游域名在 `src/common/config/predefinedDomin.ts`，端点在 `endpoints.ts`。
- R2 经 `src/lib/OBSManager.ts` → `src/common/OBS/OBSManager.ts` → `r2.ts`，目前只支持 obsType='r2'；get 失败/缺对象可返回 null，put/delete 返回 boolean，不把 false 当成功。当前没有独立公开上传路由。
- 邮件经 `src/lib/emailManager.ts` 和 `src/common/Email/emailManager.ts`，模板在 `src/common/Email/template/`；KV helper 使用 `src/lib/KV.ts`。调用方应处理封装返回结果，测试使用 mock，不发送真实邮件。
- 环境变量名称以 Bindings 与使用点为准；.dev.vars/.env 的值不进入文档或 fixture。Prisma 输出位于被忽略的 `src/generated/prisma/`，迁移在根目录 `migrations/`；具体生成、迁移和 dry-run 命令见项目 skill。

## 依赖维护

`package.json` 对 `@react-email/ui` 的 Next.js、Prisma 的 MySQL2、`@prisma/config` 的 DeepmergeTS 设置 scoped overrides。维护时阅读 README 对 overrides 的说明，检查当前锁文件、Prisma 配置加载和邮件预览，不仅为了简化依赖树移除。依赖存在不代表已挂载该产品的业务接口。
