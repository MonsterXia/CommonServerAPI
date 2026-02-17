import { getGatewayManager } from '../../lib/gatewayManager';
import { SklandAccountListResponse, SKLandAccountsRequestParams, SKLandCheckInAPIRequestParams, SKLandCheckInRequestPayload, SKLandCheckInResultResponse, SkLandCredResponse, SkLandCredValidateRequestParams, SkLandCredValidateResponse, SkLandGetCredRequestPayload } from '../../model/game/hypergraph/skIsland/user';
import { getSkLandSignHeader } from '../../util/skLand';
import { sklandEndpoints } from '../config/endpoints';
import { contentJsonHeader } from '../constant/requestHeader';
import axios from 'axios';

const gatewayManagerInstance = getGatewayManager();

export const skLandGetCredAPI = async (data: SkLandGetCredRequestPayload): Promise<SkLandCredResponse> => {
    const url = gatewayManagerInstance.buildSKLandURL(sklandEndpoints.getCred);
    const payload = {
        ...data,
        kind: 1
    }
    return await gatewayManagerInstance.post<SkLandCredResponse>(url, payload, { headers: { ...contentJsonHeader } });
}

export const skLandCredValidateAPI = async (params: SkLandCredValidateRequestParams): Promise<SkLandCredValidateResponse> => {
    const url = gatewayManagerInstance.buildSKLandURL(sklandEndpoints.credValidation);
    const config = {
        headers: {
            ...contentJsonHeader,
            Cred: params.cred
        }
    }
    return await gatewayManagerInstance.get<SkLandCredValidateResponse>(url, {}, config);
}

export const skLandGameAccountsAPI = async (params: SKLandAccountsRequestParams): Promise<SklandAccountListResponse> => {
    const url = gatewayManagerInstance.buildSKLandURL(sklandEndpoints.getGameAccounts);
    let signHeaders = await getSkLandSignHeader(params, url, new URLSearchParams());
    try {
        const res = await gatewayManagerInstance.get<SklandAccountListResponse>(url, {}, { headers: { ...signHeaders } });
        return res;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response && error.response.status === 401 && error.response.data.code === 10003) {
            const result = error.response.data;
            let timestampDiff = Number(signHeaders.timeStamp) - Number(result.timestamp)
            console.log('Adjusting time difference beturn standart time and Hypergrypy by ', timestampDiff, ' seconds')
            signHeaders = await getSkLandSignHeader(params, url, new URLSearchParams(), timestampDiff);
            return await gatewayManagerInstance.get<SklandAccountListResponse>(url, {}, { headers: { ...signHeaders } });
        }
        throw error;
    }
}

export const fetchSkLandCheckInAPI = async (
    cred: SKLandAccountsRequestParams,
    data: SKLandCheckInRequestPayload
) => {
    let endpoint = '';
    switch (data.appCode) {
        case 'arknights':
            endpoint = sklandEndpoints.arknightsCheckIn;
            break;
        case 'endfield':
            endpoint = sklandEndpoints.endfieldCheckIn;
            break;
        default:
            throw new Error('Unsupported appCode for SKLand Check In');
    }

    const payload: SKLandCheckInAPIRequestParams = {
        uid: data.uid,
        gameId: data.gameId
    }

    const url = gatewayManagerInstance.buildSKLandURL(endpoint);
    const res = await retryWhen401SkLandCheckInAPI(cred, payload, url, data.appCode);

    return res;
}

export const retryWhen401SkLandCheckInAPI = async (
    cred: SKLandAccountsRequestParams,
    data: SKLandCheckInAPIRequestParams,
    url: string,
    appCode: string,
    delay?: number
): Promise<string[] | string> => {
    let signHeaders = await getSkLandSignHeader(cred, url, data, delay);
    if (appCode === 'endfield') {
        signHeaders["sk-game-role"] = `3_${data.uid}_${data.gameId}`
    }

    try {
        const res = await gatewayManagerInstance.post<SKLandCheckInResultResponse>(url, data, { headers: { ...signHeaders } });
        if (res.code === 0) {
            if (appCode === 'endfield') {
                let result = res.data.awardIds!
                let endfieldAwardMap = res.data.resourceInfoMap!
                const awardIds = result.map(s => {
                    const resInfo = endfieldAwardMap[s.id]
                    return `${resInfo.name} x ${resInfo.count}`
                })
                return awardIds
            } else if (appCode === 'arknights') {
                let result = res.data.awards!
                const awards = result.map(s => `${s.type}: ${s.resource.name} x ${s.count}`)
                return awards;
            } else {
                return JSON.stringify(res.data)
            }
        } else {
            return JSON.stringify(res.data)
        }
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            const result = error.response.data;
            if (error.response.status === 401 && error.response.data.code === 10003) {
                let timestampDiff = Number(signHeaders.timeStamp) - Number(result.timestamp)
                console.log('Adjusting time difference beturn standart time and Hypergrypy by ', timestampDiff, ' seconds')
                return retryWhen401SkLandCheckInAPI(cred, data, url, appCode, timestampDiff);
            } else if (error.response.status === 403 && result.code === 10001) {
                return result.message;
            }
        }
        throw error;
    }
}