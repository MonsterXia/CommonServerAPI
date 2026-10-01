import { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPostAdminEmailAvailabilityService, initializePostAdminRegistrationService, validatePostAdminRegistrationService } from '@/service/post/postAdminService';
import { sha256Hash } from '@/common/service/verificationService';

const { storage, create, sendEmail } = vi.hoisted(() => ({
    storage: new Map<string, string>(),
    create: vi.fn(),
    sendEmail: vi.fn(),
}));
vi.mock('@/lib/KV', () => ({ getKV: () => ({
    get: async (key: string) => storage.get(key) ?? null,
    put: async (key: string, value: string) => { storage.set(key, value); },
    delete: async (key: string) => { storage.delete(key); },
}) }));
vi.mock('@/lib/prisma', () => ({ getPrismaClient: () => ({
    postAdmin: { findUnique: async () => null, create },
}) }));
vi.mock('@/lib/emailManager', () => ({ getEmailManager: () => ({ sendEmail }) }));

const email = 'admin@example.com';
const key = `post-admin-registration:${email}`;

describe('registration token and password pairing', () => {
    beforeEach(() => {
        storage.clear();
        vi.resetAllMocks();
        sendEmail.mockResolvedValue({ data: { id: 'email-id' }, error: null });
        create.mockImplementation(async ({ data }) => ({
            ...data, id: 1, userId: null, organization: '', role: '',
            createdAt: new Date(), updatedAt: new Date(),
        }));
    });

    it('stores the password and token hash in one registration record', async () => {
        const result = await initializePostAdminRegistrationService(
            { env: { APP_ENV: 'development' } } as Context,
            { email, password: 'Secure!Password' },
        );
        expect(result.success).toBe(true);
        const pending = JSON.parse(storage.get(key)!);
        expect(pending.passwordHash).toMatch(/^\$2/);
        expect(pending.tokenHash).toMatch(/^[a-f0-9]{64}$/);
        expect(storage.size).toBe(1);
    });

    it('rejects an old token even if the legacy token key is stale', async () => {
        storage.set(key, JSON.stringify({ passwordHash: 'new-password-hash', tokenHash: await sha256Hash('new-token') }));
        storage.set(`${key}:token`, await sha256Hash('old-token'));
        const result = await validatePostAdminRegistrationService({ email, token: 'old-token' });
        expect(result).toMatchObject({ success: false, httpStatus: 400 });
        expect(create).not.toHaveBeenCalled();
    });

    it('creates the account from the password paired with the accepted token', async () => {
        storage.set(key, JSON.stringify({ passwordHash: 'matching-password-hash', tokenHash: await sha256Hash('new-token') }));
        const result = await validatePostAdminRegistrationService({ email, token: 'new-token' });
        expect(result).toMatchObject({ success: true, httpStatus: 201, data: { email } });
        expect(create).toHaveBeenCalledWith({ data: { email, password: 'matching-password-hash' } });
        expect(result.data).not.toHaveProperty('password');
        expect(storage.has(key)).toBe(false);
    });

    it('expires legacy split records instead of trusting an unpaired password', async () => {
        storage.set(key, JSON.stringify({ passwordHash: 'unpaired-password' }));
        storage.set(`${key}:token`, await sha256Hash('old-token'));
        expect(await validatePostAdminRegistrationService({ email, token: 'old-token' }))
            .toMatchObject({ success: false, httpStatus: 410 });
        expect(create).not.toHaveBeenCalled();
    });
    it('does not advertise an email with a pending registration as available', async () => {
        storage.set(key, JSON.stringify({ passwordHash: 'pending', tokenHash: 'pending' }));
        expect(await checkPostAdminEmailAvailabilityService(email))
            .toMatchObject({ success: true, data: false, httpStatus: 200 });
    });

    it('preserves the first verification link when registration is retried', async () => {
        const pending = JSON.stringify({ passwordHash: 'first-password', tokenHash: 'first-token' });
        storage.set(key, pending);
        const result = await initializePostAdminRegistrationService(
            { env: { APP_ENV: 'development' } } as Context,
            { email, password: 'Second!Password' },
        );
        expect(result).toMatchObject({ success: false, httpStatus: 409 });
        expect(storage.get(key)).toBe(pending);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('returns a conflict if another validation created the account first', async () => {
        storage.set(key, JSON.stringify({ passwordHash: 'password', tokenHash: await sha256Hash('token') }));
        create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
        expect(await validatePostAdminRegistrationService({ email, token: 'token' }))
            .toMatchObject({ success: false, httpStatus: 409 });
    });

});
