import type { Context } from 'hono';
import type { StandardServerResult } from '@/model/util/hono';
import { buildContextJson, buildErrorContextJson } from '@/util/hono';

type ServiceResult = StandardServerResult<unknown>;
type Service = (c: Context) => ServiceResult | Promise<ServiceResult>;

/** Keep unexpected exception details out of public API responses. */
export function createServiceHandler(service: Service, failureMessage: string) {
    return async (c: Context) => {
        try {
            return buildContextJson(c, await service(c));
        } catch {
            console.error(failureMessage);
            return buildErrorContextJson(c, failureMessage, null, 500);
        }
    };
}

/** Parsing failures are client errors; parser/service exceptions remain server errors. */
export function createValidatedHandler<T>(
    parser: (input: Record<string, unknown>) => StandardServerResult<T>,
    service: (c: Context, data: NonNullable<T>) => ServiceResult | Promise<ServiceResult>,
    failureMessage: string,
    source: 'json' | 'query' = 'json',
) {
    return createServiceHandler(async c => {
        let input: unknown;
        if (source === 'query') {
            input = c.req.query();
        } else {
            try {
                input = await c.req.json();
            } catch {
                return { success: false, message: 'Invalid JSON', error: 'A JSON object is required', httpStatus: 400 };
            }
        }
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            return { success: false, message: 'Invalid request body', error: 'A JSON object is required', httpStatus: 400 };
        }
        const parsed = parser(input as Record<string, unknown>);
        if (!parsed.success) return parsed;
        if (parsed.data == null) throw new Error('Successful parser returned no data');
        return service(c, parsed.data);
    }, failureMessage);
}
