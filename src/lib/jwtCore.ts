/**
 * Shared JWT core utilities
 */
import { Context } from 'hono';
import { sign, verify } from 'hono/jwt';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { JWT_EXPIRATION_TIME, JWT_SIGN_METHOD } from '@/common/config/jwtConfig';

/**
 * Get JWT secret from environment
 * @param c - Hono context
 * @returns JWT secret string
 * @throws Error if JWT_SECRET is not configured
 */
export const getJWTSecret = (c: Context): string => {
    const secret = c.env?.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not configured');
    }
    return secret;
};

/**
 * Generate JWT token with expiration
 * @param c - Hono context
 * @param payload - Token payload (without exp)
 * @param secret - JWT secret (optional, will be retrieved from context if not provided)
 * @returns Signed JWT token
 */
export const generateJWTToken = async (
    c: Context,
    payload: Record<string, unknown>,
    secret?: string
): Promise<string> => {
    const jwtSecret = secret || getJWTSecret(c);
    const exp = Math.floor(Date.now() / 1000) + JWT_EXPIRATION_TIME;
    return sign(
        { ...payload, exp },
        jwtSecret,
        JWT_SIGN_METHOD
    );
};

/**
 * Verify JWT token and return payload
 * @param c - Hono context
 * @param token - JWT token to verify
 * @param secret - JWT secret (optional, will be retrieved from context if not provided)
 * @returns Decoded payload or null if invalid
 */
export const verifyJWTToken = async <T extends Record<string, unknown>>(
    c: Context,
    token: string,
    secret?: string
): Promise<T | null> => {
    try {
        const jwtSecret = secret || getJWTSecret(c);
        const payload = await verify(token, jwtSecret, JWT_SIGN_METHOD) as T;
        return payload;
    } catch {
        return null;
    }
};

/**
 * Get token from cookie
 * @param c - Hono context
 * @param cookieName - Name of the cookie
 * @returns Token string or null
 */
export const getTokenFromCookie = (c: Context, cookieName: string): string | null => {
    return getCookie(c, cookieName) || null;
};

/**
 * Set authentication cookie
 * @param c - Hono context
 * @param cookieName - Name of the cookie
 * @param token - JWT token to store
 * @param secure - Whether to set secure flag (default: auto-detect from protocol)
 */
export const setAuthCookie = (
    c: Context,
    cookieName: string,
    token: string,
    secure?: boolean
): void => {
    const isSecure = secure ?? new URL(c.req.url).protocol === 'https:';
    setCookie(c, cookieName, token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: JWT_EXPIRATION_TIME,
        path: '/',
    });
};

/**
 * Clear authentication cookie
 * @param c - Hono context
 * @param cookieName - Name of the cookie
 */
export const clearAuthCookie = (c: Context, cookieName: string): void => {
    deleteCookie(c, cookieName, { path: '/' });
};

/**
 * Calculate expiration timestamp
 * @returns Unix timestamp for token expiration
 */
export const getExpirationTimestamp = (): number => {
    return Math.floor(Date.now() / 1000) + JWT_EXPIRATION_TIME;
};
