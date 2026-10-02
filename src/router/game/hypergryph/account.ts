import { accountRoutes } from '@/openapi/routes';
import { createNewRouter, handleRouteError } from '@/router/routerfactory';
import { authMiddleware } from '@/middleware/auth';
import { bindHypergryphAccount, unbindHypergryphAccount, getBoundGames, getBoundGameOverview } from '@/service/game/hypergryph/accountService';
import { fetchHypergryphPhoneCode } from '@/service/game/hypergryph/loginService';
import { buildContextJson, buildErrorContextJson } from '@/util/hono';

const account = createNewRouter();
account.use('*', authMiddleware);
account.onError((error, c) => handleRouteError(error, c, 'Game account service unavailable', 503));
account.openapi(accountRoutes.sms, async c => {
    const data = await c.req.json().catch(() => null);
    if (typeof data?.phone !== 'string' || !/^1\d{10}$/.test(data.phone)) return buildErrorContextJson(c, 'Invalid phone', null, 400);
    const response = await fetchHypergryphPhoneCode({ phone: data.phone });
    if (!response.success) return buildErrorContextJson(c, 'Could not send SMS; try again later', null, 502);
    return buildContextJson(c, response);
});
account.openapi(accountRoutes.bind, async c => buildContextJson(c, await bindHypergryphAccount(c, await c.req.json().catch(() => null))));
account.openapi(accountRoutes.unbind, async c => buildContextJson(c, await unbindHypergryphAccount(c)));
account.openapi(accountRoutes.games, async c => buildContextJson(c, await getBoundGames(c)));
account.openapi(accountRoutes.overview, async c => {
    c.header('Cache-Control', 'private, no-store');
    return buildContextJson(c, await getBoundGameOverview(c, c.req.query()));
});
account.openapi(accountRoutes.checkIn, async c => buildContextJson(c, await getBoundGames(c, true)));
export default account;
