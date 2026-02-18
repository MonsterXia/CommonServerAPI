import { Context } from 'hono';
import { checkUsernameExistService, userLogoutService, userPasswordLoginParser, userPasswordLoginService, userRegisterParser, userRegisterService } from '../../service/user/userService';
import { buildContextJson, buildErrorContextJson, bussinessStatusCode } from '../../util/hono';

class userController {
    public static checkUsernameExist = async (c: Context) => {
        try {
            const username = c.req.param('username');
            const isExist = await checkUsernameExistService(c, username);

            return buildContextJson(c, isExist)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Check Username Exist Failed', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }

    public static userRegister = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = userRegisterParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }

            const formattedInput = parserResult.data!;
            const newUser = await userRegisterService(c, formattedInput);
            return buildContextJson(c, newUser);
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'User Register Failed', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }

    public static userLogin = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = userPasswordLoginParser(input);
            console.log('userLogin parserResult:', parserResult);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;
            const result = await userPasswordLoginService(c, formattedInput);
            return buildContextJson(
                c, 
                result, 
            );
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'User Login Failed', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }

    public static userLogout = async (c: Context) => {
        try {
            const res = await userLogoutService(c);
            return buildContextJson(
                c, 
                res
            );
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Logout failed', 
                e, 
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }
}

export default userController;