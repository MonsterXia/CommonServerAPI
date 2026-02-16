import {
    hypergryphGrantOAuthTokenAPI,
    hypergryphSendPhoneCodeAPI,
    hypergryphTokenByPasswordAPI,
    hypergryphTokenByPhoneCodeAPI,
    hypergryphTokenValidateAPI
} from '../../../common/API/hypergryph';
import {
    HypergryphGrantOAuthTokenRequestPayload,
    HypergryphSendPhoneCodePayload,
    HypergryphTokenByPasswordRequestPayload,
    HypergryphTokenByPhoneCodeRequestPayload,
    HypergryphTokenValidateRequestParams,
    UserInfo
} from '../../../model/game/hypergraph/user'

export const sendPhoneCodeParser = (data: any): HypergryphSendPhoneCodePayload => {
    if (!data.phone) {
        throw new Error('Missing phone');
    }
    return {
        phone: data.phone.toString()
    }
}

export const tokenByPhoneCodeParser = (data: any): HypergryphTokenByPhoneCodeRequestPayload => {
    if (!data.phone || !data.code) {
        throw new Error('Missing phone or code');
    }
    return {
        phone: data.phone.toString(),
        code: data.code.toString()
    }
}

export const tokenByPasswordParser = (data: any): HypergryphTokenByPasswordRequestPayload => {
    if (!data.phone || !data.password) {
        throw new Error('Missing phone or password');
    }
    return {
        phone: data.phone.toString(),
        password: data.password.toString()
    }
}

export const tokenValidateParser = (params: any): HypergryphTokenValidateRequestParams => {
    if (!params.token) {
        throw new Error('Missing token');
    }
    return {
        token: params.token.toString()
    }
}

export const getHypergryphOauthTokenParser = (data: any): HypergryphGrantOAuthTokenRequestPayload => {
    if (!data.token) {
        throw new Error('Missing token');
    }
    return {
        token: data.token.toString()
    }
}

export const fetchHypergryphPhoneCode = async (data: HypergryphSendPhoneCodePayload): Promise<string> => {
    try {
        const res = await hypergryphSendPhoneCodeAPI(data);
        if (res.status === 0) {
            return res.msg;
        } else {
            throw new Error('Failed to fetch token: ' + res.msg);
        }
    } catch (e) {
        throw new Error(`Error in fetch hypergryph phone code: ${e}`);
    }
}

export const fetchHypergryphTokenByPhoneCode = async (data: HypergryphTokenByPhoneCodeRequestPayload): Promise<string> => {
    try {
        const res = await hypergryphTokenByPhoneCodeAPI(data);
        if (res.status === 0) {
            return res.data.token;
        } else {
            throw new Error('Failed to fetch token: ' + res.msg);
        }
    } catch (e) {
        throw new Error(`Error in fetch hypergryph token by phone code: ${e}`);
    }
}

export const fetchHypergryphTokenByPassword = async (data: HypergryphTokenByPasswordRequestPayload): Promise<string> => {
    try {
        const res = await hypergryphTokenByPasswordAPI(data);
        if (res.status === 0) {
            return res.data.token;
        } else {
            throw new Error('Failed to fetch token: ' + res.msg);
        }
    } catch (e) {
        throw new Error(`Error in get hypergryph token by password: ${e}`);
    }
}

export const fetchHypergryphTokenValidate = async (params: HypergryphTokenValidateRequestParams): Promise<UserInfo['data']> => {
    try {
        const res = await hypergryphTokenValidateAPI(params);
        if (res.status === 0) {
            return res.data;
        } else {
            throw new Error('Failed to validate token: ' + res.msg);
        }
    } catch (e) {
        throw new Error(`Error in fetch hypergryph token validate: ${e}`);
    }
}

export const fetchHypergryphOauthToken = async (data: HypergryphGrantOAuthTokenRequestPayload): Promise<string> => {
    try {
        const res = await hypergryphGrantOAuthTokenAPI(data);
        if (res.status === 0) {
            return res.data.code;
        } else {
            throw new Error('Failed to fetch Hypergryph skLand Oauth Token: ' + res.msg);
        }
    } catch (e) {
        throw new Error(`Error in fetch Hypergryph skLand Oauth Token: ${e}`);
    }
}
