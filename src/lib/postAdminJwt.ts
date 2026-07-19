/**
 * Post Administrator JWT utilities
 * Uses shared JWT core module for token operations
 */
import { Context } from 'hono';
import { PostAdminIdentity } from '@/model/post/postAdmin';
import {
    generateJWTToken,
    verifyJWTToken,
    getTokenFromCookie,
    setAuthCookie,
    clearAuthCookie,
} from './jwtCore';

const POST_ADMIN_COOKIE_NAME = 'post_auth_token';

export interface PostAdminJWTPayload extends Record<string, unknown> {
    postAdminId: number;
    email: string;
    kind: 'post-admin';
    exp?: number;
}

/**
 * Generate JWT token for post administrator
 * @param c - Hono context
 * @param identity - Post admin identity (id and email)
 * @returns Signed JWT token
 */
export const generatePostAdminToken = async (
    c: Context,
    identity: PostAdminIdentity
): Promise<string> => {
    return generateJWTToken(c, {
        postAdminId: identity.id,
        email: identity.email,
        kind: 'post-admin',
    });
};

/**
 * Verify post administrator JWT token
 * @param c - Hono context
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export const verifyPostAdminToken = async (
    c: Context,
    token: string
): Promise<PostAdminJWTPayload | null> => {
    const payload = await verifyJWTToken<PostAdminJWTPayload>(c, token);

    if (
        !payload ||
        payload.kind !== 'post-admin' ||
        typeof payload.postAdminId !== 'number' ||
        typeof payload.email !== 'string'
    ) {
        return null;
    }

    return payload;
};

/**
 * Get current post admin from cookie
 * @param c - Hono context
 * @returns Post admin payload or null if not authenticated
 */
export const getCurrentPostAdmin = async (
    c: Context
): Promise<PostAdminJWTPayload | null> => {
    const token = getTokenFromCookie(c, POST_ADMIN_COOKIE_NAME);
    if (!token) {
        return null;
    }
    return verifyPostAdminToken(c, token);
};

/**
 * Set post admin authentication cookie
 * @param c - Hono context
 * @param token - JWT token to store
 */
export const setPostAdminAuthCookie = (c: Context, token: string) => {
    setAuthCookie(c, POST_ADMIN_COOKIE_NAME, token);
};

/**
 * Clear post admin authentication cookie
 * @param c - Hono context
 */
export const clearPostAdminAuthCookie = (c: Context) => {
    clearAuthCookie(c, POST_ADMIN_COOKIE_NAME);
};
