import { fetchSkLandCheckInAPI } from "../../../../common/API/skLand";
import { SKLandAccountsRequestParams, SKLandCheckInRequestPayload } from "../../../../model/game/hypergraph/skIsland/user";
import { HypergryphTokenByPasswordRequestPayload } from "../../../../model/game/hypergraph/user";
import { StandardServerResult } from "../../../../model/util/hono";
import { buildStandardServerResponse, bussinessStatusCode } from "../../../../util/hono";
import { fetchHypergryphOauthToken, fetchHypergryphTokenByPassword } from "../loginService";
import { fetchSkLandCred, fetchSkLandGameAccounts } from "./loginService";

export const skLandCheckInCore = async (
    cred: SKLandAccountsRequestParams, 
    accounts: SKLandCheckInRequestPayload[]
): Promise<StandardServerResult<any>> => {
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

    return buildStandardServerResponse(
        true,
        errorResults.length === 0 ? 'All accounts checked in successfully' : 'Some accounts failed to check in',
        {
            checkInResults,
            errorResults,
        },
        errorResults.length === 0 ? bussinessStatusCode.OK : bussinessStatusCode.MULTI_STATUS
    );
}

export const tempCheckIn = async (
    data: HypergryphTokenByPasswordRequestPayload
): Promise<StandardServerResult<any>> => {
    try {
        const token = await fetchHypergryphTokenByPassword(data)
        const tokenValue = token.data!;

        const code = await fetchHypergryphOauthToken({
            token: tokenValue
        })
        const codeValue = code.data!;

        const cred = await fetchSkLandCred({
            code: codeValue
        })


        const credCore = {
            cred: cred.data?.cred!,
            token: cred.data?.token!
        }
        const accounts = await fetchSkLandGameAccounts(credCore)

        return await skLandCheckInCore(credCore, accounts.data!);
    } catch (e) {
        throw e;
    }
}
