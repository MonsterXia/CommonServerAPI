import { Context } from "hono";
import { 
    setAdminParser, 
    setAdminService 
} from "@/service/user/superAdminService";
import { 
    buildContextJson, 
    buildErrorContextJson, 
    businessStatusCode
} from "@/util/hono";

class superAdminController {
    public static async setUserAsAdmin(c: Context) {
        try {
            const input = await c.req.json();
            const parserResult = setAdminParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }

            const formattedInput = parserResult.data!;
            const result = await setAdminService(c, formattedInput);
            return buildContextJson(c, result);
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Set User As Admin Failed', 
                e,
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }
}

export default superAdminController;