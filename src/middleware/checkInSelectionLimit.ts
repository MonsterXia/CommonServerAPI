import type { MiddlewareHandler } from 'hono';
import { buildErrorContextJson } from '@/util/hono';

// Run after authentication, before Zod expands individual role validation errors.
export const checkInSelectionLimit: MiddlewareHandler = async (c, next) => {
    if (/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(c.req.header('content-type') ?? '')) {
        let input: unknown;
        try { input = await c.req.json(); }
        catch { return buildErrorContextJson(c, 'Invalid JSON', null, 400); }
        if (input && typeof input === 'object' && 'roles' in input && Array.isArray(input.roles) && input.roles.length > 100) {
            return buildErrorContextJson(c, 'Select at most 100 roles', null, 400);
        }
    }
    await next();
};
