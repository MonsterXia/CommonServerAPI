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
import { createServiceHandler, createValidatedHandler } from '@/controller/handlers';
import { buildStandardServerResponse } from '@/util/hono';

class userController {
    public static userRegister = createValidatedHandler(
        userRegisterParser,
        userRegisterService,
        'User Register Failed',
    );

    public static userLogin = createValidatedHandler(
        userPasswordLoginParser,
        userPasswordLoginService,
        'User Login Failed',
    );

    public static sendEmailVerificationCode = createValidatedHandler(
        sendEmailVerificationCodeParser,
        sendEmailVerificationCodeService,
        'Send Email Verification Code Failed',
    );

    public static checkUsernameExist = createServiceHandler(c => {
        const username = c.req.param('username');
        if (!username) return buildStandardServerResponse(false, 'Missing username', null, 'Username route parameter is required', 400);
        return checkUsernameExistService(c, username);
    }, 'Check Username Exist Failed');

    public static userLogout = createServiceHandler(userLogoutService, 'Logout failed');
    public static getCurrentUser = createServiceHandler(getCurrentUserService, 'Get Current User Failed');
}

export default userController;
