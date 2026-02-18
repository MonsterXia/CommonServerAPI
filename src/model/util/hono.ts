import { ContentfulStatusCode } from "hono/utils/http-status";

export interface StandardServerResult<T> {
    success: boolean;
    message: string;
    data?: T;
    error?: any;
    httpStatus: ContentfulStatusCode;
}