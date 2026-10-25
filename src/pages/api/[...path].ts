import type { APIRoute } from 'astro';
import { app } from '../../server/api/app';

export const ALL: APIRoute = async (context) => {
  const response = await app.fetch(context.request);

  // If Hono set a Set-Cookie header (login, signup, impersonation, logout),
  // delegate cleanly to Astro's context.cookies so the browser receives ONE authoritative cookie
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    const isLogout = setCookieHeader.includes('goshipping_session=;') || setCookieHeader.includes('Max-Age=0');
    if (isLogout) {
      context.cookies.delete('goshipping_session', { path: '/' });
    } else {
      const sessionMatch = setCookieHeader.match(/goshipping_session=([^;]+)/);
      if (sessionMatch && sessionMatch[1]) {
        const isSecure = context.url.protocol === 'https:';
        context.cookies.set('goshipping_session', sessionMatch[1], {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: isSecure,
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
