import bcrypt from 'bcryptjs';
import { Context } from 'hono';
import { UserPasswordLoginRequestPayload, UserRegisterRequestPayload } from "../../model/user/user";
import { bcryptSaltRounds } from '../../common/config/bcryptConfig';
import { getPrismaClient } from '../../lib/prisma';
import { clearAuthCookie, generateToken, setAuthCookie } from '../../lib/jwt';
import { buildContextJson, buildStandardServerResponse, bussinessStatusCode } from '../../util/hono';
import { StandardServerResult } from '../../model/util/hono';

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
        const newUser = await getPrismaClient(c.env).user.create({
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

        const user = await getPrismaClient(c.env).user.findUnique({
            where: {
                username
            },
            select: {
                id: true
            }
        })
        return buildStandardServerResponse(
            user !== null,
            user !== null? 'Username exists' : 'Username does not exist',
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
        console.log('checkUsernameExistService result:', exist);
        if (!exist.success) {
            return exist;
        }

        const foundUser = await getPrismaClient(c.env).user.findUnique({
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

    const userInfo = await getPrismaClient(c.env).user.findUnique({
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