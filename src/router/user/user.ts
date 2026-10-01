import { Hono } from 'hono';
import userController from '@/controller/user/userController';
import { authMiddleware } from '@/middleware/auth';
import { sendPasswordResetCode, resetPassword } from '@/service/user/passwordResetService';
import { buildContextJson, buildErrorContextJson } from '@/util/hono';
const userRouter = new Hono();
for (const [path, service] of [['/password/reset/code', sendPasswordResetCode], ['/password/reset', resetPassword]] as const) {
    userRouter.post(path, async c => {
        let input: unknown;
        try { input = await c.req.json(); } catch { return buildErrorContextJson(c, 'Invalid JSON', null, 400); }
        try { return buildContextJson(c, await service(c, input)); }
        catch { return buildErrorContextJson(c, 'Password reset unavailable', null, 503); }
    });
}

userRouter.get('/username/:username/exist', userController.checkUsernameExist);
userRouter.post('/email/verify', userController.sendEmailVerificationCode);
userRouter.post('/register', userController.userRegister);
userRouter.post('/login', userController.userLogin);
userRouter.post('/logout', userController.userLogout);
userRouter.get('/current', authMiddleware, userController.getCurrentUser);

export default userRouter;