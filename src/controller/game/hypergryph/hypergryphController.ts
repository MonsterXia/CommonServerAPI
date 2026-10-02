import {
    fetchHypergryphOauthToken,
    fetchHypergryphPhoneCode,
    fetchHypergryphTokenByPassword,
    fetchHypergryphTokenByPhoneCode,
    fetchHypergryphTokenValidate,
    getHypergryphOauthTokenParser,
    sendPhoneCodeParser,
    tokenByPasswordParser,
    tokenByPhoneCodeParser,
    tokenValidateParser
} from '@/service/game/hypergryph/loginService';
import { createValidatedHandler } from '@/controller/handlers';

class hypergryphController {
    public static getPhoneCode = createValidatedHandler(
        sendPhoneCodeParser,
        (_c, data) => fetchHypergryphPhoneCode(data),
        'Fetch Hypergryph Phone Code Error',
    );

    public static getTokenByPhoneCode = createValidatedHandler(
        tokenByPhoneCodeParser,
        (_c, data) => fetchHypergryphTokenByPhoneCode(data),
        'Get Hypergryph Token By Phone Code Error',
    );

    public static getTokenByPassword = createValidatedHandler(
        tokenByPasswordParser,
        (_c, data) => fetchHypergryphTokenByPassword(data),
        'Get Hypergryph Token By Password Error',
    );

    public static tokenValidate = createValidatedHandler(
        tokenValidateParser,
        (_c, data) => fetchHypergryphTokenValidate(data),
        'Hypergryph Token Validate Error',
        'query',
    );

    public static grantOAuthToken = createValidatedHandler(
        getHypergryphOauthTokenParser,
        (_c, data) => fetchHypergryphOauthToken(data),
        'Hypergryph Grant OAuth Token Error',
    );
}

export default hypergryphController;
