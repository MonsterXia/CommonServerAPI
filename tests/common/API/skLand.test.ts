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
it('preserves upstream server labels without changing the IDs used for check-in', async () => {
    get.mockResolvedValue({ code: 0, data: { list: [
        { appCode: 'arknights', bindingList: [
            { uid: 'a', nickName: 'Official', channelMasterId: '1', channelName: '官服' },
            { uid: 'b', nickName: 'Channel', channelMasterId: '2', channelName: 'B服' },
        ] },
        { appCode: 'endfield', bindingList: [
            { channelMasterId: '1', channelName: '官服', roles: [{ roleId: 'e', nickname: 'Endministrator', serverId: '99', serverName: '测试区服' }] },
            { roles: [], defaultRole: { roleId: 'd', nickname: 'Default', serverId: '88', serverName: '默认区服' } },
            { roles: [{ roleId: 'u', nickname: 'Unknown', serverId: '77' }] },
        ] },
    ] } });
    const response = await fetchSkLandGameAccounts(cred);
    expect(response.data?.map(role => ({ uid: role.uid, gameId: role.gameId, serverName: role.serverName }))).toEqual([
        { uid: 'a', gameId: '1', serverName: '官服' },
        { uid: 'b', gameId: '2', serverName: 'B服' },
        { uid: 'e', gameId: '99', serverName: '测试区服' },
        { uid: 'd', gameId: '88', serverName: '默认区服' },
        { uid: 'u', gameId: '77', serverName: undefined },
    ]);
    post.mockResolvedValue({ code: 0, data: { awards: [] } });
    await fetchSkLandCheckInAPI(cred, response.data![0]);
    expect(post.mock.calls[0][1]).toEqual({ uid: 'a', gameId: '1' });
});
