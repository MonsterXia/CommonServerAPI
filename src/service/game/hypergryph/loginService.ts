import {
    hypergryphGrantOAuthTokenAPI,
    hypergryphSendPhoneCodeAPI,
    hypergryphTokenByPasswordAPI,
    hypergryphTokenByPhoneCodeAPI,
    hypergryphTokenValidateAPI
} from '@/common/API/hypergryph';
import {
    HypergryphGrantOAuthTokenRequestPayload,
    HypergryphSendPhoneCodePayload,
    HypergryphTokenByPasswordRequestPayload,
    HypergryphTokenByPhoneCodeRequestPayload,
    HypergryphTokenValidateRequestParams,
    UserInfo
} from '@/model/game/hypergraph/user'
import { StandardServerResult } from '@/model/util/hono';
import { buildStandardServerResponse, businessStatusCode } from '@/util/hono';

export const sendPhoneCodeParser = (data: any): StandardServerResult<HypergryphSendPhoneCodePayload | null> => {
    if (!data.phone) {
        return buildStandardServerResponse(
            false,
            'Missing phone',
            null,
            'Missing phone in request payload',
            businessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            phone: data.phone.toString()
        },
        null,
        businessStatusCode.OK
    )
}

export const tokenByPhoneCodeParser = (data: any): StandardServerResult<HypergryphTokenByPhoneCodeRequestPayload | null> => {
    if (!data.phone || !data.code) {
        return buildStandardServerResponse(
            false,
            'Missing phone or code',
            null,
            'Missing phone or code in request payload',
            businessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            phone: data.phone.toString(),
            code: data.code.toString()
        },
        null,
        businessStatusCode.OK
    )
}

export const tokenByPasswordParser = (data: any): StandardServerResult<HypergryphTokenByPasswordRequestPayload | null> => {
    if (!data.phone || !data.password) {
        return buildStandardServerResponse(
            false,
            'Missing phone or password',
            null,
            'Missing phone or password in request payload',
            businessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            phone: data.phone.toString(),
            password: data.password.toString()
        },
        null,
        businessStatusCode.OK
    )
}

export const tokenValidateParser = (params: any): StandardServerResult<HypergryphTokenValidateRequestParams | null> => {
    if (!params.token) {
        return buildStandardServerResponse(
            false,
            'Missing token',
            null,
            'Missing token in request params',
            businessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request params successfully',
        {
            token: params.token.toString()
        },
        null,
        businessStatusCode.OK
    )
}

export const getHypergryphOauthTokenParser = (data: any): StandardServerResult<HypergryphGrantOAuthTokenRequestPayload | null> => {
    if (!data.token) {
        return buildStandardServerResponse(
            false,
            'Missing token',
            null,
            'Missing token in request payload',
            businessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            token: data.token.toString()
        },
        null,
        businessStatusCode.OK
    )
}

export const fetchHypergryphPhoneCode = async (data: HypergryphSendPhoneCodePayload): Promise<StandardServerResult<string | null>> => {
    try {
        const res = await hypergryphSendPhoneCodeAPI(data);
        if (res.status === 0) {
            return buildStandardServerResponse(
                true,
                'Fetch phone code successfully',
                res.msg,
                null,
                businessStatusCode.OK
            );
        } else {
            return buildStandardServerResponse(
                false,
                'Failed to fetch phone code',
                null,
                res.msg,
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'Failed to fetch phone code',
            null,
            e,
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}

export const fetchHypergryphTokenByPhoneCode = async (data: HypergryphTokenByPhoneCodeRequestPayload): Promise<StandardServerResult<string | null>> => {
    try {
        const res = await hypergryphTokenByPhoneCodeAPI(data);
        if (res.status === 0) {
            return buildStandardServerResponse(
                true,
                'Fetch token by phone code successfully',
                res.data.token,
                null,
                businessStatusCode.OK
            );
        } else {
            return buildStandardServerResponse(
                false,
                'Failed to fetch token by phone code',
                null,
                res.msg,
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'Failed to fetch token by phone code',
            null,
            e,
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}

export const fetchHypergryphTokenByPassword = async (data: HypergryphTokenByPasswordRequestPayload): Promise<StandardServerResult<string | null>> => {
    try {
        const res = await hypergryphTokenByPasswordAPI(data);
        if (res.status === 0) {
            return buildStandardServerResponse(
                true,
                'Fetch token by password successfully',
                res.data.token,
                null,
                businessStatusCode.OK
            );
        } else {
            return buildStandardServerResponse(
                false,
                'Failed to fetch token by password',
                null,
                res.msg,
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'Failed to fetch token by password',
            null,
            e,
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}

export const fetchHypergryphTokenValidate = async (params: HypergryphTokenValidateRequestParams): Promise<StandardServerResult<UserInfo['data'] | null>> => {
    try {
        const res = await hypergryphTokenValidateAPI(params);
        if (res.status === 0) {
            return buildStandardServerResponse(
                true,
                'Token validate successfully',
                res.data,
                null,
                businessStatusCode.OK
            );
        } else {
            return buildStandardServerResponse(
                false,
                'Failed to validate token',
                null,
                res.msg,
                businessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'Failed to validate token',
            null,
            e,
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}

export const fetchHypergryphOauthToken = async (data: HypergryphGrantOAuthTokenRequestPayload): Promise<StandardServerResult<string | null>> => {
    try {
        const res = await hypergryphGrantOAuthTokenAPI(data);
        if (res.status === 0) {
            return buildStandardServerResponse(
                true,
                'Fetch Hypergryph skLand Oauth Token successfully',
                res.data.code,
                null,
                businessStatusCode.OK
            );
        } else {
            return buildStandardServerResponse(
                false,
                'Failed to fetch Hypergryph skLand Oauth Token',
                null,
                res.msg,
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    } catch (e) {
        return buildStandardServerResponse(
            false,
            'Failed to fetch Hypergryph skLand Oauth Token',
            null,
            e,
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}
