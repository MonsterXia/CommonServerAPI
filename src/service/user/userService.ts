import bcrypt from 'bcryptjs';
import { Context } from 'hono';
import { UserPasswordLoginRequestPayload, UserRegisterRequestPayload } from "../../model/user/user";
import { bcryptSaltRounds } from '../../common/config/bcryptConfig';
import { getPrismaClient } from '../../lib/prisma';
import { clearAuthCookie, generateToken, setAuthCookie } from '../../lib/jwt';
import { buildContextJson, bussinessStatusCode } from '../../util/hono';

export const userRegisterParser = (data: any): UserRegisterRequestPayload => {
    if (!data.username || !data.password) {
        throw new Error('Missing username or password');
    }
    return {
        username: data.username.toString(),
        password: data.password.toString()
    }
}

export const userPasswordLoginParser = (data: any): UserPasswordLoginRequestPayload => {
    if (!data.username || !data.password) {
        throw new Error('Missing username or password');
    }
    return {
        username: data.username.toString(),
        password: data.password.toString()
    }
}

export const userRegisterService = async (c: Context, user: UserRegisterRequestPayload) => {
    try {
        const exist = await checkUsernameExistService(c, user.username);
        if (exist) {
            throw new Error('Username already exists');
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

        return {
            user: userWithoutPassword,
            token
        };
    } catch (error) {
        throw error;
    }
}

export const checkUsernameExistService = async (c: Context, username: string): Promise<boolean> => {
    try {
        if (!username || username.trim() === '') {
            return true;
        }

        const user = await getPrismaClient(c.env).user.findUnique({
            where: {
                username
            },
            select: {
                id: true
            }
        })
        return user !== null;
    } catch (error) {
        throw error;
    }
}

export const userPasswordLoginService = async (c: Context, user: UserPasswordLoginRequestPayload) => {
    try {
        const failedResponse = {
            success: false,
            message: 'Invalid username or password'
        };
        const exist = await checkUsernameExistService(c, user.username);
        if (!exist) {
            return failedResponse;
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

        return {
            success: true,
            token
        };
    } catch (error) {
        throw error;
    }
}

export const userLogoutService = async (c: Context) => {
    try {
        clearAuthCookie(c);
        return true;
    } catch (error) {
        throw error;
    }
}

export const getCurrentUserService = async (c: Context) => {
    const user = c.get('user');
    const failedResponse = {
        success: false,
        message: 'Invalid username'
    };
    const exist = await checkUsernameExistService(c, user.username);
    if (!exist) {
        return failedResponse;
    }

    const userInfo = await getPrismaClient(c.env).user.findUnique({
        where: { username: user.username },
        include: {
            hypergryphAccount: true
        }
    });

    return userInfo;
}