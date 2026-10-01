/**
 * User JWT utilities
 * Uses shared JWT core module for token operations
 */
import { Context } from 'hono';
import {
    generateJWTToken,
    verifyJWTToken,
    getTokenFromCookie,
    setAuthCookie as setAuthCookieCore,
    clearAuthCookie as clearAuthCookieCore,
} from './jwtCore';

import { getPrismaClient } from './prisma';

const USER_COOKIE_NAME = 'auth_token';

export interface JWTPayload extends Record<string, unknown> {
    username: string;
    exp?: number;
    sessionVersion?: number;
}

/**
 * Generate JWT token for user
 * @param c - Hono context
 * @param payload - User payload (username)
 * @returns Signed JWT token
 */
export const generateToken = async (
    c: Context,
    payload: Omit<JWTPayload, 'exp'>
): Promise<string> => {
    return generateJWTToken(c, payload);
};

/**
 * Verify user JWT token
 * @param c - Hono context
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export const verifyToken = async (
    c: Context,
    token: string
): Promise<JWTPayload | null> => {
    const payload = await verifyJWTToken<JWTPayload>(c, token);
    if (!payload || payload.kind !== undefined || typeof payload.username !== 'string' || !payload.username.trim()) {
        return null;
    }
    return payload;
};

/**
 * Get current user from cookie
 * @param c - Hono context
 * @returns User payload or null if not authenticated
 */
export const getCurrentUser = async (
    c: Context
): Promise<JWTPayload | null> => {
    const token = getTokenFromCookie(c, USER_COOKIE_NAME);
    if (!token) {
        return null;
    }
    const payload = await verifyToken(c, token);
    if (!payload) return null;
    const user = await getPrismaClient().user.findUnique({ where: { username: payload.username }, select: { sessionVersion: true } });
    if (!user || (payload.sessionVersion ?? 0) !== user.sessionVersion) return null;
    return payload;
};

/**
 * Set user authentication cookie
 * @param c - Hono context
 * @param token - JWT token to store
 */
export const setAuthCookie = (c: Context, token: string) => {
    setAuthCookieCore(c, USER_COOKIE_NAME, token);
};

/**
 * Clear user authentication cookie
 * @param c - Hono context
 */
export const clearAuthCookie = (c: Context) => {
    clearAuthCookieCore(c, USER_COOKIE_NAME);
};
