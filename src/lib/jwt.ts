import { sign, verify } from 'hono/jwt';
import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { JWT_EXPIRATION_TIME, JWT_SIGN_METHOD } from '@/common/config/jwtConfig';

export interface JWTPayload extends Record<string, unknown>{
  username: string;
  exp?: number;
}

const getJWTSecret = (c: Context): string => {
  const secret = c.env?.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
};

export const generateToken = async (c: Context, payload: Omit<JWTPayload, 'exp'>) => {
  const secret = getJWTSecret(c);
  const expiresIn = JWT_EXPIRATION_TIME;
  
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const token = await sign(
    { ...payload, exp },
    secret,
    JWT_SIGN_METHOD
  );
  return token;
};

export const verifyToken = async (c: Context, token: string): Promise<JWTPayload | null> => {
  try {
    const secret = getJWTSecret(c);
    const payload = await verify(token, secret, JWT_SIGN_METHOD) as JWTPayload;
    return payload;
  } catch (error) {
    return null;
  }
};

export const getCurrentUser = async (c: Context): Promise<JWTPayload | null> => {
  const token = getCookie(c, 'auth_token');
  if (!token) return null;
  
  return await verifyToken(c, token);
};

export const setAuthCookie = (c: Context, token: string) => {
  const isProduction = c.env?.ENVIRONMENT === 'production';
  
  setCookie(c, 'auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7天
    path: '/',
  });
};

export const clearAuthCookie = (c: Context) => {
  deleteCookie(c, 'auth_token', { path: '/' });
};