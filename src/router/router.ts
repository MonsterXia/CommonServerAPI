import { Hono } from 'hono';
import gameRouter from './game/game';
import userRouter from './user/user';
const router = new Hono();

router.route('/user', userRouter);
router.route('/game', gameRouter);

export default router;