# Post Admin Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Post administrator registration and authentication into CommonServerAPI and add an optional one-to-one binding between a normal `User` and a `PostAdmin`.

**Architecture:** Post administrators remain an independent identity domain with a dedicated JWT cookie. A Post administrator can exist without a normal user; binding requires simultaneous valid normal-user and Post-admin sessions, and either side can only participate in one binding. Existing D1, KV, Prisma, Resend, Hono controller/service, and standard response infrastructure are reused.

**Tech Stack:** Cloudflare Workers, Hono, D1, Workers KV, Prisma 7 D1 adapter, bcryptjs, Resend, TypeScript, Vitest.

## Global Constraints

- Keep the existing normal-user registration and authentication behavior intact.
- Store no secret value in source control; reuse `JWT_SECRET` and distinguish token kinds.
- Use `post_auth_token` for Post administrators and retain `auth_token` for normal users.
- `PostAdmin.userId` is nullable and unique; unbound Post administrators are valid.
- Binding and unbinding require both a valid normal-user session and a valid Post-admin session.
- Registration KV entries expire after 1,800 seconds and are deleted only after successful validation or email-send failure.
- Do not migrate PostAPI questionnaire, RCON, webhook, or debug endpoints in this change.

---

### Task 1: Persist Post administrators and optional bindings

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `migrations/0005_create_post_admin_table.sql`
- Generated: `src/generated/prisma/**`

**Interfaces:**
- Produces: `PostAdmin { id, email, password, organization, role, userId?, createdAt, updatedAt }`.
- Produces: optional `User.postAdmin` relation and unique nullable `PostAdmin.userId`.

- [ ] **Step 1: Add the Prisma relation**

