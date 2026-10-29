import type { Context } from 'hono';
import bcrypt from 'bcryptjs';
import { bcryptSaltRounds } from '@/common/config/bcryptConfig';
import VerificationTemplate from '@/common/Email/template/verificationTemplate';
import { generateVerificationCode, sha256Hash, sendVerificationEmail } from '@/common/service/verificationService';
import { getJWTSecret } from '@/lib/jwtCore';
import { generateToken, setAuthCookie } from '@/lib/jwt';
import { getPrismaClient } from '@/lib/prisma';
import type { UserRegisterRequestPayload } from '@/model/user/user';
import { buildStandardServerResponse as result } from '@/util/hono';

const hashCode = (c: Context, email: string, code: string) =>
    sha256Hash(`${getJWTSecret(c)}:registration:${email}:${code}`);

export async function sendRegistrationCode(c: Context, email: string) {
    const db = c.env.DB as D1Database;
    if (await db.prepare('SELECT id FROM User WHERE email=?').bind(email).first()) {
        return result(false, 'Email already exists', null, null, 409);
    }
    const code = generateVerificationCode();
    const hash = await hashCode(c, email, code);
    const now = Date.now();
    const stored = await db.prepare(`INSERT INTO RegistrationChallenge(email,codeHash,expiresAt) VALUES (?,?,?)
        ON CONFLICT(email) DO UPDATE SET codeHash=excluded.codeHash,expiresAt=excluded.expiresAt
        WHERE RegistrationChallenge.expiresAt<=?`).bind(email, hash, now + 300000, now).run();
    if (!stored.meta.changes) return result(false, 'Verification code already sent', null, null, 429);
    const mail = await sendVerificationEmail(email, 'Verification Code', VerificationTemplate({ code }));
    if (!mail.success) {
        await db.prepare('DELETE FROM RegistrationChallenge WHERE email=? AND codeHash=?').bind(email, hash).run();
        return result(false, 'Failed to send verification code', null, null, 500);
    }
    return result(true, 'Verification code sent successfully', null, null, 200);
}

export async function registerUser(c: Context, user: UserRegisterRequestPayload) {
    try {
        const db = c.env.DB as D1Database;
        const conflict = () => db.prepare('SELECT id FROM User WHERE username=? OR email=?')
            .bind(user.username, user.email).first();
        if (await conflict()) return result(false, 'Username or email already exists', null, null, 409);
        const hash = await hashCode(c, user.email, user.registrationCode);
        const valid = await db.prepare('SELECT email FROM RegistrationChallenge WHERE email=? AND codeHash=? AND expiresAt>?')
            .bind(user.email, hash, Date.now()).first();
        if (!valid) return result(false, 'Invalid or expired verification code', null, null, 400);
        const password = await bcrypt.hash(user.password, bcryptSaltRounds);
        const now = Date.now();
        // The insert and one-time consumption commit together. A conflict inserts nothing
        // and leaves the challenge available for a different username.
        const inserted = await db.batch<{ id: number }>([
            db.prepare(`INSERT INTO User(username,email,password,createdAt,updatedAt)
                SELECT ?,?,?,?,? WHERE EXISTS (
                    SELECT 1 FROM RegistrationChallenge WHERE email=? AND codeHash=? AND expiresAt>?
                ) ON CONFLICT DO NOTHING RETURNING id`)
                .bind(user.username, user.email, password, new Date(now).toISOString(), new Date(now).toISOString(), user.email, hash, now),
            db.prepare('DELETE FROM RegistrationChallenge WHERE email=? AND codeHash=? AND changes()=1')
                .bind(user.email, hash),
        ]);
        const id = inserted[0].results[0]?.id;
        if (id === undefined) {
            return await conflict()
                ? result(false, 'Username or email already exists', null, null, 409)
                : result(false, 'Invalid or expired verification code', null, null, 400);
        }
        const newUser = await getPrismaClient().user.findUniqueOrThrow({ where: { id } });
        const token = await generateToken(c, { username: newUser.username, sessionVersion: newUser.sessionVersion });
        setAuthCookie(c, token);
        const { password: _, ...publicUser } = newUser;
        return result(true, 'User registered successfully', { user: publicUser, token }, null, 201);
    } catch {
        return result(false, 'User registration failed', null, null, 500);
    }
}
