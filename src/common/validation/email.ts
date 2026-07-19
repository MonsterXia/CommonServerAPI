/**
 * Shared email validation utilities
 */
import Joi from 'joi';

export interface EmailValidationResult {
    valid: boolean;
    normalizedEmail?: string;
    error?: string;
}

/**
 * Normalize email address (trim and lowercase)
 * @param email - The email to normalize
 * @returns Normalized email
 */
export const normalizeEmail = (email: string): string => {
    return email.trim().toLowerCase();
};

/**
 * Validate email format using Joi
 * @param email - The email to validate
 * @returns Validation result with normalized email if valid
 */
export const validateEmailFormat = (email: string): EmailValidationResult => {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }

    const normalizedEmail = normalizeEmail(email);
    const emailSchema = Joi.string().email();
    const { error } = emailSchema.validate(normalizedEmail);

    if (error) {
        return { valid: false, error: 'Email format is invalid' };
    }

    return { valid: true, normalizedEmail };
};

/**
 * Validate email and check if it's not empty
 * @param email - The email to validate
 * @returns Validation result with normalized email if valid
 */
export const validateEmail = (email: unknown): EmailValidationResult => {
    if (!email) {
        return { valid: false, error: 'Email is required' };
    }

    return validateEmailFormat(String(email));
};
