import { createRoute, z, type RouteConfig } from '@hono/zod-openapi';
import * as s from './schemas';

const userAuth = [{ UserCookie: [] }];
const postAuth = [{ PostAdminCookie: [] }];
const bothAuth = [{ UserCookie: [], PostAdminCookie: [] }];
const json = (schema: z.ZodType) => ({ 'application/json': { schema } });
const body = (schema: z.ZodType) => ({ body: { required: true, content: json(schema) } });
const object = (shape: z.ZodRawShape) => z.object(shape).passthrough();

function operation(options: {
    method: RouteConfig['method'];
    path: string;
    operationId: string;
    summary: string;
    tag: string;
    request?: RouteConfig['request'];
    data: z.ZodType;
    statuses?: number[];
    errors?: number[];
    security?: RouteConfig['security'];
    description?: string;
    cookie?: boolean;
}) {
    const responses: RouteConfig['responses'] = {};
    for (const status of options.statuses ?? [200]) {
        responses[status] = {
            description:
                status === 207
                    ? 'Partial check-in result, including per-account failures.'
                    : 'Successful response',
            content: json(s.envelope(options.data, status)),
            ...(options.cookie
                ? {
                      headers: {
                          'Set-Cookie': {
                              description:
                                  'HttpOnly session cookie, set or cleared by this operation.',
                              schema: { type: 'string' as const },
                          },
                      },
                  }
                : {}),
        };
    }
    // Global CSRF checks can reject unsafe cross-origin requests before the handler.
    for (const status of new Set([
        400,
        403,
        500,
        ...(options.request?.body ? [415] : []),
        ...(options.errors ?? []),
        ...(options.security?.length ? [401] : []),
    ])) {
        responses[status] = {
            description:
                (
                    {
                        400: 'Invalid request or business validation failure',
                        401: 'Missing, expired or invalid session',
                        403: 'Forbidden or invalid credentials',
                        404: 'Account not found',
                        409: 'Account conflict or missing binding',
                        410: 'Registration verification expired; restart registration',
                        415: 'JSON content type required',
                        429: 'Verification request throttled',
                        500: 'Internal or legacy upstream error',
                        502: 'Upstream authentication or service failed',
                        503: 'Service unavailable',
                    } as Record<number, string>
                )[status] ?? 'Error',
            content: json(s.errorSchema),
        };
    }
    return createRoute({
        method: options.method,
        path: options.path,
        operationId: options.operationId,
        summary: options.summary,
        tags: [options.tag],
        request: options.request,
        responses,
        security: options.security ?? [],
        description: options.description,
    });
}
const user = { tag: 'User', data: z.null() };
export const userRoutes = {
    resetCode: operation({
        ...user,
        method: 'post',
        path: '/password/reset/code',
        operationId: 'requestPasswordResetCode',
        summary: 'Request a password-reset email',
        request: body(object({ username: s.text.max(30), email: s.email })),
        errors: [503],
        description:
            'Uses the same success response for unknown accounts and existing unexpired challenges.',
    }),
    reset: operation({
        ...user,
        method: 'post',
        path: '/password/reset',
        operationId: 'resetPassword',
        summary: 'Reset password and invalidate old sessions',
        request: body(
            object({
                username: s.text.max(30),
                email: s.email,
                code: s.code,
                password: s.newPassword,
            }),
        ),
        errors: [503],
        cookie: true,
    }),
    exists: operation({
        ...user,
        method: 'get',
        path: '/username/{username}/exist',
        operationId: 'usernameExists',
        summary: 'Check username availability',
        request: { params: z.object({ username: s.text }) },
        data: z.boolean(),
        description: 'data=true means the username already exists.',
    }),
    emailCode: operation({
        ...user,
        method: 'post',
        path: '/email/verify',
        operationId: 'requestEmailVerification',
        summary: 'Request an email verification code',
        request: body(object({ email: s.email, type: z.enum(['register', 'reset_password']) })),
        errors: [409, 429],
        description:
            'reset_password is a legacy verification type. Use /user/password/reset/code for the current reset flow.',
    }),
    register: operation({
        ...user,
        method: 'post',
        path: '/register',
        operationId: 'registerUser',
        summary: 'Register and sign in',
        request: body(
            object({
                username: s.text.min(3).max(30),
                password: s.newPassword,
                email: s.email,
                registrationCode: s.text,
            }),
        ),
        data: s.registrationResult,
        statuses: [201],
        errors: [409],
        cookie: true,
    }),
    login: operation({
        ...user,
        method: 'post',
        path: '/login',
        operationId: 'loginUser',
        summary: 'Sign in with username and password',
        request: body(object({ username: s.text, password: s.password })),
        data: z.object({ token: z.string() }),
        cookie: true,
    }),
    logout: operation({
        ...user,
        method: 'post',
        path: '/logout',
        operationId: 'logoutUser',
        summary: 'Clear the user session cookie',
        cookie: true,
    }),
    current: operation({
        ...user,
        method: 'get',
        path: '/current',
        operationId: 'getCurrentUser',
        summary: 'Read public user and linked-account details',
        data: s.currentUser,
        security: userAuth,
        errors: [404],
    }),
};
const post = {
    tag: 'Post administrators',
    data: z.null(),
    description: 'Existing backend capability; currently hidden in EasonWeb.',
};
export const postRoutes = {
    email: operation({
        ...post,
        method: 'post',
        path: '/register/valid-email',
        operationId: 'postAdminEmailAvailable',
        summary: 'Check registration email availability',
        request: body(object({ email: s.email })),
        data: z.boolean(),
    }),
    init: operation({
        ...post,
        method: 'post',
        path: '/register/init',
        operationId: 'initializePostAdminRegistration',
        summary: 'Send Post administrator registration email',
        request: body(object({ email: s.email, password: s.newPassword })),
        errors: [409],
    }),
    validate: operation({
        ...post,
        method: 'post',
        path: '/register/validate',
        operationId: 'validatePostAdminRegistration',
        summary: 'Complete Post administrator registration',
        request: body(object({ email: s.email, token: s.secret })),
        data: s.publicPostAdmin,
        statuses: [201],
        errors: [409, 410],
    }),
    login: operation({
        ...post,
        method: 'post',
        path: '/login',
        operationId: 'loginPostAdmin',
        summary: 'Sign in as a Post administrator',
        request: body(object({ email: s.email, password: s.password })),
        data: s.publicPostAdmin,
        errors: [401],
        cookie: true,
    }),
    logout: operation({
        ...post,
        method: 'post',
        path: '/logout',
        operationId: 'logoutPostAdmin',
        summary: 'Clear the Post administrator session',
        cookie: true,
    }),
    current: operation({
        ...post,
        method: 'get',
        path: '/current',
        operationId: 'getCurrentPostAdmin',
        summary: 'Read the current Post administrator',
        data: s.publicPostAdmin,
        security: postAuth,
        errors: [404],
    }),
    bind: operation({
        ...post,
        method: 'post',
        path: '/binding',
        operationId: 'bindPostAdmin',
        summary: 'Link the signed-in user and Post administrator',
        data: s.publicPostAdmin,
        security: bothAuth,
        errors: [404, 409],
    }),
    unbind: operation({
        ...post,
        method: 'delete',
        path: '/binding',
        operationId: 'unbindPostAdmin',
        summary: 'Unlink the signed-in user and Post administrator',
        data: s.publicPostAdmin,
        security: bothAuth,
        errors: [404, 409],
    }),
};
const account = { tag: 'Linked game accounts', security: userAuth, errors: [404, 409, 502, 503] };
export const accountRoutes = {
    sms: operation({
        ...account,
        method: 'post',
        path: '/sms',
        operationId: 'sendLinkedHypergryphSms',
        summary: 'Send a Hypergryph SMS code',
        request: body(object({ phone: s.phone })),
        data: z.string(),
    }),
    bind: operation({
        ...account,
        method: 'post',
        path: '/',
        operationId: 'bindHypergryph',
        summary: 'Link an account or refresh its login',
        request: body(s.bindHypergryphInput),
        data: s.publicHypergryphAccount,
    }),
    unbind: operation({
        ...account,
        method: 'delete',
        path: '/',
        operationId: 'unbindHypergryph',
        summary: 'Unlink the current Hypergryph account',
        data: z.null(),
    }),
    games: operation({
        ...account,
        method: 'get',
        path: '/games',
        operationId: 'getLinkedGameAccounts',
        summary: 'List linked game roles',
        data: z.array(s.gameAccount),
    }),
    overview: operation({
        ...account,
        method: 'get',
        path: '/overview',
        operationId: 'getGameOverview',
        summary: 'Read a linked role’s game snapshot',
        request: { query: s.gameOverviewQuery },
        data: s.gameOverview,
        description:
            'All three role identifiers must belong to the current user. Response is private, no-store. Images are frontend assets and are not fetched here.',
    }),
    checkIn: operation({
        ...account,
        method: 'post',
        path: '/check-in',
        operationId: 'checkInLinkedGames',
        summary: 'Manually check in linked roles',
        data: s.checkInResult,
        statuses: [200, 207],
    }),
};
const hypergryph = {
    tag: 'Hypergryph protocol',
    data: z.string(),
    description:
        'Legacy low-level protocol endpoint. Prefer the linked-account flow for browser clients.',
};
export const hypergryphRoutes = {
    sms: operation({
        ...hypergryph,
        method: 'post',
        path: '/sms',
        operationId: 'sendHypergryphSms',
        summary: 'Send an SMS code through Hypergryph',
        request: body(object({ phone: s.text })),
    }),
    smsToken: operation({
        ...hypergryph,
        method: 'post',
        path: '/token/sms',
        operationId: 'getHypergryphTokenBySms',
        summary: 'Exchange an SMS code for a token',
        request: body(object({ phone: s.text, code: s.secret })),
    }),
    passwordToken: operation({
        ...hypergryph,
        method: 'post',
        path: '/token/password',
        operationId: 'getHypergryphTokenByPassword',
        summary: 'Exchange credentials for a token',
        request: body(object({ phone: s.text, password: s.password })),
    }),
    validate: operation({
        ...hypergryph,
        method: 'get',
        path: '/token/validate',
        operationId: 'validateHypergryphToken',
        summary: 'Validate a Hypergryph token',
        request: { query: z.object({ token: s.secret }) },
        data: s.hypergryphIdentity,
        description:
            'Legacy query-string credential contract retained for compatibility. Avoid sharing request URLs.',
    }),
    oauth: operation({
        ...hypergryph,
        method: 'post',
        path: '/token/oauth',
        operationId: 'getHypergryphOAuthCode',
        summary: 'Exchange a Hypergryph token for an OAuth code',
        request: body(object({ token: s.secret })),
    }),
};
const skland = {
    tag: 'Skland protocol',
    description:
        'Legacy low-level protocol endpoint; clients supply their own upstream credentials.',
};
export const sklandRoutes = {
    cred: operation({
        ...skland,
        method: 'post',
        path: '/cred',
        operationId: 'getSklandCredential',
        summary: 'Exchange an OAuth code for Skland credentials',
        request: body(object({ code: s.secret })),
        data: s.sklandCred,
    }),
    validate: operation({
        ...skland,
        method: 'get',
        path: '/cred/validate',
        operationId: 'validateSklandCredential',
        summary: 'Validate Skland credentials',
        request: { query: z.object({ cred: s.secret }) },
        data: s.sklandIdentity,
    }),
    accounts: operation({
        ...skland,
        method: 'post',
        path: '/accounts',
        operationId: 'getSklandAccounts',
        summary: 'List roles using Skland credentials',
        request: body(object({ cred: s.secret, token: s.secret })),
        data: z.array(s.gameAccount),
    }),
    checkIn: operation({
        ...skland,
        method: 'post',
        path: '/checkIn',
        operationId: 'checkInSklandByPassword',
        summary: 'Sign in and check in game roles',
        request: body(object({ phone: s.text, password: s.password })),
        data: s.checkInResult,
        statuses: [200, 207],
    }),
};
export const superAdminRoute = operation({
    tag: 'Super administrator',
    method: 'post',
    path: '/setAdmin',
    operationId: 'setUserAsAdmin',
    summary: 'Set a user as administrator',
    request: body(object({ username: s.text })),
    data: z.null(),
    security: [{ AdminBearer: [] }],
    errors: [404],
    description: 'Router is not mounted in the production application.',
});
export const healthRoute = createRoute({
    method: 'get',
    path: '/',
    operationId: 'healthCheck',
    tags: ['System'],
    summary: 'Check service availability',
    security: [],
    responses: {
        200: {
            description: 'Service is running',
            content: json(z.object({ message: z.string() })),
        },
    },
});
