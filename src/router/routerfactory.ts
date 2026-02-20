import { Hono } from 'hono';
import { Bindings } from '@/index';

export const createNewRouter = () => {
    return new Hono<{ Bindings: Bindings }>();
}