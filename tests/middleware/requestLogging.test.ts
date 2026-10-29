import { afterEach, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ WorkflowEntrypoint: class {} }));
afterEach(() => { vi.restoreAllMocks(); globalThis.servicesInitialized = undefined; });

it('logs request metadata without query credentials', async () => {
    globalThis.servicesInitialized = true;
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: app } = await import('@/index');
    const response = await app.request('https://api.example.com/?token=private-token&cred=private-cred', {}, { APP_ENV: 'production' });
    expect(response.status).toBe(200);
    const output = JSON.stringify(logs.mock.calls);
    expect(output).not.toContain('private-token');
    expect(output).not.toContain('private-cred');
    expect(output).toContain('GET');
    expect(output).toContain('200');
});
