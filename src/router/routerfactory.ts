import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { Bindings } from '@/index';
import { buildErrorContextJson } from '@/util/hono';

export function handleRouteError(
    error: Error,
    c: Context,
    message = 'Service unavailable',
    status: 500 | 503 = 500,
) {
    if (error instanceof HTTPException && error.status < 500) {
        return buildErrorContextJson(
            c,
            error.status === 400 ? 'Invalid JSON' : error.message,
            null,
            error.status,
        );
    }
    return buildErrorContextJson(c, message, null, status);
}

export const createNewRouter = () => {
    const app = new OpenAPIHono<{ Bindings: Bindings }>({
        defaultHook: (result, c) => {
            if (!result.success) {
                // Issue paths and messages describe the contract, never echo submitted secrets.
                return buildErrorContextJson(
                    c,
                    'Invalid request',
                    result.error.issues
                        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
                        .join('; '),
                    400,
                );
            }
        },
    });
    app.onError((error, c) => handleRouteError(error, c));
    return app;
};
