import { Hono } from 'hono';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@/generated/prisma';
import { createTestDatabase } from '../../helpers/d1';
import { userRegisterService, sendEmailVerificationCodeService } from '@/service/user/userService';
import { buildContextJson } from '@/util/hono';

const { storage, sendEmail } = vi.hoisted(() => ({ storage: new Map<string, string>(), sendEmail: vi.fn() }));
vi.mock('@/lib/KV', () => ({ getKV: () => ({
    get: async (key: string) => storage.get(key) ?? null,
    put: async (key: string, value: string) => { storage.set(key, value); },
    delete: async (key: string) => { storage.delete(key); },
}) }));
vi.mock('@/lib/emailManager', () => ({ getEmailManager: () => ({ sendEmail }) }));
vi.mock('@/common/service/verificationService', async original => ({
    ...await original<object>(), generateVerificationCode: () => '123456',
}));
let database: ReturnType<typeof createTestDatabase>;
let prisma: PrismaClient;
vi.mock('@/lib/prisma', () => ({ getPrismaClient: () => prisma }));
const app = new Hono();
app.post('/code', async c => buildContextJson(c, await sendEmailVerificationCodeService(c, await c.req.json())));
app.post('/register', async c => buildContextJson(c, await userRegisterService(c, await c.req.json())));
const email = 'concurrent@example.com';
const call = (path: string, data: unknown) => app.request(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
}, { DB: database.db, JWT_SECRET: 'synthetic-registration-secret' });
const register = (username: string) => call('/register', { username, email, password: 'Strong!Password', registrationCode: '123456' });
beforeEach(() => {
    database = createTestDatabase();
    prisma = new PrismaClient({ adapter: new PrismaD1(database.db) });
    storage.clear();
    sendEmail.mockReset().mockResolvedValue({ data: { id: 'synthetic-mail' }, error: null });
});
afterEach(async () => { await prisma.$disconnect(); database.sqlite.close(); });

it('creates exactly one account when two usernames race with the same email and code', async () => {
    expect((await call('/code', { email, type: 'register' })).status).toBe(200);
    const responses = await Promise.all([register('first-user'), register('second-user')]);
    expect(responses.filter(r => r.status === 201)).toHaveLength(1);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM User WHERE email=?').get(email)?.count).toBe(1);
    const response = responses.find(r => r.status === 201)!;
    const json = await response.json<{ data: { user: Record<string, unknown> } }>();
    expect(json.data.user.password).toBeUndefined();
    expect(response.headers.get('set-cookie')).toContain('auth_token=');
    expect((await register('third-user')).status).toBe(409);
});

it('keeps a challenge on username conflict and rejects wrong or expired codes', async () => {
    await call('/code', { email, type: 'register' });
    database.sqlite.prepare("INSERT INTO User(username,email,password,updatedAt) VALUES ('taken','other@example.com','hash',CURRENT_TIMESTAMP)").run();
    expect((await register('taken')).status).toBe(409);
    expect((await call('/register', { username: 'available', email, password: 'Strong!Password', registrationCode: '000000' })).status).toBe(400);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM RegistrationChallenge').get()?.count).toBe(1);
    database.sqlite.exec('UPDATE RegistrationChallenge SET expiresAt=0');
    expect((await register('available')).status).toBe(400);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM User').get()?.count).toBe(1);
    await call('/code', { email, type: 'register' });
    expect((await register('available')).status).toBe(201);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM RegistrationChallenge').get()?.count).toBe(0);
});

it('checks challenge expiry again in the write transaction', async () => {
    await call('/code', { email, type: 'register' });
    const batch = database.db.batch.bind(database.db);
    database.db.batch = statements => {
        database.sqlite.exec('UPDATE RegistrationChallenge SET expiresAt=0');
        return batch(statements);
    };
    expect((await register('available')).status).toBe(400);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM User').get()?.count).toBe(0);
});

it('stores a hash, suppresses duplicate sends, and cleans up failed delivery', async () => {
    expect((await call('/code', { email, type: 'register' })).status).toBe(200);
    expect((await call('/code', { email, type: 'register' })).status).toBe(429);
    expect(database.sqlite.prepare('SELECT codeHash FROM RegistrationChallenge').get()?.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storage.size).toBe(0);
    database.sqlite.exec('UPDATE RegistrationChallenge SET expiresAt=0');
    sendEmail.mockResolvedValueOnce({ data: null, error: { message: 'Delivery unavailable' } });
    expect((await call('/code', { email, type: 'register' })).status).toBe(500);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM RegistrationChallenge').get()?.count).toBe(0);
});

it('preserves a losing username-race challenge for a later retry', async () => {
    const secondEmail = 'second@example.com';
    await call('/code', { email, type: 'register' });
    await call('/code', { email: secondEmail, type: 'register' });
    const responses = await Promise.all([register('shared'), call('/register', {
        username: 'shared', email: secondEmail, password: 'Strong!Password', registrationCode: '123456',
    })]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    const pending = database.sqlite.prepare('SELECT email FROM RegistrationChallenge').get()!;
    const retry = await call('/register', { username: 'different', email: pending.email, password: 'Strong!Password', registrationCode: '123456' });
    expect(retry.status).toBe(201);
});
