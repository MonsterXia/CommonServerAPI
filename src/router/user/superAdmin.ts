import superAdminController from '@/controller/user/superAdminController';
import { bearerAuth } from 'hono/bearer-auth';
import { createNewRouter } from '@/router/routerfactory';
import type { Bindings } from '@/index';

const superAdminRouter = createNewRouter();

superAdminRouter.use('*', async (c, next) => {
    const auth = bearerAuth<{ Bindings: Bindings }>({token: c.env.API_KEY})
   return auth(c, next);
});
superAdminRouter.post('/setAdmin', superAdminController.setUserAsAdmin);

export default superAdminRouter;
