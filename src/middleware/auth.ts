import { Context, Next } from 'hono';
import { getCurrentUser } from '@/lib/jwt';
import { buildErrorContextJson, bussinessStatusCode } from '@/util/hono';

declare module 'hono' {
  interface ContextVariableMap {
    user: {
      username: string;
    };
  }
}

export const authMiddleware = async (c: Context, next: Next) => {
  const user = await getCurrentUser(c);
  
  if (!user) {
    return buildErrorContextJson(
      c, 
      "Unauthorized, token is missing or invalid.", 
      null, 
      bussinessStatusCode.UNAUTHORIZED
    );
  }
  
  c.set('user', {
    username: user.username
  });
  
  await next();
};

export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  const user = await getCurrentUser(c);
  
  if (user) {
    c.set('user', {
      username: user.username
    });
  }
  
  await next();
};