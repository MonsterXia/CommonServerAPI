import { Context } from 'hono';
import {
    bindCurrentUserService,
    checkPostAdminEmailAvailabilityService,
    getCurrentPostAdminService,
    initializePostAdminRegistrationService,
    postAdminEmailParser,
    postAdminLoginParser,
    postAdminLoginService,
    postAdminLogoutService,
    postAdminRegisterParser,
    postAdminValidationParser,
    unbindCurrentUserService,
    validatePostAdminRegistrationService,
} from '@/service/post/postAdminService';
import { buildContextJson, buildErrorContextJson, bussinessStatusCode } from '@/util/hono';

class PostAdminController {
    public static checkEmailAvailability = async (c: Context) => {
        try {
            const input = await c.req.json();
            const parserResult = postAdminEmailParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            return buildContextJson(
                c,
                await checkPostAdminEmailAvailabilityService(parserResult.data!.email)
            );
        } catch (error) {
            return buildErrorContextJson(
                c,
                'Check Post administrator email failed',
                error,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    };

    public static initializeRegistration = async (c: Context) => {
        try {
            const parserResult = postAdminRegisterParser(await c.req.json());
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            return buildContextJson(
                c,
                await initializePostAdminRegistrationService(c, parserResult.data!)
            );
        } catch (error) {
            return buildErrorContextJson(
                c,
                'Initialize Post administrator registration failed',
                error,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    };

    public static validateRegistration = async (c: Context) => {
        try {
            const parserResult = postAdminValidationParser(await c.req.json());
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            return buildContextJson(
                c,
                await validatePostAdminRegistrationService(parserResult.data!)
            );
        } catch (error) {
            return buildErrorContextJson(
                c,
                'Validate Post administrator registration failed',
                error,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    };

    public static login = async (c: Context) => {
        try {
            const parserResult = postAdminLoginParser(await c.req.json());
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            return buildContextJson(c, await postAdminLoginService(c, parserResult.data!));
        } catch (error) {
            return buildErrorContextJson(
                c,
                'Post administrator login failed',
                error,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    };

    public static logout = async (c: Context) => buildContextJson(c, await postAdminLogoutService(c));

    public static current = async (c: Context) => buildContextJson(c, await getCurrentPostAdminService(c));

    public static bindCurrentUser = async (c: Context) => buildContextJson(c, await bindCurrentUserService(c));

    public static unbindCurrentUser = async (c: Context) => buildContextJson(c, await unbindCurrentUserService(c));
}

export default PostAdminController;
