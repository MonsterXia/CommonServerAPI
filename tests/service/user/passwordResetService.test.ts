import { DatabaseSync } from 'node:sqlite';
import { URL as NodeURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendPasswordResetCode, resetPassword } from '@/service/user/passwordResetService';
import { buildContextJson } from '@/util/hono';
import bcrypt from 'bcryptjs';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('@/common/service/verificationService', async importOriginal => ({
    ...await importOriginal<object>(), generateVerificationCode: () => '123456', sendVerificationEmail: sendMail,
}));
let sqlite: DatabaseSync;
function prepare(sql: string) {
    let args: (string | number)[] = [];
    return {
        bind(...values: (string | number)[]) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) ?? null; },
        async run() { const meta = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(meta.changes) } }; },
    };
}
const env = { JWT_SECRET: 'reset-test-secret', DB: { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
} } };
const app = new Hono();
app.post('/code', async c => buildContextJson(c, await sendPasswordResetCode(c, await c.req.json())));
app.post('/reset', async c => buildContextJson(c, await resetPassword(c, await c.req.json())));
const identity = { username: 'alice', email: 'alice@example.com' };
const reset = { ...identity, code: '123456', password: 'NewPassword1!' };
const call = (path: string, data: unknown) => app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }, env);

beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('CREATE TABLE User (id INTEGER PRIMARY KEY, username TEXT UNIQUE, email TEXT, password TEXT, updatedAt TEXT)');
    sqlite.exec(readFileSync(new NodeURL('../../../migrations/0006_password_reset.sql', import.meta.url), 'utf8'));
    sqlite.prepare('INSERT INTO User(id,username,email,password) VALUES (1,?,?,?)').run(identity.username, identity.email, 'old-hash');
    sendMail.mockReset().mockResolvedValue({ success: true });
});
afterEach(() => sqlite.close());
describe('password reset with real SQLite transaction semantics', () => {
    it('stores only a hash, enforces cooldown, resets once and revokes sessions', async () => {
        expect((await call('/code', identity)).status).toBe(200);
        expect((await call('/code', identity)).status).toBe(200);
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(sqlite.prepare('SELECT codeHash FROM PasswordResetChallenge').get()?.codeHash).not.toBe('123456');
        const response = await call('/reset', reset);
        expect(response.status).toBe(200);
        expect(response.headers.get('set-cookie')).toContain('auth_token=');
        const user = sqlite.prepare('SELECT password,sessionVersion FROM User').get()!;
        expect(user.sessionVersion).toBe(1);
        expect(await bcrypt.compare(reset.password, user.password as string)).toBe(true);
        expect((await call('/reset', reset)).status).toBe(400);
    });
    it('rejects expired codes and weak passwords', async () => {
        await call('/code', identity);
        expect((await call('/reset', { ...reset, password: 'weak' })).status).toBe(400);
        sqlite.exec('UPDATE PasswordResetChallenge SET expiresAt=0');
        expect((await call('/reset', reset)).status).toBe(400);
        expect(sqlite.prepare('SELECT password FROM User').get()?.password).toBe('old-hash');
    });
    it('locks a challenge after five incorrect attempts', async () => {
        await call('/code', identity);
        for (let n=0; n<5; n++) expect((await call('/reset', { ...reset, code: '654321' })).status).toBe(400);
        expect((await call('/reset', reset)).status).toBe(400);
        await call('/code', identity);
        expect(sendMail).toHaveBeenCalledTimes(1);
    });
    it('does not send mail for a mismatched account and cleans up failed delivery', async () => {
        expect((await call('/code', { ...identity, email: 'other@example.com' })).status).toBe(200);
        expect(sendMail).not.toHaveBeenCalled();
        sendMail.mockResolvedValue({ success: false });
        expect((await call('/code', identity)).status).toBe(503);
        expect(sqlite.prepare('SELECT COUNT(*) AS count FROM PasswordResetChallenge').get()?.count).toBe(0);
    });
});
