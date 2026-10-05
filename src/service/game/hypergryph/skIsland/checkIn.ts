import { fetchSkLandCheckInAPI } from "@/common/API/skLand";
import { CheckInError } from "@/common/API/skLandAttendance";
import type { SKLandAccountsRequestParams, SKLandGameAccount } from "@/model/game/hypergraph/skIsland/user";
import type { CheckInReport, CheckInRoleResult } from "@/model/game/hypergraph/skIsland/checkIn";
import { HypergryphTokenByPasswordRequestPayload } from "@/model/game/hypergraph/user";
import { StandardServerResult } from "@/model/util/hono";
import { buildStandardServerResponse, businessStatusCode } from "@/util/hono";
import { fetchHypergryphOauthToken, fetchHypergryphTokenByPassword } from "../loginService";
import { fetchSkLandCred, fetchSkLandGameAccounts } from "./loginService";

export const skLandCheckInCore = async (
    cred: SKLandAccountsRequestParams,
    accounts: SKLandGameAccount[]
): Promise<StandardServerResult<CheckInReport>> => {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    const unique = [...new Map(accounts.map(account => [JSON.stringify([account.appCode, account.uid, account.gameId]), account])).values()];
    const results: CheckInRoleResult[] = new Array(unique.length);
    const errors = new Map<number, string>();
    let cursor = 0;
    // Small bounded pool avoids one slow role blocking the whole account; preserve input order.
    await Promise.all(Array.from({ length: Math.min(3, unique.length) }, async () => {
        while (cursor < unique.length) {
            const index = cursor++;
            const source = unique[index];
            const account: SKLandGameAccount = { appCode: source.appCode, uid: source.uid, gameId: source.gameId, nickName: source.nickName, ...(source.serverName ? { serverName: source.serverName } : {}) };
            try {
                if (Date.now() - started > 40000) throw new CheckInError('timeout');
                results[index] = { account, ...await fetchSkLandCheckInAPI(cred, account), errorCode: null, retryable: false, upstreamCode: null };
            } catch (error) {
                const failure = error instanceof CheckInError ? error : new CheckInError('network_error');
                results[index] = { account, status: 'failed', rewards: [], rewardsComplete: false, errorCode: failure.code, retryable: failure.retryable, upstreamCode: failure.upstreamCode };
                errors.set(index, failure.message);
            }
        }
    }));
    const summary = { total: results.length, success: 0, alreadyCheckedIn: 0, failed: 0 };
    const checkInResults: string[] = [], errorResults: CheckInReport['errorResults'] = [];
    results.forEach((item, index) => {
        if (item.status === 'failed') { summary.failed++; errorResults.push({ ...item.account, error: errors.get(index)! }); }
        else {
            if (item.status === 'success') summary.success++; else summary.alreadyCheckedIn++;
            const rewards = item.rewards.map(reward => `${reward.name ?? reward.id ?? 'Unknown reward'} × ${reward.count ?? '?'}`).join('、');
            checkInResults.push(`${item.account.appCode} ${item.account.nickName}: ${item.status === 'already_checked_in' ? '今日已签到' : rewards || '签到成功（奖励详情未提供）'}`);
        }
    });
    const report = { requestId, completedAt: Math.floor(Date.now() / 1000), durationMs: Date.now() - started, results, summary, checkInResults, errorResults };
    // No credentials, role identifiers, nicknames, upstream payloads or exception messages in logs.
    console.info('skland.check_in', { requestId, durationMs: report.durationMs, ...summary, errors: results.filter(item => item.errorCode).map(item => ({ game: item.account.appCode, code: item.errorCode, upstreamCode: item.upstreamCode })) });
    return buildStandardServerResponse(true, summary.failed ? 'Some accounts failed to check in' : 'Check-in complete', report, null,
        summary.failed ? businessStatusCode.MULTI_STATUS : businessStatusCode.OK);
};

export const tempCheckIn = async (
    data: HypergryphTokenByPasswordRequestPayload
): Promise<StandardServerResult<any>> => {
    try {
        const token = await fetchHypergryphTokenByPassword(data)
        if (!token.success || !token.data) return buildStandardServerResponse(false, 'Hypergryph login failed', null, null, 502);
        const tokenValue = token.data;

        const code = await fetchHypergryphOauthToken({
            token: tokenValue
        })
        if (!code.success || !code.data) return buildStandardServerResponse(false, 'Hypergryph authorization failed', null, null, 502);
        const codeValue = code.data;

        const cred = await fetchSkLandCred({
            code: codeValue
        })


        if (!cred.success || !cred.data) return buildStandardServerResponse(false, 'SKLand authentication failed', null, null, 502);
        const credCore = {
            cred: cred.data?.cred!,
            token: cred.data?.token!
        }
        const accounts = await fetchSkLandGameAccounts(credCore)

        if (!accounts.success || !accounts.data) return buildStandardServerResponse(false, 'Could not load game accounts', null, null, 502);
        return await skLandCheckInCore(credCore, accounts.data);
    } catch (e) {
        throw e;
    }
}
