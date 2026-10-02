import {
    fetchSkLandCred,
    fetchSkLandCredValidate,
    fetchSkLandGameAccounts,
    getCredParser,
    getHypergryphGameAccountsParser,
    validateCredParser
} from '@/service/game/hypergryph/skIsland/loginService';
import { tokenByPasswordParser } from '@/service/game/hypergryph/loginService';
import { tempCheckIn } from '@/service/game/hypergryph/skIsland/checkIn';
import { createValidatedHandler } from '@/controller/handlers';

class skLandController {
    public static getSkLandCred = createValidatedHandler(
        getCredParser,
        (_c, data) => fetchSkLandCred(data),
        'Fetch SKLand Cred Failed',
    );

    public static validateSkLandCred = createValidatedHandler(
        validateCredParser,
        (_c, data) => fetchSkLandCredValidate(data),
        'SKLand Cred Validate Failed',
        'query',
    );

    public static getSKLandGameAccounts = createValidatedHandler(
        getHypergryphGameAccountsParser,
        (_c, data) => fetchSkLandGameAccounts(data),
        'Fetch SKLand Game Accounts Failed',
    );

    public static checkIn = createValidatedHandler(
        tokenByPasswordParser,
        (_c, data) => tempCheckIn(data),
        'SKLand Check In Failed',
    );
}

export default skLandController;
