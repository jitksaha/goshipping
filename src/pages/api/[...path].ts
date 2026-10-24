import type { APIRoute } from 'astro';
import { app } from '../../server/api/app';

export const ALL: APIRoute = async (context) => {
  const response = await app.fetch(context.request);

  // Synchronize any Set-Cookie headers with Astro's context.cookies
  // to ensure Astro's SSR engine writes the cookie reliably into the HTTP response
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const sessionMatch = setCookie.match(/goshipping_session=([^;]+)/);
    if (sessionMatch) {
      context.cookies.set('goshipping_session', sessionMatch[1], {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  }

  return response;
};
