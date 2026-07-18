import PostAdminController from '@/controller/post/postAdminController';
import { authMiddleware, postAdminAuthMiddleware } from '@/middleware/auth';
import { createNewRouter } from '@/router/routerfactory';

const postAdminRouter = createNewRouter();

postAdminRouter.post('/register/valid-email', PostAdminController.checkEmailAvailability);
postAdminRouter.post('/register/init', PostAdminController.initializeRegistration);
postAdminRouter.post('/register/validate', PostAdminController.validateRegistration);
postAdminRouter.post('/login', PostAdminController.login);
postAdminRouter.post('/logout', PostAdminController.logout);
postAdminRouter.get('/current', postAdminAuthMiddleware, PostAdminController.current);
postAdminRouter.post(
    '/binding',
    authMiddleware,
    postAdminAuthMiddleware,
    PostAdminController.bindCurrentUser
);
postAdminRouter.delete(
    '/binding',
    authMiddleware,
    postAdminAuthMiddleware,
    PostAdminController.unbindCurrentUser
);

export default postAdminRouter;
