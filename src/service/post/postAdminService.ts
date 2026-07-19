import bcrypt from 'bcryptjs';
import { Context } from 'hono';
import { bcryptSaltRounds } from '@/common/config/bcryptConfig';
import PostAdminVerificationTemplate from '@/common/Email/template/postAdminVerificationTemplate';
import { validateEmail, normalizeEmail } from '@/common/validation/email';
import { validatePasswordStrength } from '@/common/validation/password';
import {
    constantTimeEquals,
    deleteVerificationCode,
    generateVerificationCode,
    getVerificationCode,
    storeVerificationCode,
    sendVerificationEmail,
} from '@/common/service/verificationService';
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

    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
        return buildStandardServerResponse(
            false,
            'Invalid email format',
            null,
            emailValidation.error,
            bussinessStatusCode.BAD_REQUEST
        );
    }

    return buildStandardServerResponse(
        true,
        'Request payload parsed successfully',
        { email: emailValidation.normalizedEmail! },
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

    const passwordValidation = validatePasswordStrength(String(data.password));
    if (!passwordValidation.valid) {
        return buildStandardServerResponse(
            false,
            'Password validation failed',
            null,
            passwordValidation.error,
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

    if (!data || typeof data !== 'object' || !('code' in data) || !String(data.code).trim()) {
        return buildStandardServerResponse(
            false,
            'Missing verification code',
            null,
            'Missing verification code in request payload',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    const code = String(data.code).trim();
    if (!/^\d{6}$/.test(code)) {
        return buildStandardServerResponse(
            false,
            'Invalid verification code format',
            null,
            'Verification code must be a 6-digit number',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    return buildStandardServerResponse(
        true,
        'Request payload parsed successfully',
        {
            email: emailResult.data!.email,
            code,
        },
        null,
        bussinessStatusCode.OK
    );
};

export const postAdminLoginParser = (
    data: unknown
): StandardServerResult<PostAdminLoginRequestPayload | null> => {
    if (!data || typeof data !== 'object' || !('email' in data) || !('password' in data)) {
        return buildStandardServerResponse(
            false,
            'Missing email or password',
            null,
            'Missing email or password in request payload',
            bussinessStatusCode.BAD_REQUEST
        );
    }

    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
        return buildStandardServerResponse(
            false,
            'Invalid email format',
            null,
            emailValidation.error,
            bussinessStatusCode.BAD_REQUEST
        );
    }

    return buildStandardServerResponse(
        true,
        'Request payload parsed successfully',
        {
            email: emailValidation.normalizedEmail!,
            password: String(data.password),
        },
        null,
        bussinessStatusCode.OK
    );
};

export const checkPostAdminEmailAvailabilityService = async (
    email: string
): Promise<StandardServerResult<boolean | null>> => {
    try {
        const existing = await getPrismaClient().postAdmin.findUnique({
            where: { email },
        });

        return buildStandardServerResponse(
            true,
            existing ? 'Email is already registered' : 'Email is available',
            !existing,
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to check email availability',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const initializePostAdminRegistrationService = async (
    data: PostAdminRegisterRequestPayload
): Promise<StandardServerResult<boolean | null>> => {
    try {
        const { email, password } = data;

        // Check if email is already registered
        const existing = await getPrismaClient().postAdmin.findUnique({
            where: { email },
        });

        if (existing) {
            return buildStandardServerResponse(
                false,
                'Email is already registered',
                null,
                'Please use a different email address',
                bussinessStatusCode.CONFLICT
            );
        }

        // Generate 6-digit verification code
        const verificationCode = generateVerificationCode();
        const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);

        // Store pending registration
        const pendingData: PendingPostAdminRegistration = {
            passwordHash,
        };

        await storeVerificationCode(
            registrationKey(email),
            JSON.stringify(pendingData),
            REGISTRATION_TTL_SECONDS
        );

        // Send verification email with 6-digit code
        const emailTemplate = PostAdminVerificationTemplate({ code: verificationCode });
        const sendResult = await sendVerificationEmail(
            email,
            'Post Administrator Registration Verification',
            emailTemplate
        );

        if (!sendResult.success) {
            // Clean up stored data if email fails
            await deleteVerificationCode(registrationKey(email));
            return buildStandardServerResponse(
                false,
                'Failed to send verification email',
                null,
                sendResult.error,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }

        return buildStandardServerResponse(
            true,
            'Verification code sent successfully',
            null,
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to initialize registration',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const validatePostAdminRegistrationService = async (
    data: PostAdminValidateRequestPayload
): Promise<StandardServerResult<PublicPostAdmin | null>> => {
    try {
        const { email, code } = data;

        // Get pending registration
        const storedData = await getVerificationCode(registrationKey(email));
        if (!storedData) {
            return buildStandardServerResponse(
                false,
                'Registration session expired or not found',
                null,
                'Please start the registration process again',
                bussinessStatusCode.GONE
            );
        }

        const pending: PendingPostAdminRegistration = JSON.parse(storedData);

        // Verify code (we need to retrieve the stored code from KV)
        // Note: We need to store the code separately for verification
        const storedCode = await getVerificationCode(`${registrationKey(email)}:code`);
        if (!storedCode || !constantTimeEquals(storedCode, code)) {
            return buildStandardServerResponse(
                false,
                'Invalid verification code',
                null,
                'The provided code is incorrect',
                bussinessStatusCode.BAD_REQUEST
            );
        }

        // Create post admin
        const postAdmin = await getPrismaClient().postAdmin.create({
            data: {
                email,
                password: pending.passwordHash,
            },
        });

        // Clean up pending registration
        await deleteVerificationCode(registrationKey(email));
        await deleteVerificationCode(`${registrationKey(email)}:code`);

        return buildStandardServerResponse(
            true,
            'Registration successful',
            toPublicPostAdmin(postAdmin as PostAdminRecord),
            null,
            bussinessStatusCode.CREATED
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to validate registration',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const postAdminLoginService = async (
    c: Context,
    data: PostAdminLoginRequestPayload
): Promise<StandardServerResult<PublicPostAdmin | null>> => {
    try {
        const { email, password } = data;

        const postAdmin = await getPrismaClient().postAdmin.findUnique({
            where: { email },
        });

        if (!postAdmin) {
            return buildStandardServerResponse(
                false,
                'Invalid email or password',
                null,
                'The email or password you entered is incorrect',
                bussinessStatusCode.UNAUTHORIZED
            );
        }

        const passwordValid = await bcrypt.compare(password, postAdmin.password);
        if (!passwordValid) {
            return buildStandardServerResponse(
                false,
                'Invalid email or password',
                null,
                'The email or password you entered is incorrect',
                bussinessStatusCode.UNAUTHORIZED
            );
        }

        // Generate token and set cookie
        const token = await generatePostAdminToken(c, {
            id: postAdmin.id,
            email: postAdmin.email,
        });
        setPostAdminAuthCookie(c, token);

        return buildStandardServerResponse(
            true,
            'Login successful',
            toPublicPostAdmin(postAdmin as PostAdminRecord),
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to login',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const postAdminLogoutService = async (
    c: Context
): Promise<StandardServerResult<boolean | null>> => {
    try {
        clearPostAdminAuthCookie(c);
        return buildStandardServerResponse(
            true,
            'Logout successful',
            null,
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to logout',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
};

export const getCurrentPostAdminService = async (
    c: Context
): Promise<StandardServerResult<PublicPostAdmin | null>> => {
    const postAdminIdentity = c.get('postAdmin');

    try {
        const postAdmin = await getPrismaClient().postAdmin.findUnique({
            where: { id: postAdminIdentity.id },
        });

        if (!postAdmin) {
            return buildStandardServerResponse(
                false,
                'Post administrator not found',
                null,
                'The authenticated post administrator no longer exists',
                bussinessStatusCode.NOT_FOUND
            );
        }

        return buildStandardServerResponse(
            true,
            'Post administrator info retrieved successfully',
            toPublicPostAdmin(postAdmin as PostAdminRecord),
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to get post administrator info',
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
                toPublicPostAdmin(postAdmin as PostAdminRecord),
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
            toPublicPostAdmin(updatedPostAdmin as PostAdminRecord),
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
            toPublicPostAdmin(updatedPostAdmin as PostAdminRecord),
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
