export interface HypergryphSendPhoneCodePayload {
    phone: string;
}

export interface HypergryphTokenByPhoneCodeRequestPayload {
    phone: string;
    code: string;
}

export interface HypergryphTokenByPasswordRequestPayload {
    phone: string;
    password: string;
}

export interface HypergryphTokenValidateRequestParams {
    token: string;
}

export interface HypergryphGrantOAuthTokenRequestPayload {
    token: string;
}

export interface HypergryphCommonLoginResponse {
    msg: string;
    status: number;
    type: string;
}

export interface UserToken extends HypergryphCommonLoginResponse {
    data: {
        token: string;
    };
}

export interface UserInfo extends HypergryphCommonLoginResponse {
    data: {
        hgId: string;
        phone: string;
        email: string | null;
        identityNum: string;
        identityName: string;
        isMinor: boolean;
        isLatestUserAgreement: boolean;
    };
}

export interface UserOAuth extends HypergryphCommonLoginResponse {
    data: {
        code: string;
        uid: string;
    }
}