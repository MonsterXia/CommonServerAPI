import {
    skLandCredValidateAPI,
    skLandGameAccountsAPI,
    skLandGetCredAPI
} from "../../../../common/API/skLand";
import {
    Cred,
    SKLandAccountsRequestParams,
    SKLandCheckInRequestPayload,
    SkLandCredValidateRequestParams,
    SkLandCredValidateResponse,
    SkLandGetCredRequestPayload
} from "../../../../model/game/hypergraph/skIsland/user";
import { StandardServerResult } from "../../../../model/util/hono";
import { buildStandardServerResponse, bussinessStatusCode } from "../../../../util/hono";

export const getCredParser = (data: any): StandardServerResult<SkLandGetCredRequestPayload | null> => {
    if (!data.code) {
        return buildStandardServerResponse(
            false,
            'Missing code',
            null,
            'Missing code in request payload',
            bussinessStatusCode.BAD_REQUEST,
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            code: data.code.toString()
        },
        bussinessStatusCode.OK
    )
}

export const validateCredParser = (data: any): StandardServerResult<SkLandCredValidateRequestParams | null> => {
    if (!data.cred) {
        return buildStandardServerResponse(
            false,
            'Missing cred',
            null,
            'Missing cred in request payload',
            bussinessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            cred: data.cred.toString()
        },
        bussinessStatusCode.OK
    )
}

export const getHypergryphGameAccountsParser = (data: any): StandardServerResult<SKLandAccountsRequestParams | null> => {
    if (!data.cred || !data.token) {
        return buildStandardServerResponse(
            false,
            'Missing cred or token',
            null,
            'Missing cred or token in request payload',
            bussinessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            cred: data.cred.toString(),
            token: data.token.toString()
        },
        bussinessStatusCode.OK
    )
}

export const fetchSkLandCred = async (data: SkLandGetCredRequestPayload): Promise<StandardServerResult<Cred | null>> => {
    try {
        const res = await skLandGetCredAPI(data);
        if (res.code === 0) {
            return buildStandardServerResponse(
                true,
                'Get cred successfully',
                res.data,
                bussinessStatusCode.OK
            )
        } else {
            return buildStandardServerResponse(
                false,
                'SKLand Get Cred Failed',
                null,
                res.message,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'SKLand Get Cred Error',
            null,
            e instanceof Error ? e.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        )
    }
}

export const fetchSkLandCredValidate = async (
    params: SkLandCredValidateRequestParams
): Promise<StandardServerResult<SkLandCredValidateResponse["data"] | null>> => {
    try {
        const res = await skLandCredValidateAPI(params);
        if (res.code === 0) {
            return buildStandardServerResponse(
                true,
                'Get cred successfully',
                res.data,
                bussinessStatusCode.OK
            )
        } else {
            return buildStandardServerResponse(
                false,
                'SKLand Cred Validate Failed',
                null,
                res.message,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'SKLand Cred Validate Error',
            null,
            e instanceof Error ? e.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        )
    }
}

export const fetchSkLandGameAccounts = async (
    params: SKLandAccountsRequestParams
): Promise<StandardServerResult<SKLandCheckInRequestPayload[] | null>> => {
    try {
        const res = await skLandGameAccountsAPI(params);
        if (res.code === 0) {
            const gameAccounts = res.data.list;
            let simpleAccounts: SKLandCheckInRequestPayload[] = gameAccounts.flatMap(account => {
                if (account.appCode === 'arknights') {
                    return account.bindingList.map(binding => ({
                        appCode: account.appCode,
                        nickName: binding.nickName,
                        uid: binding.uid,
                        gameId: binding.channelMasterId,
                    }));
                } else if (account.appCode === 'endfield') {
                    return account.bindingList.map(binding => ({
                        appCode: account.appCode,
                        nickName: binding.defaultRole!.nickname,
                        uid: binding.defaultRole!.roleId,
                        gameId: binding.defaultRole!.serverId,
                    }));
                }
                return [];
            });

            return buildStandardServerResponse(
                true,
                'Get game accounts successfully',
                simpleAccounts,
                bussinessStatusCode.OK
            )
        } else {
            return buildStandardServerResponse(
                false,
                'SKLand Game Accounts Failed',
                null,
                res.message,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'SKLand Game Accounts Error',
            null,
            e instanceof Error ? e.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        )
    }
}



