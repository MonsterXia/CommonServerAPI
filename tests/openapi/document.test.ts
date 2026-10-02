import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import router from '@/router/router';
import { documentConfig } from '@/openapi/document';

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head']);
const document = router.getOpenAPIDocument(documentConfig);
const operations = Object.entries(document.paths).flatMap(([path, item]) =>
    Object.entries(item ?? {})
        .filter(([method]) => methods.has(method))
        .map(([method, operation]) => ({ path, method, operation })),
);

describe('published OpenAPI contract', () => {
    it('is a valid OpenAPI 3 document with resolvable references', async () => {
        await expect(
            SwaggerParser.validate(JSON.parse(JSON.stringify(document)), {
                resolve: { external: false },
            }),
        ).resolves.toMatchObject({ openapi: '3.0.3' });
    });

    it('covers every mounted business route exactly once, including health', () => {
        const mounted = [
            ...new Set(
                router.routes
                    .filter(
                        (route) =>
                            methods.has(route.method.toLowerCase()) &&
                            !['/docs', '/openapi.json'].includes(route.path),
                    )
                    .map(
                        (route) =>
                            `${route.method.toLowerCase()} ${route.path.replace(/:([^/]+)/g, '{$1}')}`,
                    ),
            ),
        ].sort();
        const documented = operations.map(({ method, path }) => `${method} ${path}`).sort();
        expect(documented).toEqual(mounted);
        expect(operations).toHaveLength(32);
        expect(new Set(operations.map(({ operation }) => operation.operationId)).size).toBe(32);
        for (const { operation } of operations) {
            expect(operation.summary).toBeTruthy();
            expect(operation.tags).toHaveLength(1);
            expect(operation.responses).toBeDefined();
        }
        expect(JSON.stringify(document.paths)).not.toContain('setAdmin');
    });

    it('documents cookie authentication and requires both identities for Post binding', () => {
        expect(document.components?.securitySchemes?.UserCookie).toMatchObject({
            type: 'apiKey',
            in: 'cookie',
            name: 'auth_token',
        });
        expect(document.paths['/user/current']?.get?.security).toEqual([{ UserCookie: [] }]);
        expect(document.paths['/post/admin/current']?.get?.security).toEqual([
            { PostAdminCookie: [] },
        ]);
        for (const method of ['post', 'delete'] as const) {
            expect(document.paths['/post/admin/binding']?.[method]?.security).toEqual([
                { UserCookie: [], PostAdminCookie: [] },
            ]);
        }
        expect(document.paths['/user/login']?.post?.security).toEqual([]);
        for (const { path, operation } of operations.filter(({ path }) =>
            path.startsWith('/game/hypergryph/account'),
        )) {
            expect(operation.security, path).toEqual([{ UserCookie: [] }]);
            expect(operation.responses, path).toHaveProperty('401');
        }
    });

    it('retains creation, partial-success and expired-registration status codes', () => {
        expect(document.paths['/user/register']?.post?.responses).toHaveProperty('201');
        expect(document.paths['/post/admin/register/validate']?.post?.responses).toHaveProperty(
            '410',
        );
        expect(document.paths['/post/admin/login']?.post?.responses).toHaveProperty('401');
        for (const path of [
            '/game/hypergryph/account/check-in',
            '/game/hypergryph/skLand/checkIn',
        ]) {
            expect(document.paths[path]?.post?.responses).toHaveProperty('200');
            expect(document.paths[path]?.post?.responses).toHaveProperty('207');
        }
    });

    it('serves the spec and pinned Swagger UI without storing auth or sending the spec to a validator', async () => {
        const spec = await router.request('/openapi.json');
        expect(spec.status).toBe(200);
        expect(await spec.json()).toEqual(JSON.parse(JSON.stringify(document)));
        const ui = await router.request('/docs');
        expect(ui.status).toBe(200);
        expect(ui.headers.get('Content-Type')).toContain('text/html');
        const html = await ui.text();
        expect(html).toContain('/openapi.json');
        expect(html).toContain('swagger-ui-dist@5.33.1');
        expect(html).toMatch(/persistAuthorization["']?\s*:\s*false/);
        expect(html).toMatch(/withCredentials["']?\s*:\s*true/);
        expect(html).toMatch(/validatorUrl["']?\s*:\s*["']["']/);
        expect(html).toMatch(/queryConfigEnabled["']?\s*:\s*false/);
    });
});
