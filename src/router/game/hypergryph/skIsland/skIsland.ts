import { Hono } from "hono";

const skIslandRouter = new Hono();

skIslandRouter.get('/checkIn', async (c) => {
    return c.json({ message: "SK Island Check-In endpoint" });
});

export default skIslandRouter;