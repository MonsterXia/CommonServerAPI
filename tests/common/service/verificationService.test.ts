import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateVerificationCode } from '@/common/service/verificationService';

describe('verification code generation', () => {
    afterEach(() => vi.restoreAllMocks());

    it('does not depend on predictable Math.random for authentication codes', () => {
        vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('insecure random source'); });
        expect(generateVerificationCode()).toMatch(/^[1-9][0-9]{5}$/);
    });
    it.each([0, -1, 1.5, 10, NaN])('rejects unsupported length %s', length => {
        expect(() => generateVerificationCode(length)).toThrow(RangeError);
    });
});
