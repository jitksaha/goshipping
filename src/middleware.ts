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

  // Extract hostname to identify subdomain routing (admin.goshipping.com.bd)
  const rawHost = context.request.headers.get('host') || url.hostname;
  const hostname = rawHost.split(':')[0].toLowerCase();
  const isAdminHost =
    hostname.startsWith('admin.') ||
    hostname.startsWith('superadmin.') ||
    hostname.includes('admin.goshipping');
  const isGoshippingDomain = hostname.includes('goshipping.com.bd');
  const cookieDomain = isGoshippingDomain ? '.goshipping.com.bd' : undefined;

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

      // Sliding session window: Refresh cookie expiry across both main domain & admin subdomain
      context.cookies.set('goshipping_session', sessionCookie, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        domain: cookieDomain,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }
  }

  // 2. Development-Only Graceful Session Persistence
  // Strictly disabled in production or whenever accessing via goshipping.com.bd domains
  const isProduction = process.env.NODE_ENV === 'production' || hostname.includes('goshipping.com.bd');
  const isLocalHost = !isProduction && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0');
  if (!currentUser && isLocalHost) {
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
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

  // 3. Subdomain-Specific Routing (admin.goshipping.com.bd or admin.*)
  if (isAdminHost) {
    // API and asset routes pass through unimpeded
    if (pathname.startsWith('/api') || pathname.startsWith('/_astro') || pathname.startsWith('/brand')) {
      // Pass through
    } else if (pathname === '/' || pathname === '') {
      if (currentUser?.role === 'super_admin') {
        return context.redirect('/admin');
      }
      return context.redirect('/admin/login');
    } else if (pathname === '/login') {
      return context.redirect('/admin/login');
    } else if (pathname === '/admin/login') {
      if (currentUser?.role === 'super_admin') {
        return context.redirect('/admin');
      }
    } else if (pathname.startsWith('/admin')) {
      if (!currentUser) {
        return context.redirect(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
      }
      if (currentUser.role !== 'super_admin') {
        const dest = isGoshippingDomain ? 'https://goshipping.com.bd/dashboard?error=unauthorized_admin' : '/dashboard?error=unauthorized_admin';
        return context.redirect(dest);
      }
    } else if (pathname.startsWith('/dashboard')) {
      const dest = isGoshippingDomain ? 'https://goshipping.com.bd/dashboard' : '/dashboard';
      return context.redirect(dest);
    } else {
      // Any customer marketing pages requested on admin subdomain redirect to primary domain
      if (isGoshippingDomain) {
        return context.redirect(`https://goshipping.com.bd${pathname}`);
      }
    }
  } else {
    // 4. Standard Domain Routing (goshipping.com.bd)
    // Protect admin operations routes
    if (pathname === '/admin/login') {
      if (currentUser?.role === 'super_admin') {
        return context.redirect('/admin');
      }
      // Allow unauthenticated Super Admins to view /admin/login
    } else if (pathname.startsWith('/admin')) {
      if (!currentUser) {
        return context.redirect(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
      }
      // STRICT RBAC: Only super_admin can access the admin control center
      if (currentUser.role !== 'super_admin') {
        return context.redirect('/dashboard?error=unauthorized_admin');
      }
    }

    // Protect customer dashboard routes
    if (pathname.startsWith('/dashboard')) {
      if (!currentUser) {
        return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    }
  }

  // Add security headers
  const response = await next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
});
