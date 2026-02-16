import { Context } from "hono";
import { hypergryphTokenByPasswordAPI } from "../../../common/API/hypergryph";
import { HypergryphSendPhoneCodePayload, HypergryphTokenByPasswordRequestPayload, HypergryphTokenByPhoneCodeRequestPayload } from "../../../model/game/hypergraph/user";
import { fetchHypergryphPhoneCode, fetchHypergryphTokenByPassword, fetchHypergryphTokenByPhoneCode, sendPhoneCodeParser, tokenByPasswordParser, tokenByPhoneCodeParser } from "../../../service/game/hypergryph/loginService";
import { buildContextJson, bussinessStatusCode } from "../../../util/hono";

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
}

export default hypergryphController;