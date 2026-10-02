import {
    skLandCredValidateAPI,
    skLandGameAccountsAPI,
    skLandGetCredAPI
} from "@/common/API/skLand";
import {
    Cred,
    SKLandAccountsRequestParams,
    SKLandGameAccount,
    SkLandCredValidateRequestParams,
    SkLandCredValidateResponse,
    SkLandGetCredRequestPayload
} from "@/model/game/hypergraph/skIsland/user";
import { StandardServerResult } from "@/model/util/hono";
import { buildStandardServerResponse, businessStatusCode } from "@/util/hono";

export const getCredParser = (data: any): StandardServerResult<SkLandGetCredRequestPayload | null> => {
    if (!data.code) {
        return buildStandardServerResponse(
            false,
            'Missing code',
            null,
            'Missing code in request payload',
            businessStatusCode.BAD_REQUEST,
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            code: data.code.toString()
        },
        null,
        businessStatusCode.OK
    )
}

export const validateCredParser = (data: any): StandardServerResult<SkLandCredValidateRequestParams | null> => {
    if (!data.cred) {
        return buildStandardServerResponse(
            false,
            'Missing cred',
            null,
            'Missing cred in request payload',
            businessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            cred: data.cred.toString()
        },
        null,
        businessStatusCode.OK
    )
}

export const getHypergryphGameAccountsParser = (data: any): StandardServerResult<SKLandAccountsRequestParams | null> => {
    if (!data.cred || !data.token) {
        return buildStandardServerResponse(
            false,
            'Missing cred or token',
            null,
            'Missing cred or token in request payload',
            businessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            cred: data.cred.toString(),
            token: data.token.toString()
        },
        null,
        businessStatusCode.OK
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
                null,
                businessStatusCode.OK
            )
        } else {
            return buildStandardServerResponse(
                false,
                'SKLand Get Cred Failed',
                null,
                res.message,
                businessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'SKLand Get Cred Error',
            null,
            e instanceof Error ? e.message : 'Unknown error',
            businessStatusCode.INTERNAL_SERVER_ERROR
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
                null,
                businessStatusCode.OK
            )
        } else {
            return buildStandardServerResponse(
                false,
                'SKLand Cred Validate Failed',
                null,
                res.message,
                businessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'SKLand Cred Validate Error',
            null,
            e instanceof Error ? e.message : 'Unknown error',
            businessStatusCode.INTERNAL_SERVER_ERROR
        )
    }
}

export const fetchSkLandGameAccounts = async (
    params: SKLandAccountsRequestParams
): Promise<StandardServerResult<SKLandGameAccount[] | null>> => {
    try {
        const res = await skLandGameAccountsAPI(params);
        if (res.code === 0) {
            const gameAccounts = res.data.list;
            const simpleAccounts: SKLandGameAccount[] = gameAccounts.flatMap(account => {
                if (account.appCode === 'arknights') {
                    return account.bindingList.filter(binding => !binding.isDelete).map(binding => ({
                        appCode: account.appCode,
                        nickName: binding.nickName,
                        uid: binding.uid,
                        gameId: binding.channelMasterId,
                        serverName: binding.channelName,
                    }));
                } else if (account.appCode === 'endfield') {
                    return account.bindingList.filter(binding => !binding.isDelete).flatMap(binding => {
                        const roles = binding.roles?.length ? binding.roles : binding.defaultRole ? [binding.defaultRole] : [];
                        return roles.map(role => ({
                            appCode: account.appCode,
                            nickName: role.nickname,
                            uid: role.roleId,
                            gameId: role.serverId,
                            serverName: role.serverName,
                        }));
                    });
                }
                return [];
            });

            return buildStandardServerResponse(
                true,
                'Get game accounts successfully',
                simpleAccounts,
                null,
                businessStatusCode.OK
            )
        } else {
            return buildStandardServerResponse(
                false,
                'SKLand Game Accounts Failed',
                null,
                res.message,
                businessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'SKLand Game Accounts Error',
            null,
            e instanceof Error ? e.message : 'Unknown error',
            businessStatusCode.INTERNAL_SERVER_ERROR
        )
    }
}


