import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EmailManager from '@/common/Email/emailManager';
import { createTestDatabase } from '../../helpers/d1';

const { deliveries, deliveryState } = vi.hoisted(() => ({ deliveries: [] as string[], deliveryState: { fail: false } }));
vi.mock('resend', () => ({ Resend: class {
    emails = { send: async ({ to }: { to: string }) => {
        deliveries.push(to);
        if (deliveryState.fail) throw new Error('Delivery result unknown');
        return { data: { id: 'synthetic-mail' }, error: null };
    } };
} }));
let database: ReturnType<typeof createTestDatabase>;
beforeEach(() => {
    database = createTestDatabase();
    // The one-time cutover happened on a prior day in normal-operation tests.
    database.sqlite.exec("INSERT INTO EmailDailyQuota(day,count) VALUES ('2000-01-01',100)");
    deliveries.length = 0;
    deliveryState.fail = false;
    const data = new Map<string, string>();
    global.KV = {
        get: async (key: string) => data.get(key) ?? null,
        put: async (key: string, value: string) => { data.set(key, value); },
    } as unknown as KVNamespace;
});

it('starts a fresh quota on the next UTC day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T23:59:59Z'));
    database.sqlite.exec("INSERT INTO EmailDailyQuota(day,count) VALUES ('2026-10-29',100)");
    const manager = new EmailManager('synthetic', database.db);
    await expect(manager.sendEmail('user@example.com', 'test', 'test')).rejects.toThrow();
    vi.setSystemTime(new Date('2026-10-30T00:00:00Z'));
    await manager.sendEmail('user@example.com', 'test', 'test');
    expect(deliveries).toEqual(['user@example.com']);
    expect(database.sqlite.prepare("SELECT count FROM EmailDailyQuota WHERE day='2026-10-30'").get()?.count).toBe(1);
});

it('counts an ambiguous delivery and fails closed when the quota store is unavailable', async () => {
    const manager = new EmailManager('synthetic', database.db);
    deliveryState.fail = true;
    await expect(manager.sendEmail('first@example.com', 'test', 'test')).rejects.toThrow('Delivery result unknown');
    expect(database.sqlite.prepare('SELECT count FROM EmailDailyQuota WHERE day=?').get(new Date().toISOString().slice(0, 10))?.count).toBe(1);
    database.sqlite.exec('DROP TABLE EmailDailyQuota');
    await expect(manager.sendEmail('second@example.com', 'test', 'test')).rejects.toThrow();
    expect(deliveries).toEqual(['first@example.com']);
});
afterEach(() => { database.sqlite.close(); global.KV = undefined; vi.useRealTimers(); });

it('enforces the shared daily quota across concurrent senders before delivery', async () => {
    const managers = [new EmailManager('synthetic', database.db), new EmailManager('synthetic', database.db)];
    const results = await Promise.allSettled(Array.from({ length: 102 }, (_, n) =>
        managers[n % 2].sendEmail(`user${n}@example.com`, 'test', 'test')));
    expect(deliveries).toHaveLength(100);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(2);
});

it('blocks concurrent first-day sends and resumes at the next Resend UTC reset', async () => {
    database.sqlite.exec('DELETE FROM EmailDailyQuota');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T23:59:59Z'));
    const managers = [new EmailManager('synthetic', database.db), new EmailManager('synthetic', database.db)];
    const results = await Promise.allSettled(Array.from({ length: 102 }, (_, n) =>
        managers[n % 2].sendEmail(`user${n}@example.com`, 'test', 'test')));
    expect(results.every(r => r.status === 'rejected')).toBe(true);
    expect(deliveries).toHaveLength(0);
    expect(database.sqlite.prepare("SELECT count FROM EmailDailyQuota WHERE day='2026-10-29'").get()?.count).toBe(100);
    vi.setSystemTime(new Date('2026-10-30T00:00:00Z'));
    await managers[0].sendEmail('user@example.com', 'test', 'test');
    expect(deliveries).toEqual(['user@example.com']);
});