```prisma
model User {
  id                Int                @id @default(autoincrement())
  username          String             @unique
  email             String?
  phone             String?
  password          String
  hypergryphAccount HypergryphAccount?
  postAdmin         PostAdmin?
  isAdmin           Boolean            @default(false)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
}

model PostAdmin {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  password     String
  organization String   @default("")
  role         String   @default("")
  userId       Int?     @unique
  user         User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Step 2: Add a forward-only D1 migration**

```sql
CREATE TABLE "PostAdmin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "organization" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "userId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostAdmin_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PostAdmin_email_key" ON "PostAdmin"("email");
CREATE UNIQUE INDEX "PostAdmin_userId_key" ON "PostAdmin"("userId");
```

- [ ] **Step 3: Generate and validate Prisma artifacts**

Run: `npx prisma format && npx prisma generate && npx prisma validate`
Expected: all three commands exit 0.

### Task 2: Add Post-admin request contracts and independent JWT support

**Files:**
- Create: `src/model/post/postAdmin.ts`
- Create: `src/lib/postAdminJwt.ts`
- Modify: `src/middleware/auth.ts`

**Interfaces:**
- Produces: registration, validation, login, and public Post-admin response types.
- Produces: `generatePostAdminToken`, `getCurrentPostAdmin`, `setPostAdminAuthCookie`, `clearPostAdminAuthCookie`.
- Produces: `postAdminAuthMiddleware`, setting `c.get('postAdmin')` to `{ id, email }`.

- [ ] **Step 1: Define request and response types**

```ts
export interface PostAdminRegisterRequestPayload { email: string; password: string }
export interface PostAdminValidateRequestPayload { email: string; token: string }
export interface PostAdminLoginRequestPayload { email: string; password: string }
export interface PostAdminIdentity { id: number; email: string }
```

- [ ] **Step 2: Implement a typed Post-admin JWT**

Use the existing `JWT_SECRET`, add `kind: 'post-admin'`, sign with HS256 for 24 hours, and read/write only the `post_auth_token` cookie.

- [ ] **Step 3: Add Post-admin middleware**

Reject missing, invalid, expired, or wrong-kind tokens with HTTP 401; never accept a normal-user token as a Post-admin token.

### Task 3: Implement secure Post-admin registration and login

**Files:**
- Create: `src/service/post/postAdminService.ts`
- Create: `src/controller/post/postAdminController.ts`
- Create: `src/common/Email/template/postAdminVerificationTemplate.tsx`

**Interfaces:**
- Produces service parsers and operations for availability, registration initialization, validation, login, logout, and current identity.
- Consumes: `getPrismaClient`, `getKV`, `getEmailManager`, bcrypt config, Post-admin JWT helpers.

- [ ] **Step 1: Validate registration and login input**

Use Joi email validation. Require passwords of 6-128 characters containing upper-case, lower-case, and a special character, matching normal-user registration policy.

- [ ] **Step 2: Initialize registration**

Generate a cryptographically random token, store JSON `{ passwordHash, tokenHash }` at `post-admin-registration:<email>` with `expirationTtl: 1800`, and send the raw token only by email. Remove the KV entry if email delivery fails.

- [ ] **Step 3: Validate registration**

Read and parse the KV entry, compare SHA-256 token hashes in constant time, create an unbound `PostAdmin`, then delete the KV entry. A bad token must not consume the registration entry.

- [ ] **Step 4: Implement login, logout, and current identity**

Return a generic invalid-credentials response, set/clear the dedicated cookie, and never serialize the password hash.

- [ ] **Step 5: Wrap services in controllers**

Use `buildContextJson` and `buildErrorContextJson` so Post endpoints match the CommonServerAPI response contract.

### Task 4: Bind and unbind both identity domains

**Files:**
- Modify: `src/service/post/postAdminService.ts`
- Modify: `src/controller/post/postAdminController.ts`
- Modify: `src/service/user/userService.ts`

**Interfaces:**
- Produces: `bindCurrentUserService` and `unbindCurrentUserService`.
- Consumes: `c.get('user')` and `c.get('postAdmin')` populated by both authentication middleware functions.

- [ ] **Step 1: Implement binding**

Resolve both identities from D1. Return 409 if the Post administrator is bound to another user or the user already owns another Post administrator. Otherwise update `PostAdmin.userId`.

- [ ] **Step 2: Implement unbinding**

Only clear `userId` when the active normal user owns the active Post administrator binding; otherwise return 409.

- [ ] **Step 3: Expose binding in normal-user current data**

Include `postAdmin` in `getCurrentUserService` and omit the Post-admin password field from the returned relation.

### Task 5: Route the Post-admin API and verify behavior

**Files:**
- Create: `src/router/post/postAdmin.ts`
- Create: `src/router/post/post.ts`
- Modify: `src/router/router.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/service/post/postAdminService.test.ts`
- Modify: `README.md`
- Modify: `src/controller/user/userController.ts`
- Modify: `src/router/user/superAdmin.ts`

**Interfaces:**
- Produces endpoints under `/post/admin`.

- [ ] **Step 1: Mount routes**

```text
POST   /post/admin/register/valid-email
POST   /post/admin/register/init
POST   /post/admin/register/validate
POST   /post/admin/login
POST   /post/admin/logout
GET    /post/admin/current
POST   /post/admin/binding
DELETE /post/admin/binding
```

The last two routes apply both `authMiddleware` and `postAdminAuthMiddleware`.

- [ ] **Step 2: Add focused unit tests**

Test valid/invalid registration parsing, wrong token kind rejection helpers, public Post-admin serialization, and binding conflict decisions without requiring production D1 credentials.

- [ ] **Step 3: Fix baseline type blockers**

Reject a missing `:username` route parameter before calling the service and use a locally typed bearer middleware compatible with the router binding type.

- [ ] **Step 4: Document endpoints and deployment prerequisites**

Document that Post administrators may be unbound, both sessions are required for binding, and no PostAPI secret values are copied.

- [ ] **Step 5: Run verification**

Run:

```bash
npm test
npx prisma validate
npx tsc --noEmit
npx wrangler types
npx wrangler deploy --dry-run
```

Expected: every command exits 0; generated Worker binding types contain the existing D1/KV/R2/workflow bindings.
