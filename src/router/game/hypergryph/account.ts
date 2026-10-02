import { Hono } from 'hono';
import { authMiddleware } from '@/middleware/auth';
import { bindHypergryphAccount, unbindHypergryphAccount, getBoundGames, getBoundGameOverview } from '@/service/game/hypergryph/accountService';
import { fetchHypergryphPhoneCode } from '@/service/game/hypergryph/loginService';
import { buildContextJson, buildErrorContextJson } from '@/util/hono';

const account = new Hono();
account.use('*', authMiddleware);
account.onError((_error, c) => buildErrorContextJson(c, 'Game account service unavailable', null, 503));
account.post('/sms', async c => {
    const data = await c.req.json().catch(() => null);
    if (typeof data?.phone !== 'string' || !/^1\d{10}$/.test(data.phone)) return buildErrorContextJson(c, 'Invalid phone', null, 400);
    const response = await fetchHypergryphPhoneCode({ phone: data.phone });
    if (!response.success) return buildErrorContextJson(c, 'Could not send SMS; try again later', null, 502);
    return buildContextJson(c, response);
});
account.post('/', async c => buildContextJson(c, await bindHypergryphAccount(c, await c.req.json().catch(() => null))));
account.delete('/', async c => buildContextJson(c, await unbindHypergryphAccount(c)));
account.get('/games', async c => buildContextJson(c, await getBoundGames(c)));
account.get('/overview', async c => {
    c.header('Cache-Control', 'private, no-store');
    return buildContextJson(c, await getBoundGameOverview(c, c.req.query()));
});
account.post('/check-in', async c => buildContextJson(c, await getBoundGames(c, true)));
export default account;
