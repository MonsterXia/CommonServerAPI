const permittedDomain = '246801357.xyz';

export type AppEnvironment = 'development' | 'production';

export const isAllowedOrigin = (origin: string, environment: AppEnvironment) => {
    try {
        const parsedOrigin = new URL(origin);
        const isCanonicalOrigin = parsedOrigin.origin === origin;
        const isProductionOrigin = parsedOrigin.protocol === 'https:'
            && parsedOrigin.hostname.endsWith(`.${permittedDomain}`);
        const isLocalDevelopmentOrigin = environment === 'development'
            && parsedOrigin.hostname === 'localhost';

        return isCanonicalOrigin && (isProductionOrigin || isLocalDevelopmentOrigin);
    } catch {
        return false;
    }
};

export const getCORSAllowedOrigin = (origin: string, environment: AppEnvironment) => {
    return isAllowedOrigin(origin, environment) ? origin : null;
};
