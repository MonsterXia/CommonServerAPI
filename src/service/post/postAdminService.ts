import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { Context } from 'hono';
import { bcryptSaltRounds } from '@/common/config/bcryptConfig';
import PostAdminVerificationTemplate from '@/common/Email/template/postAdminVerificationTemplate';
import { getEmailManager } from '@/lib/emailManager';
import { getKV } from '@/lib/KV';
import {
    clearPostAdminAuthCookie,
    generatePostAdminToken,
    setPostAdminAuthCookie,
} from '@/lib/postAdminJwt';
import { getPrismaClient } from '@/lib/prisma';
import {
    PostAdminLoginRequestPayload,
    PostAdminRegisterRequestPayload,
    PostAdminValidateRequestPayload,
    PublicPostAdmin,
} from '@/model/post/postAdmin';
import { StandardServerResult } from '@/model/util/hono';
import { buildStandardServerResponse, bussinessStatusCode } from '@/util/hono';

const REGISTRATION_TTL_SECONDS = 30 * 60;
const REGISTRATION_KEY_PREFIX = 'post-admin-registration:';

interface PendingPostAdminRegistration {
    passwordHash: string;
    tokenHash: string;
}

interface PostAdminRecord extends PublicPostAdmin {
    password: string;
}

export type PostAdminBindingDecision =
    | 'bind'
    | 'already-bound'
    | 'post-admin-bound-elsewhere'
    | 'user-bound-elsewhere';

export const getPostAdminBindingDecision = (input: {
    userId: number;
    userPostAdminId: number | null;
    postAdminId: number;
    postAdminUserId: number | null;
}): PostAdminBindingDecision => {
    if (input.postAdminUserId !== null && input.postAdminUserId !== input.userId) {
        return 'post-admin-bound-elsewhere';
    }
    if (input.userPostAdminId !== null && input.userPostAdminId !== input.postAdminId) {
        return 'user-bound-elsewhere';
    }
    if (input.postAdminUserId === input.userId) {
        return 'already-bound';
    }
    return 'bind';
};

const registrationKey = (email: string) => `${REGISTRATION_KEY_PREFIX}${email}`;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const sha256 = async (value: string): Promise<string> => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
};

const constantTimeEquals = (left: string, right: string): boolean => {
    if (left.length !== right.length) {
        return false;
    }

    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
};

const createVerificationToken = (): string => crypto.randomUUID().replaceAll('-', '');

export const toPublicPostAdmin = (postAdmin: PostAdminRecord): PublicPostAdmin => {
    const { password: _, ...publicPostAdmin } = postAdmin;
    return publicPostAdmin;
};

