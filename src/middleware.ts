import { defineMiddleware } from 'astro:middleware';
import { validateSession, createSession, DEFAULT_ACCOUNTS } from './server/auth/session';

export const onRequest = defineMiddleware(async (context, next) => {
  // If prerendering static routes, pass through directly
  if (context.isPrerendered) {
    return next();
  }

  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const isSecure = url.protocol === 'https:';

  // 1. Extract session from cookie (Astro cookie jar + raw cookie header fallback)
  let sessionCookie = context.cookies.get('goshipping_session')?.value;
  if (!sessionCookie) {
    const rawCookie = context.request.headers.get('cookie') || '';
    const match = rawCookie.match(/(?:^|;\s*)goshipping_session=([^;]+)/);
    if (match) {
      sessionCookie = decodeURIComponent(match[1]);
    }
  }

  let currentUser = null;

  if (sessionCookie) {
    const session = await validateSession(sessionCookie);
    if (session) {
      currentUser = session.user;

      // Sliding session window: Refresh cookie expiry so active users never experience unexpected logout
      context.cookies.set('goshipping_session', sessionCookie, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }
  }

  // 2. Development & Localhost Graceful Session Persistence
  // On local developer environments (localhost / 127.0.0.1), if the session is absent or expired,
  // automatically restore the appropriate role session instead of abruptly kicking the developer to /login
  const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '0.0.0.0';
  if (!currentUser && isLocalHost) {
    if (pathname.startsWith('/admin')) {
      const defaultAdmin = DEFAULT_ACCOUNTS[0]; // Super Admin
      const { sessionId } = await createSession(defaultAdmin, context.request.headers.get('user-agent') || 'dev');
      currentUser = defaultAdmin;
      context.cookies.set('goshipping_session', sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 30 * 24 * 60 * 60,
      });
    } else if (pathname.startsWith('/dashboard')) {
      const defaultCustomer = DEFAULT_ACCOUNTS[4]; // Apex Textiles Ltd Customer
      const { sessionId } = await createSession(defaultCustomer, context.request.headers.get('user-agent') || 'dev');
      currentUser = defaultCustomer;
      context.cookies.set('goshipping_session', sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  }

  // Attach user to Astro locals
  context.locals.user = currentUser;

  // Protect customer dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!currentUser) {
      return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }

  // Protect admin operations routes
  if (pathname.startsWith('/admin')) {
    if (!currentUser) {
      return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
    // Only internal staff roles can access admin operations
    const staffRoles = ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'];
    if (!staffRoles.includes(currentUser.role)) {
      return context.redirect('/dashboard?error=unauthorized_admin');
    }
  }

  // Add security headers
  const response = await next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
});
