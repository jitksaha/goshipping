import type { APIRoute } from 'astro';
import { app } from '../../server/api/app';

export const ALL: APIRoute = async (context) => {
  const response = await app.fetch(context.request);

  // If Hono set a Set-Cookie header (login, signup, impersonation, logout),
  // delegate cleanly to Astro's context.cookies so the browser receives ONE authoritative cookie
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    const rawHost =
      context.request.headers.get('x-forwarded-host') ||
      context.request.headers.get('x-original-host') ||
      context.request.headers.get('host') ||
      context.url.hostname;
    const hostname = rawHost.split(':')[0].toLowerCase();
    const isGoshippingDomain = hostname.includes('goshipping.com.bd');
    const cookieDomain = isGoshippingDomain ? '.goshipping.com.bd' : undefined;

    const isLogout =
      setCookieHeader.includes('goshipping_session=;') ||
      setCookieHeader.includes('goshipping_admin_session=;') ||
      setCookieHeader.includes('Max-Age=0');

    if (isLogout) {
      if (setCookieHeader.includes('goshipping_admin_session')) {
        context.cookies.delete('goshipping_admin_session', { path: '/', domain: cookieDomain });
      }
      if (setCookieHeader.includes('goshipping_session')) {
        context.cookies.delete('goshipping_session', { path: '/', domain: cookieDomain });
      }
    } else {
      const isSecure = context.url.protocol === 'https:';
      const adminMatch = setCookieHeader.match(/goshipping_admin_session=([^;]+)/);
      if (adminMatch && adminMatch[1]) {
        context.cookies.set('goshipping_admin_session', adminMatch[1], {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: isSecure,
          domain: cookieDomain,
          maxAge: 30 * 24 * 60 * 60, // 30 days
        });
      }
      const sessionMatch = setCookieHeader.match(/goshipping_session=([^;]+)/);
      if (sessionMatch && sessionMatch[1]) {
        context.cookies.set('goshipping_session', sessionMatch[1], {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: isSecure,
          domain: cookieDomain,
          maxAge: 30 * 24 * 60 * 60, // 30 days
        });
      }
    }

    // Strip set-cookie from Hono headers to prevent duplicate conflicting headers in Node/browser
    const newHeaders = new Headers(response.headers);
    newHeaders.delete('set-cookie');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  return response;
};
