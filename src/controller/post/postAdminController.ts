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
import { createServiceHandler, createValidatedHandler } from '@/controller/handlers';

class PostAdminController {
    public static checkEmailAvailability = createValidatedHandler(
        postAdminEmailParser,
        (_c, data) => checkPostAdminEmailAvailabilityService(data.email),
        'Check Post administrator email failed',
    );

    public static initializeRegistration = createValidatedHandler(
        postAdminRegisterParser,
        initializePostAdminRegistrationService,
        'Initialize Post administrator registration failed',
    );

    public static validateRegistration = createValidatedHandler(
        postAdminValidationParser,
        (_c, data) => validatePostAdminRegistrationService(data),
        'Validate Post administrator registration failed',
    );

    public static login = createValidatedHandler(
        postAdminLoginParser,
        postAdminLoginService,
        'Post administrator login failed',
    );

    public static logout = createServiceHandler(postAdminLogoutService, 'Post administrator logout failed');
    public static current = createServiceHandler(getCurrentPostAdminService, 'Get current Post administrator failed');
    public static bindCurrentUser = createServiceHandler(bindCurrentUserService, 'Bind current user failed');
    public static unbindCurrentUser = createServiceHandler(unbindCurrentUserService, 'Unbind current user failed');
}

export default PostAdminController;
