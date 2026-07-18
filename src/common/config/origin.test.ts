import { describe, expect, it } from 'vitest';
import { getCORSAllowedOrigin, isAllowedOrigin } from './origin';

describe('CORS and CSRF origin policy', () => {
    it('allows the migrated Post frontend origin in production', () => {
        const origin = 'https://post.246801357.xyz';

        expect(isAllowedOrigin(origin, 'production')).toBe(true);
        expect(getCORSAllowedOrigin(origin, 'production')).toBe(origin);
    });

    it('allows localhost only in development', () => {
        expect(isAllowedOrigin('http://localhost:5173', 'development')).toBe(true);
        expect(isAllowedOrigin('http://localhost:3000', 'development')).toBe(true);
        expect(isAllowedOrigin('http://localhost:5173', 'production')).toBe(false);
        expect(getCORSAllowedOrigin('http://localhost:5173', 'production')).toBeNull();
    });

    it('allows trusted production subdomains during local development', () => {
        expect(isAllowedOrigin('https://app.246801357.xyz', 'development')).toBe(true);
    });

    it('does not treat the root domain as a wildcard subdomain', () => {
        expect(isAllowedOrigin('https://246801357.xyz', 'production')).toBe(false);
    });

    it('rejects lookalike domain suffixes', () => {
        const origin = 'https://attacker246801357.xyz';

        expect(isAllowedOrigin(origin, 'production')).toBe(false);
        expect(getCORSAllowedOrigin(origin, 'production')).toBeNull();
    });

    it('rejects insecure production origins', () => {
        expect(isAllowedOrigin('http://post.246801357.xyz', 'production')).toBe(false);
    });
});
