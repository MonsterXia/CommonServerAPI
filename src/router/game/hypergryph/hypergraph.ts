import { Hono } from 'hono';
import endfieldRouter from './endfield/endfield';
import skLandRouter from './skLand/skLand';
import hypergryphController from '@/controller/game/hypergryph/hypergryphController';

const hypergryphRouter = new Hono();

hypergryphRouter.route('/endfield', endfieldRouter);
hypergryphRouter.route('/skLand', skLandRouter);

hypergryphRouter.post('/sms', hypergryphController.getPhoneCode);
hypergryphRouter.post('/token/sms', hypergryphController.getTokenByPhoneCode);
hypergryphRouter.post('/token/password', hypergryphController.getTokenByPassword);
hypergryphRouter.get('/token/validate', hypergryphController.tokenValidate);
hypergryphRouter.post('/token/oauth', hypergryphController.grantOAuthToken);

export default hypergryphRouter;
