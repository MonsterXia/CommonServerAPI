# 领域约定与实现注意点

路径相对于仓库根目录。按当前任务阅读对应部分，并检查提到的实现与`tests/` 中对应的测试。

## 身份与权限

- 普通用户使用 `auth_token`，实现位于 `src/lib/jwt.ts`；认证入口是 `authMiddleware`。`getCurrentUser` 除校验 JWT 外，还读取数据库比较 `sessionVersion`，不能用仅解码或仅验证签名代替完整认证。
- Post 管理员使用独立的 `post_auth_token`，JWT 包含 `kind: 'post-admin'`，实现位于 `src/lib/postAdminJwt.ts`，中间件是 `postAdminAuthMiddleware`。普通用户与管理员 token 不可互换。
- `/post/admin/binding` 的绑定和解绑需要两种中间件同时通过。`PostAdmin.userId` 是可空唯一字段，账号允许未绑定；维护可选一对一关系及冲突处理。
- `User.isAdmin`、独立 `Admin` 模型与 `PostAdmin` 不是同一身份概念。修改超管功能先看 `src/service/user/superAdminService.ts` 的实际权限检查。
- 登录 Cookie 的统一设置在 `src/lib/jwtCore.ts`，Origin 策略在 `src/common/config/origin.ts`。生产允许指定域名的 HTTPS 子域，localhost 仅在 development 环境允许；不要为解决联调问题直接放开全部来源。
- `src/index.ts` 对 `POST /user/logout` 有单独的 CSRF 豁免；这是当前实现的特例，不是新增接口的默认模板。

## 注册与密码重置

- 邮箱与密码校验位于 `src/common/validation/`；验证码生成、哈希与邮件发送位于 `src/common/service/verificationService.ts`。
- Post 注册通过 KV 保存一条包含密码哈希和 token 哈希的待注册记录；先读 `src/service/post/postAdminService.ts`，不要恢复 README 提到的旧分离记录方案。
- 普通用户的新密码重置入口是 `/user/password/reset/code` 和 `/user/password/reset`，业务位于 `src/service/user/passwordResetService.ts`。不要引导新调用方使用旧 `/user/email/verify` 的 `reset_password` 类型。
- 重置挑战保存在 D1 `PasswordResetChallenge`，哈希关联服务端密钥；有效期、错误次数及发送抑制以实现为准。密码更新、会话版本递增与挑战消费使用 D1 batch，修改时保留这些操作的一致性。
- 重点测试重复提交、过期或错误验证码、发送失败清理、重置后旧会话失效。`tests/service/user/passwordResetService.test.ts` 的 SQLite 测试能覆盖事务语义，但不能证明线上 D1 的完整行为。

## 鹰角与森空岛

- 用户账号相关路由在 `src/router/game/hypergryph/account.ts`，使用普通用户认证。Service 从当前身份定位用户，不信任请求体传入的账号归属。
- `HypergryphAccount` 用 `phone` 作主键，`userId` 唯一，第三方 token 存在后端。返回给账号页面的对象使用公开字段选择，避免把完整数据库记录或上游响应直接返回。
- `src/service/game/hypergryph/accountService.ts` 负责绑定、解绑、角色查询与手动签到；相关 API 封装在 `src/common/API/hypergryph.ts`、`src/common/API/skLand.ts`。
- 签到可能部分失败，当前接口使用 207 和逐项结果。修改重试或汇总逻辑时验证成功、全部失败及部分失败的表现。
- 目录中并存 `hypergryph`、`hypergraph`、`skLand`、`skIsland` 等命名；按现有 import 和挂载追踪，不要假定这些路径可互换。

## 服务初始化与存储

- `src/index.ts` 在首次请求初始化全局服务，通过 `servicesInitialized` 避免重复初始化。`src/lib/prisma.ts`、`src/lib/KV.ts`、`src/lib/emailManager.ts` 等暴露初始化和 getter。
- Prisma 通过 `PrismaD1(env.DB)` 创建。新增数据库操作优先沿用已有访问层；涉及密码重置的原子操作参考现有直接 D1 实现。
- 编写测试时明确依赖是 mock 还是初始化后的服务。单测不必为了测试某个 parser 而导入依赖 `cloudflare:workers` 的应用入口。
- Wrangler 当前绑定为 `DB`、`KV`、`OBS` 和 Workflow `COMMON_SERVER_API`。`src/index.ts` 的 Workflow 类型字段写作 `CommonServerAPI`，与配置存在命名差异；涉及该绑定时先核对，不要把两个名字都当成有效绑定。当前 Workflow 类只含初始步骤，并非自动签到调度器。
- 环境变量名称可查 `Bindings`；不要把 `.dev.vars*`、`.env*` 中的值写进代码、测试或文档。

## 依赖维护

`package.json` 对 `@react-email/ui` 的 Next.js、Prisma 的 MySQL2 和 `@prisma/config` 的 DeepmergeTS 设置了 scoped overrides。维护依赖时阅读 README 对这些 overrides 的说明，验证 Prisma 配置加载与邮件预览，不要仅为简化依赖树而移除。
