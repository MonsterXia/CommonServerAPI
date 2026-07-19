/**
 * Shared verification code service
 * Handles verification code generation, storage, and email sending
 */
import { getEmailManager } from '@/lib/emailManager';
import { getKV } from '@/lib/KV';

export interface VerificationCodeConfig {
    /** KV key prefix for the verification code */
    keyPrefix: string;
    /** TTL in seconds for the verification code */
    ttlSeconds: number;
    /** Email subject */
    emailSubject: string;
    /** React email template component */
    emailTemplate: (code: string) => React.ReactNode;
}

export interface SendVerificationCodeResult {
    success: boolean;
    error?: string;
}

/**
 * Generate a random verification code
 * @param length - Length of the code (default: 6)
 * @returns Random numeric code
 */
export const generateVerificationCode = (length: number = 6): string => {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

/**
 * Generate a random token (for registration flows)
 * @param length - Length of the token (default: 32)
 * @returns Random hex string
 */
export const generateVerificationToken = (length: number = 32): string => {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * SHA-256 hash a value (for storing tokens securely)
 * @param value - Value to hash
 * @returns Hex-encoded hash
 */
export const sha256Hash = async (value: string): Promise<string> => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * Constant-time string comparison (to prevent timing attacks)
 * @param left - First string
 * @param right - Second string
 * @returns Whether strings are equal
 */
export const constantTimeEquals = (left: string, right: string): boolean => {
    if (left.length !== right.length) {
        return false;
    }

    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
};

/**
 * Check if a verification code already exists for the given key
 * @param key - KV key
 * @returns Whether the code exists
 */
export const checkVerificationCodeExists = async (key: string): Promise<boolean> => {
    const KV = getKV();
    if (!KV) return false;
    const existing = await KV.get(key);
    return existing !== null;
};

/**
 * Store verification code in KV
 * @param key - KV key
 * @param code - Verification code or token hash
 * @param ttlSeconds - TTL in seconds
 */
export const storeVerificationCode = async (
    key: string,
    code: string,
    ttlSeconds: number
): Promise<void> => {
    const KV = getKV();
    if (!KV) {
        throw new Error('KV storage is not available');
    }
    await KV.put(key, code, { expirationTtl: ttlSeconds });
};

/**
 * Retrieve verification code from KV
 * @param key - KV key
 * @returns Stored code or null
 */
export const getVerificationCode = async (key: string): Promise<string | null> => {
    const KV = getKV();
    if (!KV) return null;
    return KV.get(key);
};

/**
 * Delete verification code from KV
 * @param key - KV key
 */
export const deleteVerificationCode = async (key: string): Promise<void> => {
    const KV = getKV();
    if (!KV) return;
    await KV.delete(key);
};

/**
 * Send verification code via email
 * @param email - Recipient email
 * @param subject - Email subject
 * @param template - React email template
 * @returns Result with success status
 */
export const sendVerificationEmail = async (
    email: string,
    subject: string,
    template: React.ReactNode
): Promise<SendVerificationCodeResult> => {
    try {
        const emailManager = getEmailManager();
        const result = await emailManager.sendEmail(email, subject, template);

        if (result.error !== null) {
            return {
                success: false,
                error: result.error instanceof Error ? result.error.message : 'Unknown error while sending email'
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send email'
        };
    }
};

/**
 * Complete flow: generate, store, and send verification code
 * @param email - Recipient email
 * @param config - Verification code configuration
 * @returns Result with success status and the generated code
 */
export const generateAndSendVerificationCode = async (
    email: string,
    config: VerificationCodeConfig
): Promise<SendVerificationCodeResult & { code?: string }> => {
    const code = generateVerificationCode();
    const key = `${config.keyPrefix}${email}`;

    // Check if code already exists
    const exists = await checkVerificationCodeExists(key);
    if (exists) {
        return {
            success: false,
            error: 'A verification code has already been sent. Please wait before requesting another one.'
        };
    }

    // Store the code
    await storeVerificationCode(key, code, config.ttlSeconds);

    // Send the email
    const template = config.emailTemplate(code);
    const sendResult = await sendVerificationEmail(email, config.emailSubject, template);

    if (!sendResult.success) {
        // Clean up the stored code if email fails
        await deleteVerificationCode(key);
        return sendResult;
    }

    return { success: true, code };
};

/**
 * Verify a submitted code against the stored code
 * @param email - User email
 * @param submittedCode - Code submitted by user
 * @param keyPrefix - KV key prefix
 * @returns Whether the code is valid
 */
export const verifySubmittedCode = async (
    email: string,
    submittedCode: string,
    keyPrefix: string
): Promise<boolean> => {
    const key = `${keyPrefix}${email}`;
    const storedCode = await getVerificationCode(key);

    if (!storedCode) {
        return false;
    }

    return constantTimeEquals(storedCode, submittedCode);
};

/**
 * Verify a submitted token against a stored hash
 * @param email - User email
 * @param submittedToken - Token submitted by user
 * @param keyPrefix - KV key prefix
 * @returns Whether the token is valid
 */
export const verifySubmittedToken = async (
    email: string,
    submittedToken: string,
    keyPrefix: string
): Promise<boolean> => {
    const key = `${keyPrefix}${email}`;
    const storedHash = await getVerificationCode(key);

    if (!storedHash) {
        return false;
    }

    const submittedHash = await sha256Hash(submittedToken);
    return constantTimeEquals(storedHash, submittedHash);
};
