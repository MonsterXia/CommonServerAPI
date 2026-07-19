/**
 * Shared password validation utilities
 */

export interface PasswordValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate password strength requirements
 * @param password - The password to validate
 * @returns Validation result with error message if invalid
 */
export const validatePasswordStrength = (password: string): PasswordValidationResult => {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 6 || password.length > 128) {
        return { valid: false, error: 'Password must be between 6 and 128 characters long' };
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasSpecialChar) {
        return {
            valid: false,
            error: 'Password must contain at least one uppercase letter, one lowercase letter, and one special character'
        };
    }

    return { valid: true };
};

/**
 * Validate password length only (for less strict requirements)
 * @param password - The password to validate
 * @param minLength - Minimum length (default: 6)
 * @param maxLength - Maximum length (default: 128)
 * @returns Validation result with error message if invalid
 */
export const validatePasswordLength = (
    password: string,
    minLength: number = 6,
    maxLength: number = 128
): PasswordValidationResult => {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < minLength || password.length > maxLength) {
        return {
            valid: false,
            error: `Password must be between ${minLength} and ${maxLength} characters long`
        };
    }

    return { valid: true };
};
