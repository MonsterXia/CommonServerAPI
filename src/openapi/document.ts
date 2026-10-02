import { swaggerUI } from '@hono/swagger-ui';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Bindings } from '@/index';

export const documentConfig = {
    openapi: '3.0.3',
    info: {
        title: 'CommonServerAPI',
        version: '1.0.0',
        description:
            'User accounts, linked Hypergryph roles, Skland snapshots and manual check-in. Business responses use {message,data,httpStatus}; errors use {message,error,httpStatus}. Login sets HttpOnly cookies. In Swagger UI, sign in using the login operation; the browser sends same-origin cookies automatically. Do not paste production secrets into shared examples. Unmounted internal routers are not published here.',
    },
    servers: [{ url: '/', description: 'Current API origin (local or production)' }],
    tags: [
        { name: 'System', description: 'Service health' },
        { name: 'User', description: 'Registration, sessions and password reset' },
        {
            name: 'Linked game accounts',
            description: 'Cookie-authenticated game features used by EasonWeb',
        },
        {
            name: 'Post administrators',
            description: 'Existing server API; hidden in the current web client',
        },
        {
            name: 'Hypergryph protocol',
            description: 'Legacy upstream credential exchange endpoints',
        },
        { name: 'Skland protocol', description: 'Legacy upstream credentials and check-in' },
    ],
};

export function installDocumentation(app: OpenAPIHono<{ Bindings: Bindings }>) {
    app.openAPIRegistry.registerComponent('securitySchemes', 'UserCookie', {
        type: 'apiKey',
        in: 'cookie',
        name: 'auth_token',
        description: 'HttpOnly cookie issued by /user/login or /user/register.',
    });
    app.openAPIRegistry.registerComponent('securitySchemes', 'PostAdminCookie', {
        type: 'apiKey',
        in: 'cookie',
        name: 'post_auth_token',
        description:
            'Independent HttpOnly cookie issued by /post/admin/login. Binding requires both cookies (AND).',
    });
    app.doc('/openapi.json', documentConfig);
    app.get(
        '/docs',
        swaggerUI({
            url: '/openapi.json',
            title: 'CommonServerAPI · Swagger UI',
            version: '5.33.1',
            persistAuthorization: false,
            withCredentials: true,
            validatorUrl: '',
            queryConfigEnabled: false,
            tryItOutEnabled: false,
            displayRequestDuration: true,
            filter: true,
            docExpansion: 'none',
        }),
    );
}
