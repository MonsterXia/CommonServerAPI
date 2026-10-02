import { userRoutes } from '@/openapi/routes';
import { createNewRouter } from '@/router/routerfactory';
import userController from '@/controller/user/userController';
import { authMiddleware } from '@/middleware/auth';
import { sendPasswordResetCode, resetPassword } from '@/service/user/passwordResetService';
import { buildContextJson, buildErrorContextJson } from '@/util/hono';
const userRouter = createNewRouter();
for (const [route, service] of [[userRoutes.resetCode, sendPasswordResetCode], [userRoutes.reset, resetPassword]] as const) {
    userRouter.openapi(route, async c => {
        let input: unknown;
        try { input = await c.req.json(); } catch { return buildErrorContextJson(c, 'Invalid JSON', null, 400); }
        try { return buildContextJson(c, await service(c, input)); }
        catch { return buildErrorContextJson(c, 'Password reset unavailable', null, 503); }
    });
}

userRouter.openapi(userRoutes.exists, userController.checkUsernameExist);
userRouter.openapi(userRoutes.emailCode, userController.sendEmailVerificationCode);
userRouter.openapi(userRoutes.register, userController.userRegister);
userRouter.openapi(userRoutes.login, userController.userLogin);
userRouter.openapi(userRoutes.logout, userController.userLogout);
userRouter.openapi({ ...userRoutes.current, middleware: [authMiddleware] }, userController.getCurrentUser);

export default userRouter;