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
import { getEmailManager } from '@/lib/emailManager';
import Joi from 'joi';

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

    if (data.password.toString()) {
        const passwordStr = data.password.toString();
        if (passwordStr.length < 6 || passwordStr.length > 128) {
            return buildStandardServerResponse(
                false,
                'Password length invalid',
                null,
                'Password must be between 6 and 128 characters long',
                bussinessStatusCode.BAD_REQUEST
            )
        }
        const hasUpperCase = /[A-Z]/.test(passwordStr);
        const hasLowerCase = /[a-z]/.test(passwordStr);
        // const hasDigit = /\d/.test(passwordStr);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(passwordStr);
        if (!hasUpperCase || !hasLowerCase || !hasSpecialChar) {
            return buildStandardServerResponse(
                false,
                'Password complexity insufficient',
                null,
                'Password must contain at least one uppercase letter, one lowercase letter, and one special character',
                bussinessStatusCode.BAD_REQUEST
            )
        }
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

    const emailSchema = Joi.string().email();
    const { error, value: emailAddress } = emailSchema.validate(data.email.toString());
    if (error) {
        return buildStandardServerResponse(
            false,
            'Invalid email format',
            null,
            'Email format is invalid',
            bussinessStatusCode.BAD_REQUEST
        )
    }

    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            username: data.username.toString(),
            password: data.password.toString(),
            email: emailAddress,
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

    const emailSchema = Joi.string().email();
    const { error, value: emailAddress } = emailSchema.validate(data.email.toString());
    if (error) {
        return buildStandardServerResponse(
            false,
            'Invalid email format',
            null,
            'Email format is invalid',
            bussinessStatusCode.BAD_REQUEST
        )
    }

    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            email: emailAddress,
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

        const registrationCode = await KV?.get(`email-verification-code-${user.email}-register`);
        if (!registrationCode) {
            return buildStandardServerResponse(
                false,
                'Verification code expired or not found',
                null,
                'Verification code expired or not found. Please request a new verification code.',
                bussinessStatusCode.BAD_REQUEST
            )
        }

        if (registrationCode !== user.registrationCode) {
            return buildStandardServerResponse(
                false,
                'Invalid verification code',
                null,
                'Invalid verification code. Please check the code and try again.',
                bussinessStatusCode.BAD_REQUEST
            )
        }

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
            hypergryphAccount: true
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
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const reactTemplate = VerificationTemplate({ code: verificationCode, })
        const existingCode = await KV?.get(`email-verification-code-${data.email}-${data.type}`);
        if (existingCode) {
            return buildStandardServerResponse(
                false,
                'Verification code already sent',
                null,
                'A verification code has already been sent to this email address. Please wait before requesting another one.',
                bussinessStatusCode.TOO_MANY_REQUESTS
            );
        }
        await KV?.put(`email-verification-code-${data.email}-${data.type}`, verificationCode, { expirationTtl: 5 * 60 });
        const res = await getEmailManager().sendEmail(data.email, 'Verification Code', reactTemplate);
        if (res.error !== null) {
            return buildStandardServerResponse(
                false,
                'Failed to send verification code',
                null,
                res.error instanceof Error ? res.error.message : 'Unknown error while sending email',
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