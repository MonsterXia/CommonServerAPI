import { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { JWT_EXPIRATION_TIME, JWT_SIGN_METHOD } from '@/common/config/jwtConfig';
import { PostAdminIdentity } from '@/model/post/postAdmin';

const POST_ADMIN_COOKIE_NAME = 'post_auth_token';

export interface PostAdminJWTPayload extends Record<string, unknown> {
    postAdminId: number;
    email: string;
    kind: 'post-admin';
    exp?: number;
}

const getJWTSecret = (c: Context): string => {
    const secret = c.env?.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not configured');
    }
    return secret;
};

export const generatePostAdminToken = async (
    c: Context,
    identity: PostAdminIdentity
): Promise<string> => {
    const exp = Math.floor(Date.now() / 1000) + JWT_EXPIRATION_TIME;
    return sign(
        {
            postAdminId: identity.id,
            email: identity.email,
            kind: 'post-admin',
            exp,
        },
        getJWTSecret(c),
        JWT_SIGN_METHOD
    );
};

export const verifyPostAdminToken = async (
    c: Context,
    token: string
): Promise<PostAdminJWTPayload | null> => {
    try {
        const payload = await verify(
            token,
            getJWTSecret(c),
            JWT_SIGN_METHOD
        ) as PostAdminJWTPayload;

        if (
            payload.kind !== 'post-admin'
            || typeof payload.postAdminId !== 'number'
            || typeof payload.email !== 'string'
        ) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
};

export const getCurrentPostAdmin = async (
    c: Context
): Promise<PostAdminJWTPayload | null> => {
    const token = getCookie(c, POST_ADMIN_COOKIE_NAME);
    if (!token) {
        return null;
    }
    return verifyPostAdminToken(c, token);
};

export const setPostAdminAuthCookie = (c: Context, token: string) => {
    const isSecureRequest = new URL(c.req.url).protocol === 'https:';
    setCookie(c, POST_ADMIN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isSecureRequest,
        sameSite: 'lax',
        maxAge: JWT_EXPIRATION_TIME,
        path: '/',
    });
};

export const clearPostAdminAuthCookie = (c: Context) => {
    deleteCookie(c, POST_ADMIN_COOKIE_NAME, { path: '/' });
};
