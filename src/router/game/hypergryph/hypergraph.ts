import { hypergryphRoutes } from '@/openapi/routes';
import { createNewRouter } from '@/router/routerfactory';
import endfieldRouter from './endfield/endfield';
import skLandRouter from './skLand/skLand';
import hypergryphController from '@/controller/game/hypergryph/hypergryphController';

import accountRouter from './account';

const hypergryphRouter = createNewRouter();

hypergryphRouter.route('/account', accountRouter);
hypergryphRouter.route('/endfield', endfieldRouter);
hypergryphRouter.route('/skLand', skLandRouter);

hypergryphRouter.openapi(hypergryphRoutes.sms, hypergryphController.getPhoneCode);
hypergryphRouter.openapi(hypergryphRoutes.smsToken, hypergryphController.getTokenByPhoneCode);
hypergryphRouter.openapi(hypergryphRoutes.passwordToken, hypergryphController.getTokenByPassword);
hypergryphRouter.openapi(hypergryphRoutes.validate, hypergryphController.tokenValidate);
hypergryphRouter.openapi(hypergryphRoutes.oauth, hypergryphController.grantOAuthToken);

export default hypergryphRouter;
