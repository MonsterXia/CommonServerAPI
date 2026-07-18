import { Context } from 'hono';
import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';
import {
    generatePostAdminToken,
    verifyPostAdminToken,
} from '@/lib/postAdminJwt';
import {
    postAdminEmailParser,
    getPostAdminBindingDecision,
    postAdminRegisterParser,
    postAdminValidationParser,
    toPublicPostAdmin,
} from './postAdminService';

const contextWithSecret = {
    env: {
        JWT_SECRET: 'unit-test-secret',
    },
} as Context;

describe('Post administrator request parsing', () => {
    it('normalizes a valid email address', () => {
        const result = postAdminEmailParser({ email: ' Admin@Example.COM ' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ email: 'admin@example.com' });
    });

    it('rejects an invalid email address', () => {
        const result = postAdminEmailParser({ email: 'not-an-email' });

        expect(result.success).toBe(false);
        expect(result.httpStatus).toBe(400);
    });

    it('accepts a password matching the normal-user policy', () => {
        const result = postAdminRegisterParser({
            email: 'admin@example.com',
            password: 'Secure!Password',
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
            email: 'admin@example.com',
            password: 'Secure!Password',
        });
    });

    it('rejects a weak password', () => {
        const result = postAdminRegisterParser({
            email: 'admin@example.com',
            password: 'password',
        });

        expect(result.success).toBe(false);
        expect(result.httpStatus).toBe(400);
    });

    it('requires a registration verification token', () => {
        const result = postAdminValidationParser({ email: 'admin@example.com' });

        expect(result.success).toBe(false);
        expect(result.httpStatus).toBe(400);
    });
});

describe('Post administrator identity isolation', () => {
    it('accepts a dedicated Post administrator token', async () => {
        const token = await generatePostAdminToken(contextWithSecret, {
            id: 7,
            email: 'admin@example.com',
        });

        const payload = await verifyPostAdminToken(contextWithSecret, token);

        expect(payload).toMatchObject({
            postAdminId: 7,
            email: 'admin@example.com',
            kind: 'post-admin',
        });
    });

    it('rejects a normal-user token signed with the same secret', async () => {
        const token = await sign(
            {
                username: 'normal-user',
                exp: Math.floor(Date.now() / 1000) + 60,
            },
            contextWithSecret.env.JWT_SECRET,
            'HS256'
        );

        await expect(verifyPostAdminToken(contextWithSecret, token)).resolves.toBeNull();
    });
});

describe('Post administrator response serialization', () => {
    it('never exposes the password hash', () => {
        const publicPostAdmin = toPublicPostAdmin({
            id: 1,
            email: 'admin@example.com',
            password: 'hashed-password',
            organization: 'Example',
            role: 'owner',
            userId: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        });

        expect(publicPostAdmin).not.toHaveProperty('password');
        expect(publicPostAdmin.userId).toBeNull();
    });
});

describe('Post administrator binding decisions', () => {
    it('allows two unbound identities to bind', () => {
        expect(getPostAdminBindingDecision({
            userId: 1,
            userPostAdminId: null,
            postAdminId: 2,
            postAdminUserId: null,
        })).toBe('bind');
    });

    it('treats an existing matching binding as idempotent', () => {
        expect(getPostAdminBindingDecision({
            userId: 1,
            userPostAdminId: 2,
            postAdminId: 2,
            postAdminUserId: 1,
        })).toBe('already-bound');
    });

    it('rejects a Post administrator bound to another user', () => {
        expect(getPostAdminBindingDecision({
            userId: 1,
            userPostAdminId: null,
            postAdminId: 2,
            postAdminUserId: 3,
        })).toBe('post-admin-bound-elsewhere');
    });

    it('rejects a user bound to another Post administrator', () => {
        expect(getPostAdminBindingDecision({
            userId: 1,
            userPostAdminId: 4,
            postAdminId: 2,
            postAdminUserId: null,
        })).toBe('user-bound-elsewhere');
    });
});
