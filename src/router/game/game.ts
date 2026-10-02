import { createNewRouter } from '@/router/routerfactory';
import hypergryphRouter from './hypergryph/hypergraph';

const gameRouter = createNewRouter();

gameRouter.route('/hypergryph', hypergryphRouter);

export default gameRouter;