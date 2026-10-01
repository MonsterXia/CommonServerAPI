import { expect, it } from 'vitest';
import { request } from '@/common/gateway/axiosClient';

// Workers rejects explicit browser cache modes such as "default" before dispatch.
class WorkersRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
        if (init?.cache && !['no-store', 'no-cache'].includes(init.cache)) {
            throw new TypeError(`Unsupported cache mode: ${init.cache}`);
        }
        super(input, init);
    }
}

it.each(['get', 'post'] as const)('dispatches %s through the Workers-compatible fetch transport', async method => {
    const response = await request.request({
        url: 'https://upstream.example.test/endpoint',
        method,
        ...(method === 'post' ? { data: { type: 2 } } : {}),
        adapter: 'fetch',
        env: {
            Request: WorkersRequest,
            fetch: async (input, init) => {
                const outbound = new Request(input, init);
                return new Response(JSON.stringify({
                    method: outbound.method,
                    body: method === 'post' ? await outbound.json() : null,
                }), { headers: { 'Content-Type': 'application/json' } });
            },
        },
    });
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ method: method.toUpperCase(), body: method === 'post' ? { type: 2 } : null });
});
