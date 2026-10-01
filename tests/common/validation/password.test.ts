import { describe, expect, it } from 'vitest';
import { validatePasswordStrength } from '@/common/validation/password';

describe('bcrypt password limits', () => {
    it('accepts a strong password at the 72-byte boundary', () => {
        expect(validatePasswordStrength('Aa!' + 'x'.repeat(69)).valid).toBe(true);
    });
    it('rejects passwords whose suffix would be silently discarded by bcrypt', () => {
        expect(validatePasswordStrength('Aa!' + 'x'.repeat(70)).valid).toBe(false);
    });
    it('checks UTF-8 bytes rather than character count', () => {
        expect(validatePasswordStrength('Aa!' + '密'.repeat(24)).valid).toBe(false);
    });
});
