import { Context } from 'hono';
import { 
    checkUsernameExistService, 
    getCurrentUserService, 
    sendEmailVerificationCodeParser, 
    sendEmailVerificationCodeService, 
    userLogoutService, 
    userPasswordLoginParser, 
    userPasswordLoginService, 
    userRegisterParser, 
    userRegisterService 
} from '@/service/user/userService';
import { 
    buildContextJson, 
    buildErrorContextJson, 
    businessStatusCode
 } from '@/util/hono';

class userController {
    public static checkUsernameExist = async (c: Context) => {
        try {
            const username = c.req.param('username');
            if (!username) {
                return buildErrorContextJson(
                    c,
                    'Missing username',
                    'Username route parameter is required',
                    businessStatusCode.BAD_REQUEST
                );
            }
            const isExist = await checkUsernameExistService(c, username);

            return buildContextJson(c, isExist)
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Check Username Exist Failed', 
                e, 
                businessStatusCode.INTERNAL_SERVER_ERROR
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
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }

    public static userLogin = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = userPasswordLoginParser(input);
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
                businessStatusCode.INTERNAL_SERVER_ERROR
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
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }

    public static getCurrentUser = async (c: Context) => {
        try {
            const res = await getCurrentUserService(c);
            return buildContextJson(c, res);
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Get Current User Failed', 
                e, 
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }

    public static sendEmailVerificationCode = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = sendEmailVerificationCodeParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;
            const res = await sendEmailVerificationCodeService(c, formattedInput);
            return buildContextJson(c, res);
        } catch (e) {
            return buildErrorContextJson(
                c, 
                'Send Email Verification Code Failed', 
                e, 
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }
}

export default userController;
