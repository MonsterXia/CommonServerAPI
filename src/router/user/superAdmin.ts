import { superAdminRoute } from '@/openapi/routes';
import superAdminController from '@/controller/user/superAdminController';
import { bearerAuth } from 'hono/bearer-auth';
import { createNewRouter } from '@/router/routerfactory';
import type { Bindings } from '@/index';

const superAdminRouter = createNewRouter();
superAdminRouter.openAPIRegistry.registerComponent('securitySchemes', 'AdminBearer', {
    type: 'http',
    scheme: 'bearer',
    description:
        'Server administrator API key. The super-admin router is not mounted in this application.',
});

superAdminRouter.use('*', async (c, next) => {
    const auth = bearerAuth<{ Bindings: Bindings }>({ token: c.env.API_KEY });
    return auth(c, next);
});
superAdminRouter.openapi(superAdminRoute, superAdminController.setUserAsAdmin);

export default superAdminRouter;
