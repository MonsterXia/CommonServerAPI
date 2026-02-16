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
import { buildContextJson, bussinessStatusCode } from '../../../util/hono';


class hypergryphController {
    public static getPhoneCode = async (c: Context) => {
        try{
            const input = await c.req.json();
            const formatedInput: HypergryphSendPhoneCodePayload = sendPhoneCodeParser(input);

            const res = await fetchHypergryphPhoneCode(formatedInput);
            return buildContextJson(c, 'Fetch Hypergryph Phone Code Success', res)
        } catch (e) {
            return buildContextJson(c, 'Fetch Hypergryph Phone Code Error', e, bussinessStatusCode.INTERNAL_SERVER_ERROR)
        }
    }

    public static getTokenByPhoneCode = async (c: Context) => {
        try {
            const input = await c.req.json();
            const formatedInput: HypergryphTokenByPhoneCodeRequestPayload = tokenByPhoneCodeParser(input);

            const res = await fetchHypergryphTokenByPhoneCode(formatedInput);
            return buildContextJson(c, 'Get Hypergryph Token By Phone Code Success', res)
        } catch (e) {
            return buildContextJson(c, 'Get Hypergryph Token By Phone Code Error', e, bussinessStatusCode.INTERNAL_SERVER_ERROR)
        }
    }

    public static getTokenByPassword = async (c: Context) => {
        try {
            const input = await c.req.json();
            const formatedInput: HypergryphTokenByPasswordRequestPayload = tokenByPasswordParser(input);

            const res = await fetchHypergryphTokenByPassword(formatedInput);
            return buildContextJson(c, 'Get Hypergryph Token By Password Success', res)
        } catch (e) {
            return buildContextJson(c, 'Get Hypergryph Token By Password Error', e, bussinessStatusCode.INTERNAL_SERVER_ERROR)
        }
    }

    public static tokenValidate = async (c: Context) => {
        try {
            const params = c.req.query();
            const formatedInput = tokenValidateParser(params);

            const res = await fetchHypergryphTokenValidate(formatedInput);
            return buildContextJson(c, 'Hypergryph Token Validate Success', res)
        } catch (e) {
            return buildContextJson(c, 'Hypergryph Token Validate Error', e, bussinessStatusCode.INTERNAL_SERVER_ERROR)
        }
    }

    public static grantOAuthToken = async (c: Context) => {
        try {
            const data = await c.req.json();
            const formatedInput = getHypergryphOauthTokenParser(data);

            const res = await fetchHypergryphOauthToken(formatedInput);
            return buildContextJson(c, 'Hypergryph Grant OAuth Token Success', res)
        } catch (e) {
            return buildContextJson(c, 'Hypergryph Grant OAuth Token Error', e, bussinessStatusCode.INTERNAL_SERVER_ERROR)
        }
    }
}

export default hypergryphController;