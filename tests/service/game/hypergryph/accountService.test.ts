import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from 'hono';
import { bindHypergryphAccount, unbindHypergryphAccount, getBoundGames } from '@/service/game/hypergryph/accountService';
const mocks = vi.hoisted(() => ({ user: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), password: vi.fn(), sms: vi.fn(), oauth: vi.fn(), cred: vi.fn(), games: vi.fn(), checkIn: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ getPrismaClient: () => ({ user: { findUnique: mocks.user }, hypergryphAccount: { findUnique: mocks.find, create: mocks.create, update: mocks.update, deleteMany: mocks.remove } }) }));
vi.mock('@/service/game/hypergryph/loginService', () => ({ fetchHypergryphTokenByPassword: mocks.password, fetchHypergryphTokenByPhoneCode: mocks.sms, fetchHypergryphOauthToken: mocks.oauth }));
vi.mock('@/service/game/hypergryph/skIsland/loginService', () => ({ fetchSkLandCred: mocks.cred, fetchSkLandGameAccounts: mocks.games }));
vi.mock('@/service/game/hypergryph/skIsland/checkIn', () => ({ skLandCheckInCore: mocks.checkIn }));
const c = { get: () => ({ username: 'alice' }) } as unknown as Context;
beforeEach(() => {
    vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: 1 }); mocks.find.mockResolvedValue(null);
    mocks.password.mockResolvedValue({ success: true, data: 'secret-token' }); mocks.sms.mockResolvedValue({ success: true, data: 'secret-token' });
    mocks.create.mockResolvedValue({ phone: '13800000000', userId: 1 });
});
describe('linked Hypergryph accounts', () => {
    it('binds by SMS while returning only public fields', async () => {
        const result = await bindHypergryphAccount(c, { method: 'sms', phone: '13800000000', code: '123456' });
        expect(result).toMatchObject({ httpStatus: 200, data: { phone: '13800000000' } });
        expect(result.data).not.toHaveProperty('token');
        expect(mocks.create.mock.calls[0][0].select.token).toBeUndefined();
        expect(mocks.sms).toHaveBeenCalledWith({ phone: '13800000000', code: '123456' });
    });
    it('rejects ownership conflicts and guards concurrent token updates', async () => {
        mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce({ phone: '13800000000', userId: 2 });
        expect((await bindHypergryphAccount(c, { method: 'password', phone: '13800000000', password: 'pwd' })).httpStatus).toBe(409);
        expect(mocks.password).not.toHaveBeenCalled();
        mocks.find.mockResolvedValue({ phone: '13800000000', userId: 1 });
        mocks.update.mockRejectedValue({ code: 'P2025' });
        expect((await bindHypergryphAccount(c, { method: 'password', phone: '13800000000', password: 'pwd' })).httpStatus).toBe(409);
        expect(mocks.update.mock.calls[0][0].where).toEqual({ phone: '13800000000', userId: 1 });
    });
    it('never stores failed logins and deletes only the current user binding', async () => {
        mocks.password.mockResolvedValue({ success: false });
        expect((await bindHypergryphAccount(c, { method: 'password', phone: '13800000000', password: 'bad' })).httpStatus).toBe(502);
        expect(mocks.create).not.toHaveBeenCalled();
        await unbindHypergryphAccount(c);
        expect(mocks.remove).toHaveBeenCalledWith({ where: { userId: 1 } });
    });
    it('stops an expired upstream session before credential lookup or check-in', async () => {
        mocks.find.mockResolvedValue({ token: 'server-secret' }); mocks.oauth.mockResolvedValue({ success: false });
        expect((await getBoundGames(c, true)).httpStatus).toBe(502);
        expect(mocks.cred).not.toHaveBeenCalled(); expect(mocks.checkIn).not.toHaveBeenCalled();
    });
    it.each([null, {}, { phone: 'bad', method: 'sms' }])('validates malformed input', async data => {
        expect((await bindHypergryphAccount(c, data)).httpStatus).toBe(400);
    });
});
