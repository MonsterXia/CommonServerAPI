import { Context } from 'hono';
import { SkLandCredValidateRequestParams, SkLandGetCredRequestPayload } from '../../../model/game/hypergraph/skIsland/user';
import { fetchSkLandCred, fetchSkLandCredValidate, fetchSkLandGameAccounts, getCredParser, getHypergryphGameAccountsParser, validateCredParser } from '../../../service/game/hypergryph/skIsland/loginService';
import { buildContextJson, bussinessStatusCode } from '../../../util/hono';
import { HypergryphTokenByPasswordRequestPayload } from '../../../model/game/hypergraph/user';
import { tokenByPasswordParser } from '../../../service/game/hypergryph/loginService';
import { tempCheckIn } from '../../../service/game/hypergryph/skIsland/checkIn';

class skLandController {
    public static getSkLandCred = async (c: Context) => {
        try {
            const input = await c.req.json();
            const formatedInput: SkLandGetCredRequestPayload= getCredParser(input);

            const res = await fetchSkLandCred(formatedInput);
            return buildContextJson(c, 'Fetch SKLand Cred Success', res)
        } catch (e) {
            return buildContextJson(c, 'Fetch SKLand Cred Failed', e, bussinessStatusCode.INTERNAL_SERVER_ERROR);
        }
    }

    public static validateSkLandCred = async (c: Context) => {
        try {
            const input = c.req.query();
            const formatedInput: SkLandCredValidateRequestParams = validateCredParser(input);

            const res = await fetchSkLandCredValidate(formatedInput);
            return buildContextJson(c, 'SKLand Cred Validate Success', res)
        } catch (e) {
            return buildContextJson(c, 'SKLand Cred Validate Failed', e, bussinessStatusCode.INTERNAL_SERVER_ERROR);
        }
    }

    public static getSKLandGameAccounts = async (c: Context) => {
        try {
            const input = await c.req.json();
            const formatedInput = getHypergryphGameAccountsParser(input);

            const res = await fetchSkLandGameAccounts(formatedInput);
            return buildContextJson(c, 'Fetch SKLand Game Accounts Success', res)
        } catch (e) {
            return buildContextJson(c, 'Fetch SKLand Game Accounts Failed', e, bussinessStatusCode.INTERNAL_SERVER_ERROR);
        }
    }

    public static checkIn = async (c: Context) => {
        try {
            const input = await c.req.json();
            const formatedInput : HypergryphTokenByPasswordRequestPayload = tokenByPasswordParser(input);

            const res = await tempCheckIn(formatedInput);
            return buildContextJson(c, 'SKLand Check In Success', res)
        } catch (e) {
            return buildContextJson(c, 'SKLand Check In Failed', e, bussinessStatusCode.INTERNAL_SERVER_ERROR);
        }
    }
}

export default skLandController;