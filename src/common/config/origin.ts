import { Context } from "hono";

const permittedOrigins = '246801357.xyz'

export const CORSAllowOrigins = (origin:string, c:Context) => {
    return origin.endsWith(permittedOrigins) ? origin : permittedOrigins;
}

export const allowOrigins = [
    '*.246801357.xyz',
];