import type { Context } from 'hono';
import { getPrismaClient } from '@/lib/prisma';
import { buildStandardServerResponse as result } from '@/util/hono';
import { fetchHypergryphTokenByPassword, fetchHypergryphTokenByPhoneCode, fetchHypergryphOauthToken } from './loginService';
import { fetchSkLandCred, fetchSkLandGameAccounts } from './skIsland/loginService';
import { skLandCheckInCore } from './skIsland/checkIn';
import { fetchSkLandProfileAPI, fetchSkLandWarEchoesAPI, fetchSkLandMonolithAPI } from '@/common/API/skLand';
import { normalizeGameOverview } from './skIsland/overview';

const publicAccount = { phone: true, userId: true, createdAt: true, updatedAt: true } as const;
async function owner(c: Context) {
    return getPrismaClient().user.findUnique({ where: { username: c.get('user').username }, select: { id: true } });
}
export async function bindHypergryphAccount(c: Context, data: unknown) {
    if (!data || typeof data !== 'object') return result(false, 'Invalid account request', null, null, 400);
    const input = data as Record<string, unknown>;
    if (typeof input.phone !== 'string' || !/^1\d{10}$/.test(input.phone)
        || !['password', 'sms'].includes(String(input.method))
        || (input.method === 'password' ? typeof input.password !== 'string' || !input.password : typeof input.code !== 'string' || !/^\d{6}$/.test(input.code))) {
        return result(false, 'Invalid phone or credentials', null, null, 400);
    }
    const user = await owner(c);
    if (!user) return result(false, 'User not found', null, null, 404);
    const db = getPrismaClient();
    const current = await db.hypergryphAccount.findUnique({ where: { userId: user.id } });
    if (current && current.phone !== input.phone) return result(false, 'Unbind the current account first', null, null, 409);
    const existing = await db.hypergryphAccount.findUnique({ where: { phone: input.phone } });
    if (existing && existing.userId !== user.id) return result(false, 'Account is already bound', null, null, 409);
    const login = input.method === 'password'
        ? await fetchHypergryphTokenByPassword({ phone: input.phone, password: input.password as string })
        : await fetchHypergryphTokenByPhoneCode({ phone: input.phone, code: input.code as string });
    if (!login.success || !login.data) return result(false, 'Hypergryph login failed; check credentials or verification requirements', null, null, 502);
    try {
        const account = existing
            ? await db.hypergryphAccount.update({ where: { phone: input.phone, userId: user.id }, data: { token: login.data }, select: publicAccount })
            : await db.hypergryphAccount.create({ data: { phone: input.phone, userId: user.id, token: login.data }, select: publicAccount });
        return result(true, 'Account bound', account, null, 200);
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && ['P2002', 'P2025'].includes(String(error.code))) return result(false, 'Account binding changed; refresh and retry', null, null, 409);
        throw error;
    }
}
export async function unbindHypergryphAccount(c: Context) {
    const user = await owner(c);
    if (!user) return result(false, 'User not found', null, null, 404);
    await getPrismaClient().hypergryphAccount.deleteMany({ where: { userId: user.id } });
    return result(true, 'Account unbound', null, null, 200);
}
async function getBoundGameContext(c: Context) {
    const user = await owner(c);
    if (!user) return result(false, 'User not found', null, null, 404);
    const account = await getPrismaClient().hypergryphAccount.findUnique({ where: { userId: user.id } });
    if (!account) return result(false, 'Bind a Hypergryph account first', null, null, 409);
    const oauth = await fetchHypergryphOauthToken({ token: account.token });
    if (!oauth.success || !oauth.data) return result(false, 'Hypergryph session expired; sign in to the linked account again', null, null, 502);
    const cred = await fetchSkLandCred({ code: oauth.data });
    if (!cred.success || !cred.data) return result(false, 'SKLand authentication failed', null, null, 502);
    const games = await fetchSkLandGameAccounts(cred.data);
    if (!games.success || !games.data) return result(false, 'Could not load game accounts', null, null, 502);
    return result(true, 'Game context loaded', { cred: cred.data, games: games.data }, null, 200);
}
export async function getBoundGames(c: Context, checkIn = false, roles?: { appCode: string; uid: string; gameId: string }[]) {
    const context = await getBoundGameContext(c);
    if (!context.success || !context.data) return result(false, context.message, null, context.error, context.httpStatus);
    if (!checkIn) return result(true, 'Get game accounts successfully', context.data.games, null, 200);
    const { cred, games: ownedGames } = context.data;
    const games = roles ? roles.map(role => ownedGames.find(game => game.appCode === role.appCode && game.uid === role.uid && game.gameId === role.gameId)) : ownedGames;
    if (games.some(game => !game)) return result(false, 'Game account is not linked to this user', null, null, 403);
    return skLandCheckInCore(cred, games.filter(game => game !== undefined));
}
export async function getBoundGameOverview(c: Context, query: Record<string, string>) {
    const { appCode, uid, gameId } = query;
    if (!['arknights', 'endfield'].includes(appCode) || !/^[\w-]{1,128}$/.test(uid ?? '') || !/^[\w-]{1,128}$/.test(gameId ?? ''))
        return result(false, 'Invalid game account', null, null, 400);
    const context = await getBoundGameContext(c);
    if (!context.success || !context.data) return result(false, context.message, null, context.error, context.httpStatus);
    const account = context.data.games.find(game => game.appCode === appCode && String(game.uid) === uid && String(game.gameId) === gameId);
    if (!account) return result(false, 'Game account is not linked to this user', null, null, 403);
    try {
        const [profile, extra, monolith] = await Promise.all([
            fetchSkLandProfileAPI(context.data.cred, account),
            appCode === 'endfield' ? fetchSkLandWarEchoesAPI(context.data.cred, account).catch(() => undefined) : undefined,
            appCode === 'endfield' ? fetchSkLandMonolithAPI(context.data.cred, account).catch(() => undefined) : undefined,
        ]);
        // Optional mode data must not take down a valid account overview.
        const raw = profile && typeof profile === 'object' && 'detail' in profile && profile.detail && typeof profile.detail === 'object'
            ? { ...profile, detail: { ...profile.detail, monolithFull: monolith && typeof monolith === 'object' && 'indieHard' in monolith ? monolith.indieHard : undefined, warEchoesFull: extra && typeof extra === 'object' && 'warEchoes' in extra ? extra.warEchoes : undefined } }
            : profile;
        return result(true, 'Game overview loaded', normalizeGameOverview(account, raw), null, 200);
    } catch {
        return result(false, 'Could not load game overview; refresh or update account login', null, null, 502);
    }
}
