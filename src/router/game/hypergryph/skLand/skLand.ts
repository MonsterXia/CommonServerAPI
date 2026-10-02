import { sklandRoutes } from '@/openapi/routes';
import { createNewRouter } from '@/router/routerfactory';
import skLandController from '@/controller/game/hypergryph/skLandController';

const skLandRouter = createNewRouter();

skLandRouter.openapi(sklandRoutes.cred, skLandController.getSkLandCred);
skLandRouter.openapi(sklandRoutes.validate, skLandController.validateSkLandCred);
skLandRouter.openapi(sklandRoutes.accounts, skLandController.getSKLandGameAccounts);
skLandRouter.openapi(sklandRoutes.checkIn, skLandController.checkIn);

export default skLandRouter;