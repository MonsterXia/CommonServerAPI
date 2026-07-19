import bcrypt from 'bcryptjs';
import { Context } from 'hono';
import {
    SendEmailVerificationCodeRequestPayload,
    UserPasswordLoginRequestPayload,
    UserRegisterRequestPayload
} from "@/model/user/user";
import { bcryptSaltRounds } from '@/common/config/bcryptConfig';
import { getPrismaClient } from '@/lib/prisma';
import { clearAuthCookie, generateToken, setAuthCookie } from '@/lib/jwt';
import { buildStandardServerResponse, bussinessStatusCode } from '@/util/hono';
import { StandardServerResult } from '@/model/util/hono';
import VerificationTemplate from '@/common/Email/template/verificationTemplate';
import { validateEmail } from '@/common/validation/email';
import { validatePasswordStrength } from '@/common/validation/password';
import {
    checkVerificationCodeExists,
    constantTimeEquals,
    generateVerificationCode,
    getVerificationCode,
    storeVerificationCode,
    sendVerificationEmail,
    deleteVerificationCode,
} from '@/common/service/verificationService';

const VERIFICATION_CODE_TTL_SECONDS = 5 * 60;
const VERIFICATION_CODE_KEY_PREFIX = 'email-verification-code-';

export const userRegisterParser = (data: any): StandardServerResult<UserRegisterRequestPayload | null> => {
    if (!data.username || !data.password || !data.email || !data.registrationCode) {
        return buildStandardServerResponse(
            false,
            'Missing username or password or email or registration code',
            null,
            'Missing username or password or email or registration code in request payload',
            bussinessStatusCode.BAD_REQUEST
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
            bussinessStatusCode.BAD_REQUEST
        )
    }

    if (data.username.toString().length < 3 || data.username.toString().length > 30) {
        return buildStandardServerResponse(
            false,
            'Username length invalid',
            null,
            'Username must be between 3 and 30 characters long',
            bussinessStatusCode.BAD_REQUEST
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
            bussinessStatusCode.BAD_REQUEST
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
        bussinessStatusCode.OK
    )
}

export const userPasswordLoginParser = (data: any): StandardServerResult<UserPasswordLoginRequestPayload | null> => {
    if (!data.username || !data.password) {
        return buildStandardServerResponse(
            false,
            'Missing username or password',
            null,
            'Missing username or password in request payload',
            bussinessStatusCode.BAD_REQUEST
        )
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            username: data.username.toString(),
            password: data.password.toString()
        },
        bussinessStatusCode.OK
    )
}

export const sendEmailVerificationCodeParser = (data: any): StandardServerResult<SendEmailVerificationCodeRequestPayload | null> => {
    if (!data.email || !data.type) {
        return buildStandardServerResponse(
            false,
            'Missing email or type',
            null,
            'Missing email or type in request payload',
            bussinessStatusCode.BAD_REQUEST
        )
    }

    if (!['register', 'reset_password'].includes(data.type)) {
        return buildStandardServerResponse(
            false,
            'Invalid verification type',
            null,
            'Invalid verification type. Must be either "register" or "reset_password"',
            bussinessStatusCode.BAD_REQUEST
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
            bussinessStatusCode.BAD_REQUEST
        )
    }

    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            email: emailValidation.normalizedEmail!,
            type: data.type
        },
        bussinessStatusCode.OK
    )
}

