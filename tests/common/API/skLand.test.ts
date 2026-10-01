import { beforeEach, expect, it, vi } from 'vitest';
import { fetchSkLandCheckInAPI } from '@/common/API/skLand';
import { fetchSkLandGameAccounts } from '@/service/game/hypergryph/skIsland/loginService';
import { skLandCheckInCore } from '@/service/game/hypergryph/skIsland/checkIn';
const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/gatewayManager', () => ({ getGatewayManager: () => ({ post, get, buildSKLandURL: (path: string) => `https://example.com/${path}` }) }));
vi.mock('@/util/skLand', () => ({ getSkLandSignHeader: async () => ({ timeStamp: '100' }) }));
const cred = { cred: 'test', token: 'secret' };
const account = { appCode: 'arknights', nickName: 'Doctor', uid: '1', gameId: '1' };
beforeEach(() => vi.resetAllMocks());
it('reports upstream business errors as failures, not successful sign-ins', async () => {
    post.mockResolvedValue({ code: 1, message: 'Already checked in', data: {} });
    const response = await skLandCheckInCore(cred, [account]);
    expect(response.httpStatus).toBe(207);
    expect(response.data.checkInResults).toEqual([]);
    expect(response.data.errorResults[0].error).toBe('Already checked in');
});
it('limits timestamp correction to one retry', async () => {
    post.mockRejectedValue({ isAxiosError: true, response: { status: 401, data: { code: 10003, timestamp: '90', message: 'Wrong time' } } });
    await expect(fetchSkLandCheckInAPI(cred, account)).rejects.toThrow('Wrong time');
    expect(post).toHaveBeenCalledTimes(2);
});
it('loads every Endfield role and tolerates absent default roles', async () => {
    get.mockResolvedValue({ code: 0, data: { list: [{ appCode: 'endfield', bindingList: [
        { uid: 'a', isDelete: false, defaultRole: null, roles: [{ roleId: '1', nickname: 'One', serverId: 'a' }, { roleId: '2', nickname: 'Two', serverId: 'b' }] },
        { uid: 'b', isDelete: false, defaultRole: null, roles: [] },
    ] }] } });
    const response = await fetchSkLandGameAccounts(cred);
    expect(response.success).toBe(true);
    expect(response.data?.map(role => role.uid)).toEqual(['1', '2']);
});
