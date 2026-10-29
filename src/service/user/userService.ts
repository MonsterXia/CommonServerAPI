import bcrypt from 'bcryptjs';
import { registerUser, sendRegistrationCode } from './registrationService';
import { Context } from 'hono';
import {
    SendEmailVerificationCodeRequestPayload,
    UserPasswordLoginRequestPayload,
    UserRegisterRequestPayload
} from "@/model/user/user";
import { getPrismaClient } from '@/lib/prisma';
import { clearAuthCookie, generateToken, setAuthCookie } from '@/lib/jwt';
import { buildStandardServerResponse, businessStatusCode } from '@/util/hono';
import { StandardServerResult } from '@/model/util/hono';
import VerificationTemplate from '@/common/Email/template/verificationTemplate';
import { validateEmail } from '@/common/validation/email';
import { validatePasswordStrength } from '@/common/validation/password';
import {
    checkVerificationCodeExists,
    generateVerificationCode,
    storeVerificationCode,
    sendVerificationEmail,
    deleteVerificationCode,
} from '@/common/service/verificationService';

const VERIFICATION_CODE_TTL_SECONDS = 5 * 60;
const VERIFICATION_CODE_KEY_PREFIX = 'email-verification-code-';

export const userRegisterParser = (data: any): StandardServerResult<UserRegisterRequestPayload | null> => {
    if (
        !data || typeof data.username !== 'string' || !data.username.trim()
        || typeof data.password !== 'string' || !data.password
        || typeof data.email !== 'string' || !data.email
        || typeof data.registrationCode !== 'string' || !data.registrationCode
    ) {
        return buildStandardServerResponse(
            false,
            'Missing username or password or email or registration code',
            null,
            'Missing username or password or email or registration code in request payload',
            businessStatusCode.BAD_REQUEST
        )
    }

    // Validate password using shared utility
    const passwordValidation = validatePasswordStrength(data.password.toString());
    if (!passwordValidation.valid) {
        return buildStandardServerResponse(
            false,
            'Password validation failed',
            null,
            passwordValidation.error,
            businessStatusCode.BAD_REQUEST
        )
    }

    if (data.username.toString().length < 3 || data.username.toString().length > 30) {
        return buildStandardServerResponse(
            false,
            'Username length invalid',
            null,
            'Username must be between 3 and 30 characters long',
            businessStatusCode.BAD_REQUEST
        )
    }

    // Validate email using shared utility
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
        return buildStandardServerResponse(
            false,
            'Invalid email format',
            null,
            emailValidation.error,
            businessStatusCode.BAD_REQUEST
        )
    }

    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            username: data.username.toString(),
            password: data.password.toString(),
            email: emailValidation.normalizedEmail!,
            registrationCode: data.registrationCode.toString()
        },
        null,
        businessStatusCode.OK
    )
}

export const userPasswordLoginParser = (data: any): StandardServerResult<UserPasswordLoginRequestPayload | null> => {
    if (!data || typeof data.username !== 'string' || !data.username.trim() || typeof data.password !== 'string' || !data.password) {
        return buildStandardServerResponse(
            false,
            'Missing username or password',
            null,
            'Missing username or password in request payload',
            businessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            username: data.username.toString(),
            password: data.password.toString()
        },
        null,
        businessStatusCode.OK
    )
}

export const sendEmailVerificationCodeParser = (data: any): StandardServerResult<SendEmailVerificationCodeRequestPayload | null> => {
    if (!data || typeof data.email !== 'string' || !data.email || !data.type) {
        return buildStandardServerResponse(
            false,
            'Missing email or type',
            null,
            'Missing email or type in request payload',
            businessStatusCode.BAD_REQUEST
        )
    }

    if (!['register', 'reset_password'].includes(data.type)) {
        return buildStandardServerResponse(
            false,
            'Invalid verification type',
            null,
            'Invalid verification type. Must be either "register" or "reset_password"',
            businessStatusCode.BAD_REQUEST
        )
    }

    // Validate email using shared utility
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
        return buildStandardServerResponse(
            false,
            'Invalid email format',
            null,
            emailValidation.error,
            businessStatusCode.BAD_REQUEST
        )
    }

    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            email: emailValidation.normalizedEmail!,
            type: data.type
        },
        null,
        businessStatusCode.OK
    )
}

export const userRegisterService = registerUser;

