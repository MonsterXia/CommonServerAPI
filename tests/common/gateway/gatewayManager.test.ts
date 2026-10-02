import { afterEach, expect, it } from 'vitest';
import Gateway from '@/common/gateway/gatewayManager';
import { request } from '@/common/gateway/axiosClient';
import type { InternalAxiosRequestConfig } from 'axios';
const adapter = request.defaults.adapter;
afterEach(() => { request.defaults.adapter = adapter; });

it('forwards typed request options and preserves upstream envelopes', async () => {
    const calls: InternalAxiosRequestConfig[] = [];
    const envelope = { code: 0, data: false };
    request.defaults.adapter = async config => {
        calls.push(config);
        return { config, data: envelope, status: 200, statusText: 'OK', headers: {} };
    };
    const gateway = Gateway.getInstance();
    const controller = new AbortController();
    expect(await gateway.get('/test', { uid: 'one' }, { signal: controller.signal, timeout: 2500, headers: { cred: 'test-only' } })).toBe(envelope);
    await gateway.post('/test', { value: 0 });
    await gateway.put('/test', { value: false });
    await gateway.delete('/test');
    expect(calls.map(c => c.method)).toEqual(['get', 'post', 'put', 'delete']);
    expect(calls[0].params).toEqual({ uid: 'one' });
    expect(calls[0].signal).toBe(controller.signal);
    expect(calls[0].timeout).toBe(2500);
    expect(calls[0].headers.get('cred')).toBe('test-only');
    expect(JSON.parse(calls[1].data)).toEqual({ value: 0 });
    expect(JSON.parse(calls[2].data)).toEqual({ value: false });
});
it('propagates upstream failures without converting them to success', async () => {
    const failure = new Error('upstream unavailable');
    request.defaults.adapter = async () => { throw failure; };
    await expect(Gateway.getInstance().get('/test')).rejects.toBe(failure);
});
