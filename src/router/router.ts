import { Hono } from 'hono';
import gameRouter from './game/game';
import postRouter from './post/post';
import userRouter from './user/user';
const router = new Hono();

router.route('/user', userRouter);
router.route('/game', gameRouter);
router.route('/post', postRouter);

export default router;
