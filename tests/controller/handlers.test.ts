import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createServiceHandler, createValidatedHandler } from '@/controller/handlers';
import { buildStandardServerResponse as result } from '@/util/hono';

const parser = (input: Record<string, unknown>) => typeof input.name === 'string'
    ? result(true, '', { name: input.name.trim() })
    : result(false, 'Missing name', null, 'Name is required', 400);

describe('controller request boundaries', () => {
    it.each(['{', '', 'null', '[]', '42', '"name"'])('rejects invalid JSON objects without calling the service: %s', async body => {
        const service = vi.fn();
        const parse = vi.fn(parser);
        const app = new Hono().post('/', createValidatedHandler(parse, service, 'Request failed'));
        const response = await app.request('/', { method: 'POST', body });
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ httpStatus: 400 });
        expect(parse).not.toHaveBeenCalled();
        expect(service).not.toHaveBeenCalled();
    });

    it('preserves parser errors and skips service execution', async () => {
        const service = vi.fn();
        const app = new Hono().post('/', createValidatedHandler(parser, service, 'Request failed'));
        const response = await app.request('/', { method: 'POST', body: '{}' });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ message: 'Missing name', error: 'Name is required', httpStatus: 400 });
        expect(service).not.toHaveBeenCalled();
    });

    it('passes normalized data and context and preserves partial success', async () => {
        const service = vi.fn((c, data) => {
            expect(c.req.method).toBe('POST');
            expect(data).toEqual({ name: 'Alice' });
            return result(true, 'Partial', { ok: ['one'], failed: ['two'] }, null, 207);
        });
        const app = new Hono().post('/', createValidatedHandler(parser, service, 'Request failed'));
        const response = await app.request('/', { method: 'POST', body: '{"name":" Alice "}' });
        expect(response.status).toBe(207);
        expect(await response.json()).toEqual({ message: 'Partial', data: { ok: ['one'], failed: ['two'] }, httpStatus: 207 });
        expect(service).toHaveBeenCalledTimes(1);
    });

    it('supports query parsers without reading a JSON body', async () => {
        const app = new Hono().get('/', createValidatedHandler(parser, (_c, data) => result(true, 'ok', data), 'Request failed', 'query'));
        const response = await app.request('/?name=Alice');
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ data: { name: 'Alice' } });
    });

    it('does not leak exception properties or misclassify service SyntaxErrors as bad input', async () => {
        const error = Object.assign(new SyntaxError('private database details'), { token: 'private-token' });
        const app = new Hono().post('/', createValidatedHandler(parser, async () => { throw error; }, 'Request failed'));
        const response = await app.request('/', { method: 'POST', body: '{"name":"Alice"}' });
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ message: 'Request failed', error: null, httpStatus: 500 });
    });

    it('preserves false and null results for handlers without input', async () => {
        for (const data of [false, null]) {
            const app = new Hono().get('/', createServiceHandler(() => result(true, 'ok', data), 'Request failed'));
            expect(await (await app.request('/')).json()).toEqual({ message: 'ok', data, httpStatus: 200 });
        }
    });
});
