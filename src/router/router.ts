import { healthRoute } from '@/openapi/routes';
import { installDocumentation } from '@/openapi/document';
import { createNewRouter } from '@/router/routerfactory';
import gameRouter from './game/game';
import postRouter from './post/post';
import userRouter from './user/user';
const router = createNewRouter();

router.route('/user', userRouter);
router.route('/game', gameRouter);
router.route('/post', postRouter);

router.openapi(healthRoute, c => c.json({ message: 'Common Server API is running.' }, 200));
installDocumentation(router);

export default router;
