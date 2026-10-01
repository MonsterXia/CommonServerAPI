import type { Context } from 'hono';
import { getPrismaClient } from '@/lib/prisma';
import { buildStandardServerResponse as result } from '@/util/hono';
import { fetchHypergryphTokenByPassword, fetchHypergryphTokenByPhoneCode, fetchHypergryphOauthToken } from './loginService';
import { fetchSkLandCred, fetchSkLandGameAccounts } from './skIsland/loginService';
import { skLandCheckInCore } from './skIsland/checkIn';

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
export async function getBoundGames(c: Context, checkIn = false) {
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
    if (!checkIn) return games;
    return skLandCheckInCore(cred.data, games.data);
}
