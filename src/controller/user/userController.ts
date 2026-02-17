import { Context } from 'hono';
import { checkUsernameExistService, userLogoutService, userPasswordLoginParser, userPasswordLoginService, userRegisterParser, userRegisterService } from '../../service/user/userService';
import { buildContextJson, bussinessStatusCode } from '../../util/hono';

class userController {
    public static checkUsernameExist = async (c: Context) => {
        try {
            const username = c.req.param('username');
            const isExist = await checkUsernameExistService(c, username);

            return buildContextJson(c, 'Check Username Exist Success', { exist: isExist })
        } catch (e) {
            return buildContextJson(c, 'Check Username Exist Failed', e, bussinessStatusCode.INTERNAL_SERVER_ERROR);
        }
    }

    public static userRegister = async (c: Context) => {
        try {
            const input = await c.req.json();
            const formattedInput = userRegisterParser(input);
            const newUser = await userRegisterService(c, formattedInput);
            return buildContextJson(c, 'User Register Success', newUser, bussinessStatusCode.CREATED);
        } catch (e) {
            return buildContextJson(c, 'User Register Failed', e, bussinessStatusCode.INTERNAL_SERVER_ERROR);
        }
    }

    public static userLogin = async (c: Context) => {
        try {
            const input = await c.req.json();
            const formattedInput = userPasswordLoginParser(input);
            const result = await userPasswordLoginService(c, formattedInput);
            return buildContextJson(
                c, 
                result.success ? 'User Login Success' : 'User Login Failed', 
                result, 
                bussinessStatusCode.OK);
        } catch (e) {
            return buildContextJson(c, 'User Login Failed', e, bussinessStatusCode.INTERNAL_SERVER_ERROR);
        }
    }

    public static userLogout = async (c: Context) => {
        try {
            const res = await userLogoutService(c);
            return buildContextJson(
                c, 
                res? 'Logout successful': 'Logout failed', 
                {
                    success: res
                }, 
                bussinessStatusCode.OK
            );
        } catch (e) {
            return buildContextJson(c, 'Logout failed', e, bussinessStatusCode.INTERNAL_SERVER_ERROR);
        }
    }
}

export default userController;