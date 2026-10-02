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
- 角色列表的 `serverName` 是展示字段：明日方舟取绑定的 `channelName`，终末地取每个角色的 `serverName`（含 defaultRole 回退）。`gameId` 仍分别取 `channelMasterId` / `serverId`，不要混用命名空间或用显示名称替换签到 ID。来源参考 [森空岛绑定响应样例](https://github.com/ProbiusOfficial/Skland_API#森空岛app)、[含终末地角色字段的客户端模型](https://pkg.go.dev/github.com/starudream/sign-task/pkg/skland/api#PlayerRole)。
- 目录中并存 `hypergryph`、`hypergraph`、`skLand`、`skIsland` 等命名；按现有 import 和挂载追踪，不要假定这些路径可互换。

## 服务初始化与存储

- `src/index.ts` 在首次请求初始化全局服务，通过 `servicesInitialized` 避免重复初始化。`src/lib/prisma.ts`、`src/lib/KV.ts`、`src/lib/emailManager.ts` 等暴露初始化和 getter。
- Prisma 通过 `PrismaD1(env.DB)` 创建。新增数据库操作优先沿用已有访问层；涉及密码重置的原子操作参考现有直接 D1 实现。
- 编写测试时明确依赖是 mock 还是初始化后的服务。单测不必为了测试某个 parser 而导入依赖 `cloudflare:workers` 的应用入口。
- Wrangler 当前绑定为 `DB`、`KV`、`OBS` 和 Workflow `COMMON_SERVER_API`。`src/index.ts` 的 Workflow 类型字段写作 `CommonServerAPI`，与配置存在命名差异；涉及该绑定时先核对，不要把两个名字都当成有效绑定。当前 Workflow 类只含初始步骤，并非自动签到调度器。
- 环境变量名称可查 `Bindings`；不要把 `.dev.vars*`、`.env*` 中的值写进代码、测试或文档。

## 依赖维护

`package.json` 对 `@react-email/ui` 的 Next.js、Prisma 的 MySQL2 和 `@prisma/config` 的 DeepmergeTS 设置了 scoped overrides。维护依赖时阅读 README 对这些 overrides 的说明，验证 Prisma 配置加载与邮件预览，不要仅为简化依赖树而移除。

## 森空岛角色资料

- `GET /game/hypergryph/account/overview?appCode=...&uid=...&gameId=...` 使用普通用户认证、`private, no-store`。服务端从当前绑定换取凭证，重新查询角色列表并同时匹配游戏、UID、区服；禁止仅凭客户端 UID 查询他人角色。
- `src/common/API/skLand.ts` 请求固定森空岛域名：明日方舟 `/api/v1/game/player/info?uid=...`；国服终末地 `/web/v1/game/endfield/card/detail?roleId=...&serverId=...&userId=...`。终末地的 `userId` 来自森空岛凭证，不是游戏 UID。查询串签名与发送必须完全一致，时间校正最多重试一次。
- 头像图片、URL、ID 映射均由 EasonWeb 的静态资源表维护，后端不新增图片请求、代理或运行时资源目录。终末地 `profile.endministratorGender` 仅携带游戏主角形象（上游 `base.gender` 的 1=male、2=female，未知为 null），不代表用户本人的性别；前端据此选择本地男女管理员图片。
- `src/service/game/hypergryph/skIsland/overview.ts` 只选取展示字段，输出模型在 `src/model/game/hypergraph/skIsland/overview.ts`。不得透传完整上游响应、凭证或原始异常。
- 明日方舟使用 `status`、`routine`、`campaign.reward`、`building`、`chars`；终末地使用 `data.detail` 下的 `base`、`dungeon`、`dailyMission`、`weeklyMission`、`bpSystem`、`achieve`、`chars`。`normalizeGameOverview` 的输入已经解开外层 `data`。
- 缺失数值保持 `null`，零值保持 0；时间兼容秒/毫秒，非法时间转为 `null`。按已核实官方规则计算明日方舟理智、无人机、基建，来源与边界见 [森空岛显示规则](skland-data.md)，不得使用推测公式。明日方舟干员总数使用 `chars` 扣除阿米娅额外形态（保留 `char_002_amiya`）；终末地展示档案可能只是上游选择的干员，不能把列表长度当总收藏数。
- 可核对的社区实现与响应样例（并非官方稳定 API 承诺，核对于 2026-10-02）：[明日方舟响应样例](https://github.com/ProbiusOfficial/Skland_API/blob/main/dump.json)、[国服终末地请求实现](https://github.com/SciNancy/astrbot_plugin_sklands/blob/master/api/request.py)、[终末地字段模型](https://github.com/SciNancy/astrbot_plugin_sklands/blob/master/schemas/endfield/card.py)。国际服资料里的 `/api/v1/game/endfield/card/detail` 不应直接替换国服路径。
