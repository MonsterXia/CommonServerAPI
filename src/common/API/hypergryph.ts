import { getGatewayManager } from '../../lib/gatewayManager';
import {
    HypergryphCommonLoginResponse,
    HypergryphGrantOAuthTokenRequestPayload,
    HypergryphSendPhoneCodePayload,
    HypergryphTokenByPasswordRequestPayload,
    HypergryphTokenByPhoneCodeRequestPayload,
    HypergryphTokenValidateRequestParams,
    UserInfo,
    UserOAuth,
    UserToken
} from '../../model/game/hypergraph/user';
import { hypergryphEndpoints } from '../config/endpoints';
import { skLandAppId } from '../constant/hypergryph';
import { contentJsonHeader } from '../constant/requestHeader';

const gatewayManagerInstance = getGatewayManager();

export const hypergryphSendPhoneCodeAPI = async (data: HypergryphSendPhoneCodePayload): Promise<HypergryphCommonLoginResponse> => {
    const url = gatewayManagerInstance.buildHypergryphURL(hypergryphEndpoints.sendSmsCode);
    const payload = {
        ...data,
        type: 2
    }
    return await gatewayManagerInstance.post<HypergryphCommonLoginResponse>(url, payload, { headers: { ...contentJsonHeader } });
}

export const hypergryphTokenByPhoneCodeAPI = async (data: HypergryphTokenByPhoneCodeRequestPayload): Promise<UserToken> => {
    const url = gatewayManagerInstance.buildHypergryphURL(hypergryphEndpoints.tokenByPhoneCode);
    return await gatewayManagerInstance.post<UserToken>(url, data, { headers: { ...contentJsonHeader } });
}

export const hypergryphTokenByPasswordAPI = async (data: HypergryphTokenByPasswordRequestPayload): Promise<UserToken> => {
    const url = gatewayManagerInstance.buildHypergryphURL(hypergryphEndpoints.tokenByPassword);
    return await gatewayManagerInstance.post<UserToken>(url, data, { headers: { ...contentJsonHeader } });
}

export const hypergryphTokenValidateAPI = async (params: HypergryphTokenValidateRequestParams): Promise<UserInfo> => {
    const url = gatewayManagerInstance.buildHypergryphURL(hypergryphEndpoints.tokenValidation);
    return await gatewayManagerInstance.get<UserInfo>(url, params);
}

export const hypergryphGrantOAuthTokenAPI = async (data: HypergryphGrantOAuthTokenRequestPayload, appCode: string = skLandAppId): Promise<UserOAuth> => {
    const payload = {
        ...data,
        appCode,
        type: 0
    }
    const url = gatewayManagerInstance.buildHypergryphURL(hypergryphEndpoints.grantOAuthToken);
    return await gatewayManagerInstance.post<UserOAuth>(url, payload, { headers: { ...contentJsonHeader } });
}