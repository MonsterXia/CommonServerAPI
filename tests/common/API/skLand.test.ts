import { beforeEach, expect, it, vi } from 'vitest';
import { fetchSkLandCheckInAPI, fetchSkLandProfileAPI, fetchSkLandWarEchoesAPI, fetchSkLandMonolithAPI } from '@/common/API/skLand';
import { fetchSkLandGameAccounts } from '@/service/game/hypergryph/skIsland/loginService';
import { skLandCheckInCore } from '@/service/game/hypergryph/skIsland/checkIn';
const { post, get, sign } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), sign: vi.fn() }));
vi.mock('@/lib/gatewayManager', () => ({ getGatewayManager: () => ({ post, get, buildSKLandURL: (path: string) => `https://example.com/${path}` }) }));
vi.mock('@/util/skLand', () => ({ getSkLandSignHeader: sign }));
const cred = { cred: 'test', token: 'secret' };
const account = { appCode: 'arknights', nickName: 'Doctor', uid: '1', gameId: '1' };
beforeEach(() => { vi.resetAllMocks(); sign.mockResolvedValue({ timeStamp: '100' }); });
it('reports upstream business errors as failures, not successful sign-ins', async () => {
    post.mockResolvedValue({ code: 1, message: 'Invalid role', data: {} });
    const response = await skLandCheckInCore(cred, [account]);
    expect(response.httpStatus).toBe(207);
    expect(response.data!.checkInResults).toEqual([]);
    expect(response.data!.errorResults[0].error).toBe('SKLand check-in is unavailable; try again later');
});
it('limits timestamp correction to one retry', async () => {
    post.mockRejectedValue({ isAxiosError: true, response: { status: 401, data: { code: 10003, timestamp: '90', message: 'Wrong time' } } });
    await expect(fetchSkLandCheckInAPI(cred, account)).rejects.toThrow('SKLand server time could not be synchronized');
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

it('signs the same GET query that is sent for each game profile', async () => {
    get.mockResolvedValue({ code: 0, data: { status: {} } });
    const credentials = { ...cred, userId: 'skland-user' };
    await fetchSkLandProfileAPI(credentials, account);
    expect(get.mock.calls[0][0]).toBe('https://example.com/api/v1/game/player/info?uid=1');
    expect(sign.mock.calls[0][2].toString()).toBe('uid=1');
    await fetchSkLandProfileAPI(credentials, { ...account, appCode: 'endfield', uid: 'role', gameId: '99' });
    expect(get.mock.calls[1][0]).toBe('https://example.com/web/v1/game/endfield/card/detail?roleId=role&serverId=99&userId=skland-user');
    expect(sign.mock.calls[1][2].toString()).toBe('roleId=role&serverId=99&userId=skland-user');
    expect(get.mock.calls[1][2]).toMatchObject({ headers: { 'sk-game-role': '3_role_99' }, timeout: 20000 });
    expect(post).not.toHaveBeenCalled();
});
it('rejects profile business errors and bounds timestamp retries', async () => {
    get.mockResolvedValueOnce({ code: 1, data: {} });
    await expect(fetchSkLandProfileAPI({ ...cred, userId: '1' }, account)).rejects.toThrow('unavailable');
    get.mockClear();
    get.mockRejectedValue({ isAxiosError: true, response: { status: 401, data: { code: 10003, timestamp: '90' } } });
    await expect(fetchSkLandProfileAPI({ ...cred, userId: '1' }, account)).rejects.toBeDefined();
    expect(get).toHaveBeenCalledTimes(2);
    expect(sign.mock.calls.at(-1)?.[3]).toBe(10);
});

it('signs the Endfield War Echoes GET using the authorized role and server', async () => {
  get.mockResolvedValue({ code: 0, data: { warEchoes: { seasons: [] } } });
  const credentials = { ...cred, userId: 'owner' };
  const role = { ...account, appCode: 'endfield', uid: 'r', gameId: 's' };
  await fetchSkLandWarEchoesAPI(credentials, role);
  expect(get.mock.calls[0][0]).toBe('https://example.com/web/v1/game/endfield/card/war-echoes?roleId=r&serverId=s&userId=owner');
  expect(get.mock.calls[0][2].headers['sk-game-role']).toBe('3_r_s');
  expect(String(sign.mock.calls[0][2])).toBe('roleId=r&serverId=s&userId=owner');
});

it('signs indie-hard with the bound role and bounds timestamp recovery', async () => {
  get.mockResolvedValueOnce({ code: 0, data: { indieHard: { indieHardGroups: [] } } });
  const role = { ...account, appCode: 'endfield', uid: 'r', gameId: 's' };
  const credentials = { ...cred, userId: 'owner' };
  await fetchSkLandMonolithAPI(credentials, role);
  expect(get.mock.calls[0][0]).toBe('https://example.com/web/v1/game/endfield/card/indie-hard?roleId=r&serverId=s&userId=owner');
  expect(get.mock.calls[0][2]).toMatchObject({ headers: { 'sk-game-role': '3_r_s' }, timeout: 20000 });
  expect(String(sign.mock.calls[0][2])).toBe('roleId=r&serverId=s&userId=owner');
  get.mockClear();
  get.mockRejectedValue({ isAxiosError: true, response: { status: 401, data: { code: 10003, timestamp: '90' } } });
  await expect(fetchSkLandMonolithAPI(credentials, role)).rejects.toBeDefined();
  expect(get).toHaveBeenCalledTimes(2);
  await expect(fetchSkLandMonolithAPI(credentials, account)).rejects.toThrow('Unsupported game');
});
