import type { AppEnvironment } from './origin';

/**
 * Get the frontend base URL based on the environment
 */
export const getFrontendBaseUrl = (environment: AppEnvironment): string => {
    if (environment === 'development') {
        return 'http://localhost:5173';
    }
    return 'https://post.246801357.xyz';
};
