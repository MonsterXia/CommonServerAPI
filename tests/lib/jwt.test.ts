import { Hono, type Context } from 'hono';
import { sign } from 'hono/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateToken, verifyToken } from '@/lib/jwt';
import { generatePostAdminToken } from '@/lib/postAdminJwt';
import { authMiddleware } from '@/middleware/auth';

const { findUser } = vi.hoisted(() => ({ findUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ getPrismaClient: () => ({ user: { findUnique: findUser } }) }));
beforeEach(() => findUser.mockReset().mockResolvedValue({ sessionVersion: 0 }));

const env = { JWT_SECRET: 'test-secret-for-identity-isolation' };
const context = { env } as Context;

describe('normal-user authentication', () => {
    it('accepts existing username tokens', async () => {
        const token = await generateToken(context, { username: 'alice' });
        await expect(verifyToken(context, token)).resolves.toMatchObject({ username: 'alice' });
    });

    it('rejects a Post administrator token used as a normal-user cookie', async () => {
        const token = await generatePostAdminToken(context, { id: 1, email: 'admin@example.com' });
        const app = new Hono();
        app.get('/protected', authMiddleware, c => c.json(c.get('user')));
        const response = await app.request('/protected', {
            headers: { Cookie: `auth_token=${token}` },
        }, env);
        expect(response.status).toBe(401);
    });

    it.each([undefined, '', '   ', 42])('rejects invalid username %s', async username => {
        const token = await sign({ username, exp: Math.floor(Date.now() / 1000) + 60 }, env.JWT_SECRET, 'HS256');
        await expect(verifyToken(context, token)).resolves.toBeNull();
    });
});


it('revokes old sessions after password reset while accepting newly issued sessions', async () => {
    const app = new Hono();
    app.get('/protected', authMiddleware, c => c.json(c.get('user')));
    findUser.mockResolvedValue({ sessionVersion: 1 });
    for (const version of [undefined, 0, 1]) {
        const token = await generateToken(context, { username: 'alice', ...(version === undefined ? {} : { sessionVersion: version }) });
        const response = await app.request('/protected', { headers: { Cookie: `auth_token=${token}` } }, env);
        expect(response.status).toBe(version === 1 ? 200 : 401);
    }
});
