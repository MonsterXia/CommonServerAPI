import type { Context } from 'hono';
import bcrypt from 'bcryptjs';
import { bcryptSaltRounds } from '@/common/config/bcryptConfig';
import { validateEmail } from '@/common/validation/email';
import { validatePasswordStrength } from '@/common/validation/password';
import { generateVerificationCode, sha256Hash, sendVerificationEmail } from '@/common/service/verificationService';
import VerificationTemplate from '@/common/Email/template/verificationTemplate';
import { clearAuthCookie } from '@/lib/jwt';
import { getJWTSecret } from '@/lib/jwtCore';
import { buildStandardServerResponse as result } from '@/util/hono';

function identity(data: unknown) {
    if (!data || typeof data !== 'object') return null;
    const input = data as Record<string, unknown>;
    if (typeof input.username !== 'string' || !input.username.trim() || input.username.length > 30 || typeof input.email !== 'string') return null;
    const email = validateEmail(input.email);
    return email.valid ? { username: input.username, email: email.normalizedEmail! } : null;
}
const codeHash = (c: Context, username: string, code: string) => sha256Hash(`${getJWTSecret(c)}:${username}:${code}`);

export async function sendPasswordResetCode(c: Context, data: unknown) {
    const account = identity(data);
    if (!account) return result(false, 'Invalid username or email', null, null, 400);
    const db = c.env.DB as D1Database;
    const user = await db.prepare('SELECT id FROM User WHERE username = ? AND email = ?').bind(account.username, account.email).first();
    // Do not disclose whether an account/email pair exists.
    const sent = () => result(true, 'If the account matches, a verification code will be sent', null, null, 200);
    if (!user) return sent();
    const now = Date.now();
    const code = generateVerificationCode();
    const hash = await codeHash(c, account.username, code);
    const stored = await db.prepare(`INSERT INTO PasswordResetChallenge (username,email,codeHash,expiresAt,sentAt,attempts)
        VALUES (?,?,?,?,?,0) ON CONFLICT(username) DO UPDATE SET email=excluded.email,codeHash=excluded.codeHash,
        expiresAt=excluded.expiresAt,sentAt=excluded.sentAt,attempts=0 WHERE PasswordResetChallenge.expiresAt <= ?`)
        .bind(account.username, account.email, hash, now + 300000, now, now).run();
    if (!stored.meta.changes) return sent();
    const mail = await sendVerificationEmail(account.email, 'Reset your password', VerificationTemplate({ code }));
    if (!mail.success) {
        await db.prepare('DELETE FROM PasswordResetChallenge WHERE username = ? AND codeHash = ?').bind(account.username, hash).run();
        return result(false, 'Could not send verification email', null, null, 503);
    }
    return sent();
}

export async function resetPassword(c: Context, data: unknown) {
    const account = identity(data);
    const input = data as Record<string, unknown> | null;
    if (!account || typeof input?.code !== 'string' || !/^\d{6}$/.test(input.code) || typeof input.password !== 'string') {
        return result(false, 'Invalid reset request', null, null, 400);
    }
    const policy = validatePasswordStrength(input.password);
    if (!policy.valid) return result(false, 'Password validation failed', null, policy.error, 400);
    const db = c.env.DB as D1Database;
    const now = Date.now();
    const hash = await codeHash(c, account.username, input.code);
    const challenge = await db.prepare(`SELECT codeHash FROM PasswordResetChallenge WHERE username=? AND email=? AND expiresAt>? AND attempts<5`)
        .bind(account.username, account.email, now).first<{ codeHash: string }>();
    if (!challenge || challenge.codeHash !== hash) {
        await db.prepare('UPDATE PasswordResetChallenge SET attempts=MIN(attempts+1,5) WHERE username=? AND email=?').bind(account.username, account.email).run();
        return result(false, 'Invalid or expired verification code', null, null, 400);
    }
    const password = await bcrypt.hash(input.password, bcryptSaltRounds);
    // D1 batch is transactional: only one submission can consume the challenge.
    const results = await db.batch([
        db.prepare(`UPDATE User SET password=?,sessionVersion=sessionVersion+1,updatedAt=CURRENT_TIMESTAMP WHERE username=? AND email=?
            AND EXISTS(SELECT 1 FROM PasswordResetChallenge WHERE username=? AND email=? AND codeHash=? AND expiresAt>? AND attempts<5)`)
            .bind(password, account.username, account.email, account.username, account.email, hash, Date.now()),
        db.prepare('DELETE FROM PasswordResetChallenge WHERE username=? AND codeHash=?').bind(account.username, hash),
    ]);
    if (!results[0].meta.changes) return result(false, 'Invalid or expired verification code', null, null, 400);
    clearAuthCookie(c);
    return result(true, 'Password reset; please sign in again', null, null, 200);
}
