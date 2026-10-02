import { Hono } from 'hono';
import { expect, it, vi } from 'vitest';
import router from '@/router/router';
import superAdminController from '@/controller/user/superAdminController';
import { getPrismaClient } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({ getPrismaClient: vi.fn(() => { throw new Error('Unexpected database access'); }) }));
const app = new Hono().route('/', router);
const bodyRoutes = [
    '/user/login', '/user/register', '/user/email/verify',
    '/post/admin/register/valid-email', '/post/admin/register/init', '/post/admin/register/validate', '/post/admin/login',
    '/game/hypergryph/sms', '/game/hypergryph/token/sms', '/game/hypergryph/token/password', '/game/hypergryph/token/oauth',
    '/game/hypergryph/skLand/cred', '/game/hypergryph/skLand/accounts', '/game/hypergryph/skLand/checkIn',
];
it.each(bodyRoutes)('rejects malformed input at the real route %s before any database access', async path => {
    const response = await app.request(path, { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: 'Invalid JSON', httpStatus: 400 });
    expect(getPrismaClient).not.toHaveBeenCalled();
});
it('keeps super administrator input validation consistent', async () => {
    const controller = new Hono().post('/', superAdminController.setUserAsAdmin);
    expect((await controller.request('/', { method: 'POST', body: '{' })).status).toBe(400);
});
it.each(['/user/current', '/post/admin/current', '/game/hypergryph/account/games'])('retains authentication at %s', async path => {
    expect((await app.request(path)).status).toBe(401);
});
it.each(['/post/admin/binding', '/game/hypergryph/account'])('retains authentication before parsing mutations at %s', async path => {
    expect((await app.request(path, { method: 'POST', body: '{' })).status).toBe(401);
    expect((await app.request(path, { method: 'DELETE' })).status).toBe(401);
});
