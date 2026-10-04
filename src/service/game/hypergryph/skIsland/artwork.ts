/** Select a public official resource already supplied by Skland; no extra fetches. */
export function artworkUrl(value: unknown): string | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    try {
        const url = new URL(value);
        if (url.protocol === 'https:' && ['bbs.hycdn.cn', 'web.hycdn.cn', 'assets.skland.com'].includes(url.hostname)
            && !url.username && !url.password && !url.port) return url.href;
    } catch { /* Optional artwork must not prevent the record from being returned. */ }
    return undefined;
}
