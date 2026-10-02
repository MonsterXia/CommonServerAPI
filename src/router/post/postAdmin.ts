import { postRoutes } from '@/openapi/routes';
import PostAdminController from '@/controller/post/postAdminController';
import { authMiddleware, postAdminAuthMiddleware } from '@/middleware/auth';
import { createNewRouter } from '@/router/routerfactory';

const postAdminRouter = createNewRouter();

postAdminRouter.openapi(postRoutes.email, PostAdminController.checkEmailAvailability);
postAdminRouter.openapi(postRoutes.init, PostAdminController.initializeRegistration);
postAdminRouter.openapi(postRoutes.validate, PostAdminController.validateRegistration);
postAdminRouter.openapi(postRoutes.login, PostAdminController.login);
postAdminRouter.openapi(postRoutes.logout, PostAdminController.logout);
postAdminRouter.openapi({ ...postRoutes.current, middleware: [postAdminAuthMiddleware] }, PostAdminController.current);
postAdminRouter.openapi({ ...postRoutes.bind, middleware: [authMiddleware, postAdminAuthMiddleware] }, PostAdminController.bindCurrentUser);
postAdminRouter.openapi({ ...postRoutes.unbind, middleware: [authMiddleware, postAdminAuthMiddleware] }, PostAdminController.unbindCurrentUser);

export default postAdminRouter;
