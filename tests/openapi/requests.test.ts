import { beforeEach, describe, expect, it, vi } from 'vitest';
import router from '@/router/router';
import { normalizeGameOverview } from '@/service/game/hypergryph/skIsland/overview';
import { getCurrentUser } from '@/lib/jwt';
import { getCurrentPostAdmin } from '@/lib/postAdminJwt';
import { userRegisterService } from '@/service/user/userService';
import { bindCurrentUserService } from '@/service/post/postAdminService';
import {
    bindHypergryphAccount,
    getBoundGames,
    getBoundGameOverview,
} from '@/service/game/hypergryph/accountService';
import { envelope, checkInResult, registrationResult, gameOverview } from '@/openapi/schemas';

vi.mock('@/lib/prisma', () => ({
    getPrismaClient: vi.fn(() => {
        throw new Error('Unexpected database access');
    }),
}));
vi.mock('@/lib/jwt', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getCurrentUser: vi.fn(),
}));
vi.mock('@/lib/postAdminJwt', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getCurrentPostAdmin: vi.fn(),
}));
vi.mock('@/service/user/userService', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    userRegisterService: vi.fn(),
}));
vi.mock('@/service/post/postAdminService', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    bindCurrentUserService: vi.fn(),
}));
vi.mock('@/service/game/hypergryph/accountService', () => ({
    bindHypergryphAccount: vi.fn(),
    unbindHypergryphAccount: vi.fn(),
    getBoundGames: vi.fn(),
    getBoundGameOverview: vi.fn(),
}));

const post = (path: string, input: unknown) =>
    router.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(getCurrentPostAdmin).mockResolvedValue(null);
});

describe('OpenAPI request boundary', () => {
    it.each([null, [], {}, { username: 1, password: 'secret' }, { username: 'test' }])(
        'rejects invalid login body %j before the service',
        async (input) => {
            const response = await post('/user/login', input);
            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                message: 'Invalid request',
                httpStatus: 400,
            });
        },
    );

    it('rejects an unsupported media type with the JSON error envelope', async () => {
        const response = await router.request('/user/login', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: '{"username":"test","password":"secret"}',
        });
        expect(response.status).toBe(415);
        expect(await response.json()).toMatchObject({ httpStatus: 415, error: null });
    });

    it.each(['/game/hypergryph/token/validate', '/game/hypergryph/skLand/cred/validate'])(
        'requires credential query parameters at %s',
        async (path) => {
            const response = await router.request(path);
            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({ httpStatus: 400 });
        },
    );

    it('keeps service normalization and registration response compatible', async () => {
        const data = {
            user: {
                id: 1,
                username: 'test-user',
                email: 'user@example.com',
                phone: null,
                isAdmin: false,
                sessionVersion: 0,
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z'),
            },
            token: 'fixture-token',
        };
        vi.mocked(userRegisterService).mockResolvedValue({
            success: true,
            message: 'Registered',
            data,
            httpStatus: 201,
        });
        const response = await post('/user/register', {
            username: 'test-user',
            email: ' User@Example.com ',
            password: 'Strong!Password',
            registrationCode: '123456',
        });
        expect(response.status).toBe(201);
        expect(userRegisterService).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ email: 'user@example.com' }),
        );
        expect(envelope(registrationResult, 201).safeParse(await response.json()).success).toBe(
            true,
        );
    });

    it('applies the shared UTF-8 password limit without echoing the password', async () => {
        const password = `Aa!${'界'.repeat(24)}`;
        const response = await post('/user/register', {
            username: 'test-user',
            email: 'user@example.com',
            password,
            registrationCode: '123456',
        });
        expect(response.status).toBe(400);
        expect(await response.text()).not.toContain(password);
        expect(userRegisterService).not.toHaveBeenCalled();
    });

    it.each([
        { phone: '13800000000', method: 'sms', code: 'bad' },
        { phone: '13800000000', method: 'sms', password: 'irrelevant' },
        { phone: '13800000000', method: 'password', password: '' },
        { phone: 'invalid', method: 'password', password: 'secret' },
    ])('validates the authenticated binding variant %j', async (input) => {
        vi.mocked(getCurrentUser).mockResolvedValue({ username: 'test-user' });
        const response = await post('/game/hypergryph/account', input);
        expect(response.status).toBe(400);
        expect(bindHypergryphAccount).not.toHaveBeenCalled();
    });

    it('returns 400 rather than 503 for malformed JSON after game-account authentication', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ username: 'test-user' });
        const response = await router.request('/game/hypergryph/account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{',
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ message: 'Invalid JSON', httpStatus: 400 });
    });

    it('requires both identities before binding accounts', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ username: 'test-user' });
        expect((await post('/post/admin/binding', {})).status).toBe(401);
        expect(bindCurrentUserService).not.toHaveBeenCalled();
        vi.mocked(getCurrentUser).mockResolvedValue(null);
        vi.mocked(getCurrentPostAdmin).mockResolvedValue({
            postAdminId: 1,
            email: 'admin@example.com',
            kind: 'post-admin',
        });
        expect((await post('/post/admin/binding', {})).status).toBe(401);
        expect(bindCurrentUserService).not.toHaveBeenCalled();
    });

    it('validates overview identifiers before reading linked roles', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ username: 'test-user' });
        const response = await router.request(
            '/game/hypergryph/account/overview?appCode=arknights&uid=test',
        );
        expect(response.status).toBe(400);
        expect(getBoundGameOverview).not.toHaveBeenCalled();
    });

    it.each(['arknights', 'endfield'])(
        'matches the %s overview schema with missing upstream fields',
        (appCode) => {
            const account = { appCode, uid: 'fixture', gameId: '1', nickName: 'Doctor' };
            const raw =
                appCode === 'arknights'
                    ? { status: { level: 1 } }
                    : { detail: { base: { level: 1 } } };
            const data = normalizeGameOverview(account, raw);
            expect(gameOverview.safeParse(JSON.parse(JSON.stringify(data))).success).toBe(true);
            expect(data.operators).toBeNull();
        },
    );

    it('preserves 207 and per-account failures after OpenAPI migration', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ username: 'test-user' });
        vi.mocked(getBoundGames).mockResolvedValue({
            success: true,
            message: 'Partial result',
            httpStatus: 207,
            data: {
                checkInResults: [],
                errorResults: [
                    {
                        appCode: 'arknights',
                        uid: 'test',
                        gameId: '1',
                        nickName: 'Doctor',
                        error: 'Upstream unavailable',
                    },
                ],
            },
        });
        const response = await router.request('/game/hypergryph/account/check-in', {
            method: 'POST',
        });
        expect(response.status).toBe(207);
        expect(envelope(checkInResult, 207).safeParse(await response.json()).success).toBe(true);
        expect(getBoundGames).toHaveBeenCalledWith(expect.anything(), true);
    });
});
