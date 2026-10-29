import type { MiddlewareHandler } from 'hono';

// Legacy endpoints carry credentials in query strings. Never log the raw URL.
export const requestLogging: MiddlewareHandler = async (c, next) => {
    const started = Date.now();
    await next();
    console.log(JSON.stringify({
        event: 'http.request',
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - started,
    }));
};