export const userRegisterService = async (c: Context, user: UserRegisterRequestPayload): Promise<StandardServerResult<any>> => {
    try {
        const exist = await checkUsernameExistService(c, user.username);
        if (exist.success) {
            return buildStandardServerResponse(
                false,
                'Username already exists',
                null,
                'Username already exists',
                bussinessStatusCode.CONFLICT
            )
        }
        const emailExist = await checkEmailExistService(c, user.email);
        if (emailExist.success) {
            return buildStandardServerResponse(
                false,
                'Email already exists',
                null,
                'Email already exists',
                bussinessStatusCode.CONFLICT
            )
        }

        // Verify registration code using shared utility
        const verificationKey = `${VERIFICATION_CODE_KEY_PREFIX}${user.email}-register`;
        const storedCode = await getVerificationCode(verificationKey);
        
        if (!storedCode) {
            return buildStandardServerResponse(
                false,
                'Verification code expired or not found',
                null,
                'Verification code expired or not found. Please request a new verification code.',
                bussinessStatusCode.BAD_REQUEST
            )
        }

        if (!constantTimeEquals(storedCode, user.registrationCode)) {
            return buildStandardServerResponse(
                false,
                'Invalid verification code',
                null,
                'Invalid verification code. Please check the code and try again.',
                bussinessStatusCode.BAD_REQUEST
            )
        }

        // Clean up used verification code
        await deleteVerificationCode(verificationKey);

        const hashedPassword = await bcrypt.hash(user.password, bcryptSaltRounds);
        const newUser = await getPrismaClient().user.create({
            data: {
                username: user.username,
                password: hashedPassword,
                email: user.email
            }
        })

        const token = await generateToken(c, { username: newUser.username });
        setAuthCookie(c, token);
        const { password: _, ...userWithoutPassword } = newUser;

        return buildStandardServerResponse(
            true,
            'User registered successfully',
            {
                user: userWithoutPassword,
                token
            },
            bussinessStatusCode.CREATED
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'User registration failed',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}

export const checkUsernameExistService = async (c: Context, username: string): Promise<StandardServerResult<boolean | null>> => {
    try {
        if (!username || username.trim() === '') {
            return buildStandardServerResponse(
                false,
                'Invalid username',
                null,
                'Username is empty or contains only whitespace',
                bussinessStatusCode.BAD_REQUEST
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
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to check username existence',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
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
                bussinessStatusCode.BAD_REQUEST
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
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Failed to check email existence',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
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
            bussinessStatusCode.FORBIDDEN
        )
        const exist = await checkUsernameExistService(c, user.username);
        if (!exist.success) {
            return exist;
        }

        const foundUser = await getPrismaClient().user.findUnique({
            where: {
                username: user.username
            }
        })

        const passwordMatch = await bcrypt.compare(user.password, foundUser!.password);
        if (!passwordMatch) {
            return failedResponse;
        }
        const token = await generateToken(c, {
            username: user.username
        });
        setAuthCookie(c, token);

        return buildStandardServerResponse(
            true,
            'Login successful',
            { token },
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Login failed',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
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
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Logout failed',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}

export const getCurrentUserService = async (c: Context): Promise<StandardServerResult<any>> => {
    const user = c.get('user');
    const failedResponse = buildStandardServerResponse(
        false,
        'Invalid username',
        null,
        null,
        bussinessStatusCode.BAD_REQUEST
    );
    const exist = await checkUsernameExistService(c, user.username);
    if (!exist.success) {
        return exist;
    }

    const userInfo = await getPrismaClient().user.findUnique({
        where: { username: user.username },
        include: {
            hypergryphAccount: true,
            postAdmin: {
                select: {
                    id: true,
                    email: true,
                    organization: true,
                    role: true,
                    userId: true,
                    createdAt: true,
                    updatedAt: true,
                }
            }
        }
    });

    const { password: _, ...userInfoWithoutPassword } = userInfo!;

    return buildStandardServerResponse(
        true,
        'User info retrieved successfully',
        userInfoWithoutPassword,
        null,
        bussinessStatusCode.OK
    );
}

export const getCurrentUserServiceInternal = async (c: Context): Promise<StandardServerResult<any>> => {
    const user = c.get('user');
    const failedResponse = buildStandardServerResponse(
        false,
        'Invalid username',
        null,
        null,
        bussinessStatusCode.BAD_REQUEST
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
        bussinessStatusCode.OK
    );
}

export const sendEmailVerificationCodeService = async (c: Context, data: SendEmailVerificationCodeRequestPayload): Promise<StandardServerResult<any>> => {
    try {
        if (data.type === 'register') {
            const emailExist = await checkEmailExistService(c, data.email);
            if (emailExist.success) {
                return buildStandardServerResponse(
                    false,
                    'Email already exists',
                    null,
                    'Email already exists. Please use a different email address.',
                    bussinessStatusCode.CONFLICT
                )
            }
        }

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
                bussinessStatusCode.TOO_MANY_REQUESTS
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
            'Failed to send verification code',
            null,
            error instanceof Error ? error.message : 'Unknown error',
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}
