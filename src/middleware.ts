import { defineMiddleware } from 'astro:middleware';
import { validateSession } from './server/auth/session';

export const onRequest = defineMiddleware(async (context, next) => {
  // If prerendering static routes, pass through directly
  if (context.isPrerendered) {
    return next();
  }

  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // Extract session from cookie
  const sessionCookie = context.cookies.get('goshipping_session')?.value;
  let currentUser = null;

  if (sessionCookie) {
    const session = await validateSession(sessionCookie);
    if (session) {
      currentUser = session.user;
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
