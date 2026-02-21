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

export const userRegisterParser = (data: any): StandardServerResult<UserRegisterRequestPayload | null> => {
    if (!data.username || !data.password) {
        return buildStandardServerResponse(
            false,
            'Missing username or password',
            null,
            'Missing username or password in request payload',
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
    if (!data.email) {
        return buildStandardServerResponse(
            false,
            'Missing email',
            null,
            'Missing email in request payload',
            bussinessStatusCode.BAD_REQUEST
        )
    }

    const emailStr = data.email.toString();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailStr)) {
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
        { email: emailStr },
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

        const hashedPassword = await bcrypt.hash(user.password, bcryptSaltRounds);
        const newUser = await getPrismaClient().user.create({
            data: {
                username: user.username,
                password: hashedPassword
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
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const reactTemplate = VerificationTemplate({code: verificationCode,})
        const existingCode = await KV?.get(`email_verification_code_${data.email}`);
        if (existingCode) {
            return buildStandardServerResponse(
                false,
                'Verification code already sent',
                null,
                'A verification code has already been sent to this email address. Please wait before requesting another one.',
                bussinessStatusCode.TOO_MANY_REQUESTS
            );
        }
        await KV?.put(`email_verification_code_${data.email}`, verificationCode, { expirationTtl: 5 * 60 });
        const res = await getEmailManager().sendEmail(data.email, 'Verification Code', reactTemplate);
        console.log('Email sent result:', res);
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