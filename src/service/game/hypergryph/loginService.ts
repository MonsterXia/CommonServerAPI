import { hypergryphSendPhoneCodeAPI, hypergryphTokenByPasswordAPI, hypergryphTokenByPhoneCodeAPI } from "../../../common/API/hypergryph";
import { HypergryphSendPhoneCodePayload, HypergryphTokenByPasswordRequestPayload, HypergryphTokenByPhoneCodeRequestPayload } from "../../../model/game/hypergraph/user"

export const sendPhoneCodeParser = (data: any): HypergryphSendPhoneCodePayload => {
    if (!data.phone) {
        throw new Error("Missing phone");
    }
    return {
        phone: data.phone.toString()
    }
}

export const tokenByPhoneCodeParser = (data: any): HypergryphTokenByPhoneCodeRequestPayload => {
    if (!data.phone || !data.code) {
        throw new Error("Missing phone or code");
    }
    return {
        phone: data.phone.toString(),
        code: data.code.toString()
    }
}

export const tokenByPasswordParser = (data: any): HypergryphTokenByPasswordRequestPayload => {
    if (!data.phone || !data.password) {
        throw new Error("Missing phone or password");
    }
    return {
        phone: data.phone.toString(),
        password: data.password.toString()
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

export const fetchHypergryphTokenByPhoneCode = async (data: HypergryphTokenByPhoneCodeRequestPayload) => {
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