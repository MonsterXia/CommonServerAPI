import { Context } from 'hono';
import { fetchSkLandCred, fetchSkLandCredValidate, fetchSkLandGameAccounts, getCredParser, getHypergryphGameAccountsParser, validateCredParser } from '../../../service/game/hypergryph/skIsland/loginService';
import { buildContextJson, buildErrorContextJson, bussinessStatusCode } from '../../../util/hono';
import { tokenByPasswordParser } from '../../../service/game/hypergryph/loginService';
import { tempCheckIn } from '../../../service/game/hypergryph/skIsland/checkIn';

class skLandController {
    public static getSkLandCred = async (c: Context) => {
        try {
            const input = await c.req.json();
            
            const parserResult = getCredParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;

            const res = await fetchSkLandCred(formattedInput);
            return buildContextJson(c, res);
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Fetch SKLand Cred Failed', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }

    public static validateSkLandCred = async (c: Context) => {
        try {
            const input = c.req.query();
            const parserResult = validateCredParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;

            const res = await fetchSkLandCredValidate(formattedInput);
            return buildContextJson(c, res)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'SKLand Cred Validate Failed', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }

    public static getSKLandGameAccounts = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = getHypergryphGameAccountsParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;

            const res = await fetchSkLandGameAccounts(formattedInput);
            return buildContextJson(c, res)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Fetch SKLand Game Accounts Failed', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }

    public static checkIn = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = tokenByPasswordParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;

            const res = await tempCheckIn(formattedInput);
            return buildContextJson(c, res)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'SKLand Check In Failed', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }
}

export default skLandController;