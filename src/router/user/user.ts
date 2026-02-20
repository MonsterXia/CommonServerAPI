import { Hono } from 'hono';
import userController from '@/controller/user/userController';
import { authMiddleware } from '@/middleware/auth';
const userRouter = new Hono();

userRouter.get('/username/:username/exist', userController.checkUsernameExist);
userRouter.post('/register', userController.userRegister);
userRouter.post('/login', userController.userLogin);
userRouter.post('/logout', userController.userLogout);
userRouter.get('/current', authMiddleware, userController.getCurrentUser);

export default userRouter;