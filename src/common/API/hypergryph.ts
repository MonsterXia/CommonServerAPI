import { HypergryphCommonLoginResponse, HypergryphSendPhoneCodePayload, HypergryphTokenByPasswordRequestPayload, HypergryphTokenByPhoneCodeRequestPayload, UserToken } from "../../model/game/hypergraph/user";
import { hypergryphEndpoints } from "../config/endpoints";
import { contentJsonHeader } from "../constant/requestHeader";
import gatewayManager from "../gateway/gatewayManager"

const gatewayManagerInstance = gatewayManager.getInstance();

export const hypergryphSendPhoneCodeAPI = async (data: HypergryphSendPhoneCodePayload): Promise<HypergryphCommonLoginResponse> => {
    const url = gatewayManagerInstance.buildHypergryphURL(hypergryphEndpoints.sendSmsCode);
    const payload = {
        ...data,
        type: 2
    }
    return await gatewayManagerInstance.post<HypergryphCommonLoginResponse>(url, payload, { headers: {...contentJsonHeader} });
}

export const hypergryphTokenByPhoneCodeAPI = async (data: HypergryphTokenByPhoneCodeRequestPayload): Promise<UserToken> => {
    const url = gatewayManagerInstance.buildHypergryphURL(hypergryphEndpoints.tokenByPhoneCode);
    return await gatewayManagerInstance.post<UserToken>(url, data, { headers: {...contentJsonHeader} });
}

export const hypergryphTokenByPasswordAPI = async (data: HypergryphTokenByPasswordRequestPayload): Promise<UserToken> => {
    const url = gatewayManagerInstance.buildHypergryphURL(hypergryphEndpoints.tokenByPassword);
    const response = await gatewayManagerInstance.post<UserToken>(url, data, { headers: {...contentJsonHeader} });
    return response;
}