export const postAdminEmailParser = (
    data: unknown
): StandardServerResult<{ email: string } | null> => {
    if (!data || typeof data !== 'object' || !('email' in data)) {
        return buildStandardServerResponse(
            false,
            'Missing email',
            null,
            'Missing email in request payload',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    const normalizedInput = normalizeEmail(String(data.email));
    const { error, value } = Joi.string().email().validate(normalizedInput);
    if (error) {
        return buildStandardServerResponse(
            false,
            'Invalid email format',
            null,
            'Email format is invalid',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    return buildStandardServerResponse(
        true,
        'Request payload parsed successfully',
        { email: normalizeEmail(value) },
        null,
        bussinessStatusCode.OK
    );
};

export const postAdminRegisterParser = (
    data: unknown
): StandardServerResult<PostAdminRegisterRequestPayload | null> => {
    const emailResult = postAdminEmailParser(data);
    if (!emailResult.success) {
        return buildStandardServerResponse(
            false,
            emailResult.message,
            null,
            emailResult.error,
            emailResult.httpStatus
        );
    }

    if (!data || typeof data !== 'object' || !('password' in data)) {
        return buildStandardServerResponse(
            false,
            'Missing password',
            null,
            'Missing password in request payload',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    const password = String(data.password);
    if (password.length < 6 || password.length > 128) {
        return buildStandardServerResponse(
            false,
            'Password length invalid',
            null,
            'Password must be between 6 and 128 characters long',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    if (
        !/[A-Z]/.test(password)
        || !/[a-z]/.test(password)
        || !/[!@#$%^&*(),.?":{}|<>]/.test(password)
    ) {
        return buildStandardServerResponse(
            false,
            'Password complexity insufficient',
            null,
            'Password must contain upper-case, lower-case, and special characters',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    return buildStandardServerResponse(
        true,
        'Request payload parsed successfully',
        {
            email: emailResult.data!.email,
            password,
        },
        null,
        bussinessStatusCode.OK
    );
};

export const postAdminValidationParser = (
    data: unknown
): StandardServerResult<PostAdminValidateRequestPayload | null> => {
    const emailResult = postAdminEmailParser(data);
    if (!emailResult.success) {
        return buildStandardServerResponse(
            false,
            emailResult.message,
            null,
            emailResult.error,
            emailResult.httpStatus
        );
    }

    if (!data || typeof data !== 'object' || !('token' in data) || !String(data.token).trim()) {
        return buildStandardServerResponse(
            false,
            'Missing verification token',
            null,
            'Missing verification token in request payload',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    return buildStandardServerResponse(
        true,
        'Request payload parsed successfully',
        {
            email: emailResult.data!.email,
            token: String(data.token).trim(),
        },
        null,
        bussinessStatusCode.OK
    );
};

export const postAdminLoginParser = (
    data: unknown
): StandardServerResult<PostAdminLoginRequestPayload | null> => {
    const emailResult = postAdminEmailParser(data);
    if (!emailResult.success) {
        return buildStandardServerResponse(
            false,
            emailResult.message,
            null,
            emailResult.error,
            emailResult.httpStatus
        );
    }

    if (!data || typeof data !== 'object' || !('password' in data) || !String(data.password)) {
        return buildStandardServerResponse(
            false,
            'Missing password',
            null,
            'Missing password in request payload',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    return buildStandardServerResponse(
        true,
        'Request payload parsed successfully',
        {
            email: emailResult.data!.email,
            password: String(data.password),
        },
        null,
        bussinessStatusCode.OK
    );
};

export const checkPostAdminEmailAvailabilityService = async (
    email: string
): Promise<StandardServerResult<{ available: boolean }>> => {
    try {
        const normalizedEmail = normalizeEmail(email);
        const [postAdmin, pendingRegistration] = await Promise.all([
            getPrismaClient().postAdmin.findUnique({
                where: { email: normalizedEmail },
                select: { id: true },
            }),
            getKV().get(registrationKey(normalizedEmail)),
        ]);
        const available = postAdmin === null && pendingRegistration === null;

        return buildStandardServerResponse(
            available,
            available ? 'Post administrator email is available' : 'Post administrator email is already in use',
            { available },
            available ? null : 'The email is registered or has a pending registration',
            available ? bussinessStatusCode.OK : bussinessStatusCode.CONFLICT
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to check Post administrator email',
            { available: false },
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const initializePostAdminRegistrationService = async (
    data: PostAdminRegisterRequestPayload
): Promise<StandardServerResult<null>> => {
    const availability = await checkPostAdminEmailAvailabilityService(data.email);
    if (!availability.success) {
        return buildStandardServerResponse(
            false,
            availability.message,
            null,
            availability.error,
            availability.httpStatus
        );
    }

    const key = registrationKey(data.email);
    try {
        const token = createVerificationToken();
        const pendingRegistration: PendingPostAdminRegistration = {
            passwordHash: await bcrypt.hash(data.password, bcryptSaltRounds),
            tokenHash: await sha256(token),
        };

        await getKV().put(key, JSON.stringify(pendingRegistration), {
            expirationTtl: REGISTRATION_TTL_SECONDS,
        });

        const result = await getEmailManager().sendEmail(
            data.email,
            'Post administrator registration',
            PostAdminVerificationTemplate({ token })
        );

        if (result.error) {
            await getKV().delete(key);
            return buildStandardServerResponse(
                false,
                'Failed to send Post administrator verification email',
                null,
                result.error.message,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }

        return buildStandardServerResponse(
            true,
            'Post administrator verification email sent successfully',
            null,
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        await getKV().delete(key).catch(() => undefined);
        return buildStandardServerResponse(
            false,
            'Failed to initialize Post administrator registration',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const validatePostAdminRegistrationService = async (
    data: PostAdminValidateRequestPayload
): Promise<StandardServerResult<PublicPostAdmin | null>> => {
    const key = registrationKey(data.email);
    try {
        const rawRegistration = await getKV().get(key);
        if (!rawRegistration) {
            return buildStandardServerResponse(
                false,
                'Post administrator registration expired or not found',
                null,
                'Request a new verification email',
                bussinessStatusCode.GONE
            );
        }

        let pendingRegistration: PendingPostAdminRegistration;
        try {
            pendingRegistration = JSON.parse(rawRegistration) as PendingPostAdminRegistration;
        } catch {
            return buildStandardServerResponse(
                false,
                'Invalid pending Post administrator registration',
                null,
                'Stored registration data is malformed',
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }

        const submittedTokenHash = await sha256(data.token);
        if (!constantTimeEquals(submittedTokenHash, pendingRegistration.tokenHash)) {
            return buildStandardServerResponse(
                false,
                'Invalid Post administrator verification token',
                null,
                'The verification token is invalid',
                bussinessStatusCode.BAD_REQUEST
            );
        }

        const existingPostAdmin = await getPrismaClient().postAdmin.findUnique({
            where: { email: data.email },
            select: { id: true },
        });
        if (existingPostAdmin) {
            await getKV().delete(key);
            return buildStandardServerResponse(
                false,
                'Post administrator already exists',
                null,
                'The email is already registered',
                bussinessStatusCode.CONFLICT
            );
        }

        const postAdmin = await getPrismaClient().postAdmin.create({
            data: {
                email: data.email,
                password: pendingRegistration.passwordHash,
            },
        });
        await getKV().delete(key);

        return buildStandardServerResponse(
            true,
            'Post administrator registered successfully',
            toPublicPostAdmin(postAdmin),
            null,
            bussinessStatusCode.CREATED
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to validate Post administrator registration',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const postAdminLoginService = async (
    c: Context,
    data: PostAdminLoginRequestPayload
): Promise<StandardServerResult<{ postAdmin: PublicPostAdmin; token: string } | null>> => {
    const invalidCredentials = () => buildStandardServerResponse<null>(
        false,
        'Invalid Post administrator email or password',
        null,
        'Invalid credentials',
        bussinessStatusCode.UNAUTHORIZED
    );

    try {
        const postAdmin = await getPrismaClient().postAdmin.findUnique({
            where: { email: data.email },
        });
        if (!postAdmin || !(await bcrypt.compare(data.password, postAdmin.password))) {
            return invalidCredentials();
        }

        const token = await generatePostAdminToken(c, {
            id: postAdmin.id,
            email: postAdmin.email,
        });
        setPostAdminAuthCookie(c, token);

        return buildStandardServerResponse(
            true,
            'Post administrator login successful',
            {
                postAdmin: toPublicPostAdmin(postAdmin),
                token,
            },
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Post administrator login failed',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const postAdminLogoutService = (c: Context): StandardServerResult<null> => {
    clearPostAdminAuthCookie(c);
    return buildStandardServerResponse(
        true,
        'Post administrator logout successful',
        null,
        null,
        bussinessStatusCode.OK
    );
};

export const getCurrentPostAdminService = async (
    c: Context
): Promise<StandardServerResult<PublicPostAdmin | null>> => {
    const identity = c.get('postAdmin');
    try {
        const postAdmin = await getPrismaClient().postAdmin.findFirst({
            where: {
                id: identity.id,
                email: identity.email,
            },
        });
        if (!postAdmin) {
            return buildStandardServerResponse(
                false,
                'Post administrator no longer exists',
                null,
                'Post administrator identity was not found',
                bussinessStatusCode.UNAUTHORIZED
            );
        }

        return buildStandardServerResponse(
            true,
            'Current Post administrator retrieved successfully',
            toPublicPostAdmin(postAdmin),
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to retrieve current Post administrator',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const bindCurrentUserService = async (
    c: Context
): Promise<StandardServerResult<PublicPostAdmin | null>> => {
    const userIdentity = c.get('user');
    const postAdminIdentity = c.get('postAdmin');

    try {
        const [user, postAdmin] = await Promise.all([
            getPrismaClient().user.findUnique({
                where: { username: userIdentity.username },
                include: { postAdmin: { select: { id: true } } },
            }),
            getPrismaClient().postAdmin.findUnique({
                where: { id: postAdminIdentity.id },
            }),
        ]);

        if (!user || !postAdmin) {
            return buildStandardServerResponse(
                false,
                'User or Post administrator was not found',
                null,
                'One of the authenticated identities no longer exists',
                bussinessStatusCode.NOT_FOUND
            );
        }

        const bindingDecision = getPostAdminBindingDecision({
            userId: user.id,
            userPostAdminId: user.postAdmin?.id ?? null,
            postAdminId: postAdmin.id,
            postAdminUserId: postAdmin.userId,
        });

        if (bindingDecision === 'post-admin-bound-elsewhere') {
            return buildStandardServerResponse(
                false,
                'Post administrator is already bound to another user',
                null,
                'Remove the existing binding first',
                bussinessStatusCode.CONFLICT
            );
        }

        if (bindingDecision === 'user-bound-elsewhere') {
            return buildStandardServerResponse(
                false,
                'User is already bound to another Post administrator',
                null,
                'Remove the existing binding first',
                bussinessStatusCode.CONFLICT
            );
        }

        if (bindingDecision === 'already-bound') {
            return buildStandardServerResponse(
                true,
                'User and Post administrator are already bound',
                toPublicPostAdmin(postAdmin),
                null,
                bussinessStatusCode.OK
            );
        }

        const updatedPostAdmin = await getPrismaClient().postAdmin.update({
            where: { id: postAdmin.id },
            data: { userId: user.id },
        });

        return buildStandardServerResponse(
            true,
            'User and Post administrator bound successfully',
            toPublicPostAdmin(updatedPostAdmin),
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to bind user and Post administrator',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const unbindCurrentUserService = async (
    c: Context
): Promise<StandardServerResult<PublicPostAdmin | null>> => {
    const userIdentity = c.get('user');
    const postAdminIdentity = c.get('postAdmin');

    try {
        const [user, postAdmin] = await Promise.all([
            getPrismaClient().user.findUnique({
                where: { username: userIdentity.username },
                select: { id: true },
            }),
            getPrismaClient().postAdmin.findUnique({
                where: { id: postAdminIdentity.id },
            }),
        ]);

        if (!user || !postAdmin) {
            return buildStandardServerResponse(
                false,
                'User or Post administrator was not found',
                null,
                'One of the authenticated identities no longer exists',
                bussinessStatusCode.NOT_FOUND
            );
        }

        if (postAdmin.userId !== user.id) {
            return buildStandardServerResponse(
                false,
                'The active identities are not bound to each other',
                null,
                'No matching binding exists',
                bussinessStatusCode.CONFLICT
            );
        }

        const updatedPostAdmin = await getPrismaClient().postAdmin.update({
            where: { id: postAdmin.id },
            data: { userId: null },
        });

        return buildStandardServerResponse(
            true,
            'User and Post administrator unbound successfully',
            toPublicPostAdmin(updatedPostAdmin),
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to unbind user and Post administrator',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};
