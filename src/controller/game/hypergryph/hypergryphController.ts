import { Context } from 'hono';
import {
    HypergryphSendPhoneCodePayload,
    HypergryphTokenByPasswordRequestPayload,
    HypergryphTokenByPhoneCodeRequestPayload
} from '../../../model/game/hypergraph/user';
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
} from '../../../service/game/hypergryph/loginService';
import { buildContextJson, buildErrorContextJson, bussinessStatusCode } from '../../../util/hono';


class hypergryphController {
    public static getPhoneCode = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = sendPhoneCodeParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;

            const res = await fetchHypergryphPhoneCode(formattedInput);
            return buildContextJson(c, res)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Fetch Hypergryph Phone Code Error', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    }

    public static getTokenByPhoneCode = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = tokenByPhoneCodeParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;

            const res = await fetchHypergryphTokenByPhoneCode(formattedInput);
            return buildContextJson(c, res)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Get Hypergryph Token By Phone Code Error', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    }

    public static getTokenByPassword = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = tokenByPasswordParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;

            const res = await fetchHypergryphTokenByPassword(formattedInput);
            return buildContextJson(c, res)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Get Hypergryph Token By Password Error', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    }

    public static tokenValidate = async (c: Context) => {
        try {
            const params = c.req.query();
            const parserResult = tokenValidateParser(params);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;

            const res = await fetchHypergryphTokenValidate(formattedInput);
            return buildContextJson(c, res)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Hypergryph Token Validate Error', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    }

    public static grantOAuthToken = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = getHypergryphOauthTokenParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;

            const res = await fetchHypergryphOauthToken(formattedInput);
            return buildContextJson(c, res)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Hypergryph Grant OAuth Token Error', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            )
        }
    }
}

export default hypergryphController;