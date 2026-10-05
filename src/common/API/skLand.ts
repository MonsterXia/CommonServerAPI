import { getGatewayManager } from '@/lib/gatewayManager';
import { SklandAccountListResponse, SKLandAccountsRequestParams, SKLandCheckInRequestPayload, SkLandCredResponse, SkLandCredValidateRequestParams, SkLandCredValidateResponse, SkLandGetCredRequestPayload } from '../../model/game/hypergraph/skIsland/user';
import { getSkLandSignHeader } from '@/util/skLand';
import { sklandEndpoints } from '../config/endpoints';
import { contentJsonHeader } from '../constant/requestHeader';
import axios from 'axios';
import type { Cred } from '@/model/game/hypergraph/skIsland/user';

const gatewayManagerInstance = getGatewayManager();

export async function fetchSkLandProfileAPI(cred: Cred, account: SKLandCheckInRequestPayload): Promise<unknown> {
    return fetchSkLandData(cred, account);
}

export async function fetchSkLandWarEchoesAPI(cred: Cred, account: SKLandCheckInRequestPayload): Promise<unknown> {
    if (account.appCode !== 'endfield') throw new Error('Unsupported game');
    return fetchSkLandData(cred, account, sklandEndpoints.endfieldWarEchoes);
}

export async function fetchSkLandMonolithAPI(cred: Cred, account: SKLandCheckInRequestPayload): Promise<unknown> {
    if (account.appCode !== 'endfield') throw new Error('Unsupported game');
    return fetchSkLandData(cred, account, sklandEndpoints.endfieldMonolith);
}

async function fetchSkLandData(cred: Cred, account: SKLandCheckInRequestPayload, endpoint?: string): Promise<unknown> {
    const endfield = account.appCode === 'endfield';
    if (!endfield && account.appCode !== 'arknights') throw new Error('Unsupported game');
    const query = new URLSearchParams(endfield
        ? { roleId: account.uid, serverId: account.gameId, userId: cred.userId }
        : { uid: account.uid });
    const url = gatewayManagerInstance.buildSKLandURL(endpoint ?? (endfield ? sklandEndpoints.endfieldProfile : sklandEndpoints.arknightsProfile));
    let delay: number | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
        const headers = await getSkLandSignHeader(cred, url, query, delay);
        if (endfield) headers['sk-game-role'] = `3_${account.uid}_${account.gameId}`;
        try {
            const response = await gatewayManagerInstance.get<{ code: number; data?: unknown }>(`${url}?${query}`, {}, { headers, timeout: 20000 });
            if (response.code !== 0 || !response.data) throw new Error('Game profile unavailable');
            return response.data;
        } catch (error) {
            if (attempt === 0 && axios.isAxiosError(error) && error.response?.status === 401 && error.response.data?.code === 10003) {
                const timestamp = Number(error.response.data.timestamp);
                if (Number.isFinite(timestamp)) { delay = Number(headers.timeStamp) - timestamp; continue; }
            }
            throw error;
        }
    }
    throw new Error('Game profile unavailable');
}

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

export { fetchSkLandCheckInAPI } from './skLandAttendance';
