import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from 'hono';
import { bindHypergryphAccount, unbindHypergryphAccount, getBoundGames, getBoundGameOverview } from '@/service/game/hypergryph/accountService';
const mocks = vi.hoisted(() => ({ user: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), password: vi.fn(), sms: vi.fn(), oauth: vi.fn(), cred: vi.fn(), games: vi.fn(), checkIn: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ getPrismaClient: () => ({ user: { findUnique: mocks.user }, hypergryphAccount: { findUnique: mocks.find, create: mocks.create, update: mocks.update, deleteMany: mocks.remove } }) }));
vi.mock('@/service/game/hypergryph/loginService', () => ({ fetchHypergryphTokenByPassword: mocks.password, fetchHypergryphTokenByPhoneCode: mocks.sms, fetchHypergryphOauthToken: mocks.oauth }));
vi.mock('@/service/game/hypergryph/skIsland/loginService', () => ({ fetchSkLandCred: mocks.cred, fetchSkLandGameAccounts: mocks.games }));
vi.mock('@/service/game/hypergryph/skIsland/checkIn', () => ({ skLandCheckInCore: mocks.checkIn }));
const profile = vi.hoisted(() => vi.fn());
vi.mock('@/common/API/skLand', () => ({ fetchSkLandProfileAPI: profile }));
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
    it('restricts overviews to an exact game, UID and server in the current binding', async () => {
        mocks.find.mockResolvedValue({ token: 'server-secret' });
        mocks.oauth.mockResolvedValue({ success: true, data: 'oauth' });
        mocks.cred.mockResolvedValue({ success: true, data: { cred: 'secret', token: 'secret', userId: '1' } });
        const role = { appCode: 'arknights', uid: '11', gameId: '1', nickName: 'Doctor' };
        mocks.games.mockResolvedValue({ success: true, data: [role] });
        for (const query of [{ ...role, uid: '12' }, { ...role, gameId: '2' }, { ...role, appCode: 'endfield' }]) {
            expect((await getBoundGameOverview(c, query)).httpStatus).toBe(403);
        }
        expect(profile).not.toHaveBeenCalled();
        profile.mockResolvedValue({ status: { level: 1 }, privateToken: 'must-not-leak' });
        const overview = await getBoundGameOverview(c, role);
        expect(overview.httpStatus).toBe(200);
        expect(JSON.stringify(overview.data)).not.toMatch(/must-not-leak|secret/);
        expect(mocks.checkIn).not.toHaveBeenCalled();
        profile.mockRejectedValue(new Error('secret upstream failure'));
        const failure = await getBoundGameOverview(c, role);
        expect(failure.httpStatus).toBe(502);
        expect(JSON.stringify(failure)).not.toContain('secret');
    });
    it('rejects invalid overview selectors before loading credentials', async () => {
        expect((await getBoundGameOverview(c, { appCode: 'unknown', uid: '1', gameId: '1' })).httpStatus).toBe(400);
        expect(mocks.oauth).not.toHaveBeenCalled();
    });
});
