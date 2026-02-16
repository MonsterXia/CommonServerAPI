import { Hono } from 'hono';
import gameRouter from './game/game';
const router = new Hono();

router.route('/game', gameRouter);

export default router;