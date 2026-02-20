import superAdminController from '@/controller/user/superAdminController';
import { bearerAuth } from 'hono/bearer-auth';
import { createNewRouter } from '@/router/routerfactory';

const superAdminRouter = createNewRouter();

superAdminRouter.use('*', async (c, next) => {
    const auth = bearerAuth({token: c.env.API_KEY})
   return auth(c, next);
});
superAdminRouter.post('/setAdmin', superAdminController.setUserAsAdmin);

export default superAdminRouter;