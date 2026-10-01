import { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userPasswordLoginParser, userRegisterParser, sendEmailVerificationCodeParser, userPasswordLoginService, getCurrentUserService } from '@/service/user/userService';
import { setAdminParser, setAdminService } from '@/service/user/superAdminService';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ getPrismaClient: () => ({ user: { findUnique } }) }));

describe('user request validation and response status', () => {
    beforeEach(() => vi.resetAllMocks());

    it.each([userPasswordLoginParser, userRegisterParser, sendEmailVerificationCodeParser, setAdminParser])(
        'rejects a null request body with 400', parser => {
            expect(parser(null)).toMatchObject({ success: false, httpStatus: 400 });
        },
    );

    it('returns 400 when the administrator target is missing', () => {
        expect(setAdminParser({})).toMatchObject({ success: false, httpStatus: 400 });
    });

    it('returns 404 when the administrator target does not exist', async () => {
        findUnique.mockResolvedValue(null);
        await expect(setAdminService({} as Context, { username: 'missing' }))
            .resolves.toMatchObject({ success: false, httpStatus: 404 });
    });

    it('rejects an unknown login with the same status as a wrong password', async () => {
        findUnique.mockResolvedValue(null);
        await expect(userPasswordLoginService({} as Context, { username: 'missing', password: 'wrong' }))
            .resolves.toMatchObject({ success: false, httpStatus: 403 });
    });
});


describe('public current user response', () => {
    beforeEach(() => vi.resetAllMocks());
    const context = { get: () => ({ username: 'alice' }) } as unknown as Context;

    it('returns 404 when a valid session refers to a deleted user', async () => {
        findUnique.mockResolvedValue(null);
        await expect(getCurrentUserService(context)).resolves.toMatchObject({ success: false, httpStatus: 404, data: null });
    });

    it('selects only public user and linked account fields', async () => {
        const profile = { id: 1, username: 'alice', email: null, phone: null, isAdmin: false,
            createdAt: new Date(), updatedAt: new Date(), hypergryphAccount: null, postAdmin: null };
        findUnique.mockResolvedValue(profile);
        const response = await getCurrentUserService(context);
        expect(response.data).toEqual(profile);
        expect(findUnique).toHaveBeenCalledTimes(1);
        const query = findUnique.mock.calls[0][0];
        expect(query.select.username).toBe(true);
        expect(query.select.password).toBeUndefined();
        expect(query.select.hypergryphAccount.select.token).toBeUndefined();
        expect(query.select.hypergryphAccount.select.phone).toBe(true);
        expect(query.select.postAdmin.select.password).toBeUndefined();
    });
});
