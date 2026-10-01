import { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCurrentUserService, unbindCurrentUserService } from '@/service/post/postAdminService';

const { findUser, findAdmin, updateAdmin } = vi.hoisted(() => ({
    findUser: vi.fn(), findAdmin: vi.fn(), updateAdmin: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ getPrismaClient: () => ({
    user: { findUnique: findUser },
    postAdmin: { findUnique: findAdmin, update: updateAdmin },
}) }));

const context = {
    get: (key: string) => key === 'user' ? { username: 'alice' } : { id: 2, email: 'admin@example.com' },
} as Context;
const admin = {
    id: 2, email: 'admin@example.com', password: 'hash', organization: '', role: '',
    userId: null as number | null, createdAt: new Date(), updatedAt: new Date(),
};

describe('Post administrator binding writes', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        findUser.mockResolvedValue({ id: 1, username: 'alice', postAdmin: null });
        findAdmin.mockResolvedValue({ ...admin });
    });

    it.each([
        { operation: bindCurrentUserService, readUserId: null, name: 'bind' },
        { operation: unbindCurrentUserService, readUserId: 1, name: 'unbind' },
    ])('does not $name a binding acquired by someone else after the read', async ({ operation, readUserId }) => {
        findAdmin.mockResolvedValue({ ...admin, userId: readUserId });
        // Another request has already rebound this administrator before our write.
        const stored = { ...admin, userId: 3 as number | null };
        updateAdmin.mockImplementation(async ({ where, data }) => {
            const ownerFilter = where.AND ?? where;
            if ('userId' in ownerFilter && ownerFilter.userId !== stored.userId) {
                throw Object.assign(new Error('Record not found'), { code: 'P2025' });
            }
            Object.assign(stored, data);
            return { ...stored };
        });
        const result = await operation(context);
        expect(stored.userId).toBe(3);
        expect(result).toMatchObject({ success: false, httpStatus: 409 });
    });

    it('returns a conflict when a concurrent bind hits the unique user constraint', async () => {
        updateAdmin.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
        expect(await bindCurrentUserService(context)).toMatchObject({ success: false, httpStatus: 409 });
    });

    it('still binds an unbound administrator without leaking the password', async () => {
        updateAdmin.mockImplementation(async ({ data }) => ({ ...admin, ...data }));
        const result = await bindCurrentUserService(context);
        expect(result).toMatchObject({ success: true, httpStatus: 200, data: { userId: 1 } });
        expect(result.data).not.toHaveProperty('password');
    });

    it('still unbinds a matching pair', async () => {
        findAdmin.mockResolvedValue({ ...admin, userId: 1 });
        updateAdmin.mockImplementation(async ({ data }) => ({ ...admin, ...data }));
        expect(await unbindCurrentUserService(context))
            .toMatchObject({ success: true, httpStatus: 200, data: { userId: null } });
    });
});