export const checkUsernameExistService = async (c: Context, username: string): Promise<StandardServerResult<boolean | null>> => {
    try {
        if (!username || username.trim() === '') {
            return buildStandardServerResponse(
                false,
                'Invalid username',
                null,
                'Username is empty or contains only whitespace',
                businessStatusCode.BAD_REQUEST
            );
        }

        const user = await getPrismaClient().user.findUnique({
            where: {
                username
            },
            select: {
                id: true
            }
        })
        return buildStandardServerResponse(
            user !== null,
            user !== null ? 'Username exists' : 'Username does not exist',
            user !== null,
            null,
            businessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to check username existence',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}

export const checkEmailExistService = async (c: Context, email: string): Promise<StandardServerResult<boolean | null>> => {
    try {
        if (!email || email.trim() === '') {
            return buildStandardServerResponse(
                false,
                'Invalid email',
                null,
                'Email is empty or contains only whitespace',
                businessStatusCode.BAD_REQUEST
            );
        }

        const user = await getPrismaClient().user.findMany(
            {
                where: {
                    email
                },
                select: {
                    id: true
                }
            }
        )
        return buildStandardServerResponse(
            user.length > 0,
            user.length > 0 ? 'Email exists' : 'Email does not exist',
            user.length > 0,
            null,
            businessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to check email existence',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}

export const userPasswordLoginService = async (
    c: Context,
    user: UserPasswordLoginRequestPayload
): Promise<StandardServerResult<any>> => {
    try {
        const failedResponse = buildStandardServerResponse(
            false,
            'Invalid username or password',
            null,
            'Invalid username or password',
            businessStatusCode.FORBIDDEN
        )
        const foundUser = await getPrismaClient().user.findUnique({
            where: {
                username: user.username
            }
        })

        if (!foundUser) {
            return failedResponse;
        }
        const passwordMatch = await bcrypt.compare(user.password, foundUser.password);
        if (!passwordMatch) {
            return failedResponse;
        }
        const token = await generateToken(c, {
            username: user.username, sessionVersion: foundUser.sessionVersion
        });
        setAuthCookie(c, token);

        return buildStandardServerResponse(
            true,
            'Login successful',
            { token },
            null,
            businessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Login failed',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            businessStatusCode.INTERNAL_SERVER_ERROR
        )
    }
}

export const userLogoutService = async (
    c: Context
): Promise<StandardServerResult<boolean | null>> => {
    try {
        clearAuthCookie(c);
        return buildStandardServerResponse(
            true,
            'Logout successful',
            null,
            null,
            businessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Logout failed',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}

export const getCurrentUserService = async (c: Context): Promise<StandardServerResult<any>> => {
    const user = c.get('user');
    const userInfo = await getPrismaClient().user.findUnique({
        where: { username: user.username },
        select: {
            id: true,
            username: true,
            email: true,
            phone: true,
            isAdmin: true,
            createdAt: true,
            updatedAt: true,
            hypergryphAccount: {
                select: { phone: true, userId: true, createdAt: true, updatedAt: true }
            },
            postAdmin: {
                select: {
                    id: true, email: true, organization: true, role: true,
                    userId: true, createdAt: true, updatedAt: true,
                }
            }
        }
    });
    if (!userInfo) {
        return buildStandardServerResponse(
            false, 'User not found', null, null, businessStatusCode.NOT_FOUND
        );
    }

    return buildStandardServerResponse(
        true,
        'User info retrieved successfully',
        userInfo,
        null,
        businessStatusCode.OK
    );
}

export const getCurrentUserServiceInternal = async (c: Context): Promise<StandardServerResult<any>> => {
    const user = c.get('user');
    const failedResponse = buildStandardServerResponse(
        false,
        'Invalid username',
        null,
        null,
        businessStatusCode.BAD_REQUEST
    );
    const exist = await checkUsernameExistService(c, user.username);
    if (!exist.success) {
        return exist;
    }

    const userInfo = await getPrismaClient().user.findUnique({
        where: { username: user.username },
        include: {
            hypergryphAccount: true
        }
    });

    return buildStandardServerResponse(
        true,
        'User info retrieved successfully',
        userInfo,
        null,
        businessStatusCode.OK
    );
}

export const sendEmailVerificationCodeService = async (c: Context, data: SendEmailVerificationCodeRequestPayload): Promise<StandardServerResult<any>> => {
    try {
        if (data.type === 'register') return await sendRegistrationCode(c, data.email);

        // Generate and send verification code using shared utility
        const verificationCode = generateVerificationCode();
        const key = `${VERIFICATION_CODE_KEY_PREFIX}${data.email}-${data.type}`;

        // Check if code already exists
        const exists = await checkVerificationCodeExists(key);
        if (exists) {
            return buildStandardServerResponse(
                false,
                'Verification code already sent',
                null,
                'A verification code has already been sent to this email address. Please wait before requesting another one.',
                businessStatusCode.TOO_MANY_REQUESTS
            );
        }

        // Store the code
        await storeVerificationCode(key, verificationCode, VERIFICATION_CODE_TTL_SECONDS);

        // Send the email
        const template = VerificationTemplate({ code: verificationCode });
        const sendResult = await sendVerificationEmail(data.email, 'Verification Code', template);

        if (!sendResult.success) {
            // Clean up stored code if email fails
            await deleteVerificationCode(key);
            return buildStandardServerResponse(
                false,
                'Failed to send verification code',
                null,
                sendResult.error,
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }

        return buildStandardServerResponse(
            true,
            'Verification code sent successfully',
            null,
            null,
            businessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to send verification code',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}
