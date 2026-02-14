import { Hono } from "hono";
import endfieldRouter from "./endfield/endfield";
import skIslandRouter from "./skIsland/skIsland";

const hypergryphRouter = new Hono();

hypergryphRouter.route('/endfield', endfieldRouter);
hypergryphRouter.route('/skIsland', skIslandRouter);

export default hypergryphRouter;
