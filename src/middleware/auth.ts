import { Context, Next } from 'hono';
import { getCurrentUser } from '@/lib/jwt';
import { getCurrentPostAdmin } from '@/lib/postAdminJwt';
import { buildErrorContextJson, bussinessStatusCode } from '@/util/hono';

declare module 'hono' {
  interface ContextVariableMap {
    user: {
      username: string;
    };
    postAdmin: {
      id: number;
      email: string;
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

export const postAdminAuthMiddleware = async (c: Context, next: Next) => {
  const postAdmin = await getCurrentPostAdmin(c);

  if (!postAdmin) {
    return buildErrorContextJson(
      c,
      'Unauthorized, Post administrator token is missing or invalid.',
      null,
      bussinessStatusCode.UNAUTHORIZED
    );
  }

  c.set('postAdmin', {
    id: postAdmin.postAdminId,
    email: postAdmin.email,
  });

  await next();
};
