import type { MiddlewareHandler } from 'hono';
import { buildErrorContextJson } from '@/util/hono';

const MAX_BODY_BYTES = 64 * 1024;

// Count actual bytes as well as Content-Length, including streamed requests.
// Installed once on the root router, before authentication and JSON parsing.
export const requestBodyLimit: MiddlewareHandler = async (c, next) => {
    const body = c.req.raw.body;
    if (!body) return next();
    const reject = () => buildErrorContextJson(c, 'Request body exceeds 64 KiB', null, 413);
    if (Number(c.req.header('content-length')) > MAX_BODY_BYTES) return reject();
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BODY_BYTES) {
                void reader.cancel().catch(() => {});
                return reject();
            }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    c.req.raw = new Request(c.req.raw, { body: bytes });
    await next();
};
