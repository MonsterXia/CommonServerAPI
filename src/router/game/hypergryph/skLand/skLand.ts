import { Hono } from "hono";
import skLandController from "../../../../controller/game/hypergryph/skLandController";

const skLandRouter = new Hono();

skLandRouter.post('/login/password', skLandController.hypergryphPasswordLogin);


skLandRouter.get('/checkIn', async (c) => {
    return c.json({ message: "SK Land Check-In endpoint" });
});

skLandRouter.post('/checkIn', skLandController.checkIn);

export default skLandRouter;