import { createNewRouter } from '@/router/routerfactory';
import postAdminRouter from './postAdmin';

const postRouter = createNewRouter();

postRouter.route('/admin', postAdminRouter);

export default postRouter;
