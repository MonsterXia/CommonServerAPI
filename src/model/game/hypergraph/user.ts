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

export interface HypergryphCommonLoginResponse {
    msg: string;
    status: number;
    type: string;
}

export interface UserToken extends HypergryphCommonLoginResponse{
    data: {
        token: string;
    };
}