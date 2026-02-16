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

export const getCredParser = (data: any): SkLandGetCredRequestPayload => {
    if (!data.code) {
        throw new Error('Missing code');
    }
    return {
        code: data.code.toString()
    }
}

export const validateCredParser = (data: any): SkLandCredValidateRequestParams => {
    if (!data.cred) {
        throw new Error('Missing cred');
    }
    return {
        cred: data.cred.toString()
    }
}

export const getHypergryphGameAccountsParser = (data: any): SKLandAccountsRequestParams => {
    if (!data.cred || !data.token) {
        throw new Error('Missing cred or token');
    }
    return {
        cred: data.cred.toString(),
        token: data.token.toString()
    }
}

export const fetchSkLandCred = async (data: SkLandGetCredRequestPayload): Promise<Cred> => {
    try {
        const res = await skLandGetCredAPI(data);
        if (res.code === 0) {
            return res.data;
        } else {
            throw new Error(`SKLand Get Cred Failed: ${res.message}`);
        }
    } catch (e) {
        throw new Error(`SKLand Get Cred Error: ${e}`);
    }
}

export const fetchSkLandCredValidate = async (params: SkLandCredValidateRequestParams): Promise<SkLandCredValidateResponse["data"]> => {
    try {
        const res = await skLandCredValidateAPI(params);
        if (res.code === 0) {
            return res.data;
        } else {
            throw new Error(`SKLand Cred Validate Failed: ${res.message}`);
        }
    } catch (e) {
        throw new Error(`SKLand Cred Validate Error: ${e}`);
    }
}

export const fetchSkLandGameAccounts = async (params: SKLandAccountsRequestParams): Promise<SKLandCheckInRequestPayload[]> => {
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

            return simpleAccounts;
        } else {
            throw new Error(`SKLand Game Accounts Failed: ${res.message}`);
        }
    } catch (e) {
        throw new Error(`SKLand Game Accounts Error: ${e}`);
    }
}



