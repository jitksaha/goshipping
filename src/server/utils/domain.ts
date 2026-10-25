/**
 * Dynamic Domain & URL Resolution Utility
 * 
 * Automatically resolves the active site origin, canonical URLs, and asset URLs
 * across any deployment domain, reverse proxy, staging URL, or localhost port.
 */

export function getSiteOrigin(request?: Request): string {
  // 1. Try reading from incoming HTTP request headers (reverse proxy / direct)
  if (request) {
    try {
      const forwardedProto = request.headers.get('x-forwarded-proto');
      const forwardedHost = request.headers.get('x-forwarded-host');
      const host = forwardedHost || request.headers.get('host');

      if (host) {
        // Detect protocol (default https for production domains, http for localhost/local IPs)
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.');
        const proto = forwardedProto || (isLocal ? 'http' : 'https');
        return `${proto}://${host}`;
      }
    } catch {
      // In non-standard environments, fallback to next checks
    }
  }

  // 2. Check environment variables
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.PUBLIC_SITE_URL) {
      return process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
    }
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/$/, '');
    }
  }

  // 3. Fallback to production default
  return 'https://www.goshipping.com.bd';
}

/**
 * Generate a canonical URL for the given route pathname
 */
export function getCanonicalUrl(pathname: string = '/', request?: Request): string {
  const origin = getSiteOrigin(request);
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return cleanPath === '/' ? origin : `${origin}${cleanPath}`;
}

/**
 * Generate an absolute asset URL (e.g. for Open Graph images, logos, twitter cards)
 */
export function getAssetUrl(assetPath: string, request?: Request): string {
  if (!assetPath) return '';
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath;
  }
  const origin = getSiteOrigin(request);
  const cleanPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${origin}${cleanPath}`;
}

/**
 * Extract just the hostname (domain without protocol or port)
 */
export function getHostname(request?: Request): string {
  const origin = getSiteOrigin(request);
  try {
    const url = new URL(origin);
    return url.hostname;
  } catch {
    return 'goshipping.com.bd';
  }
}
