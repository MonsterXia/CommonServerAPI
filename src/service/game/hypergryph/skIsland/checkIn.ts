import { fetchSkLandCheckInAPI } from "../../../../common/API/skLand";
import { SKLandAccountsRequestParams, SKLandCheckInRequestPayload } from "../../../../model/game/hypergraph/skIsland/user";
import { HypergryphTokenByPasswordRequestPayload } from "../../../../model/game/hypergraph/user";
import { fetchHypergryphOauthToken, fetchHypergryphTokenByPassword } from "../loginService";
import { fetchSkLandCred, fetchSkLandGameAccounts } from "./loginService";

export const skLandCheckInCore = async (cred: SKLandAccountsRequestParams, accounts: SKLandCheckInRequestPayload[]) => {
    let checkInResults = [];
    let errorResults = [];
    for (const account of accounts) {
        try {
            const res = await fetchSkLandCheckInAPI(cred, account);
            checkInResults.push(`${account.appCode} ${account.nickName} 签到结果: ${res}`);
        } catch (e) {
            errorResults.push({
                ...account,
                error: e instanceof Error ? e.message : 'Unknown error'
            });
        }
    }

    return { checkInResults, errorResults };
}

export const tempCheckIn = async (data: HypergryphTokenByPasswordRequestPayload) => {
    try {
        const token = await fetchHypergryphTokenByPassword(data)
        const code = await fetchHypergryphOauthToken({
            token: token
        })
        const cred = await fetchSkLandCred({
            code: code
        })

        const accounts = await fetchSkLandGameAccounts({
            cred: cred.cred,
            token: cred.token
        })

        return await skLandCheckInCore({
            cred: cred.cred,
            token: cred.token
        }, accounts);
    } catch (e) {
        throw e;
    }
}
