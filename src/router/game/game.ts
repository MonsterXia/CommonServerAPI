import { Hono } from 'hono';
import hypergryphRouter from './hypergryph/hypergraph';

const gameRouter = new Hono();

gameRouter.route('/hypergryph', hypergryphRouter);

export default gameRouter;