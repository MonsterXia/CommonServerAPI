import { Hono } from 'hono';
import skLandController from '../../../../controller/game/hypergryph/skLandController';

const skLandRouter = new Hono();

skLandRouter.post('/cred', skLandController.getSkLandCred);
skLandRouter.get('/cred/validate', skLandController.validateSkLandCred);
skLandRouter.post('/accounts', skLandController.getSKLandGameAccounts);
skLandRouter.post('/checkIn', skLandController.checkIn);

export default skLandRouter;