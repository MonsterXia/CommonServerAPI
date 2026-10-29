import { AxiosError } from 'axios';
import { expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import router from '@/router/router';

const { upstream } = vi.hoisted(() => ({ upstream: vi.fn() }));
vi.mock('@/common/API/hypergryph', () => ({
    hypergryphSendPhoneCodeAPI: upstream,
    hypergryphTokenByPhoneCodeAPI: upstream,
    hypergryphTokenByPasswordAPI: upstream,
    hypergryphTokenValidateAPI: upstream,
    hypergryphGrantOAuthTokenAPI: upstream,
}));
const app = new Hono().route('/', router);
it.each([
    ['/sms', { phone: '13800000000' }],
    ['/token/sms', { phone: '13800000000', code: '123456' }],
    ['/token/password', { phone: '13800000000', password: 'private-password' }],
    ['/token/oauth', { token: 'private-token' }],
    ['/token/validate?token=private-token', null],
] as const)('does not serialize transport credentials at %s', async (path, body) => {
    upstream.mockRejectedValue(new AxiosError('private transport details', 'ERR_NETWORK', {
        headers: { Authorization: 'private-auth' }, data: JSON.stringify({ password: 'private-password' }),
        params: { token: 'private-token' },
    } as never));
    const response = await app.request(`/game/hypergryph${path}`, body ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    } : {});
    expect(response.status).toBe(500);
    const json = await response.json<{ error: unknown }>();
    expect(JSON.stringify(json)).not.toContain('private-');
    expect(json.error).toBe('Upstream request failed');
});
