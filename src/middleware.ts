import { defineMiddleware } from 'astro:middleware';
import { validateSession, createSession, DEFAULT_ACCOUNTS, type AuthUser } from './server/auth/session';

export const onRequest = defineMiddleware(async (context, next) => {
  // If prerendering static routes, pass through directly
  if (context.isPrerendered) {
    return next();
  }

  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const isSecure = url.protocol === 'https:';

  // Extract hostname to identify subdomain routing (admin.goshipping.com.bd)
  const rawHost =
    context.request.headers.get('x-forwarded-host') ||
    context.request.headers.get('x-original-host') ||
    context.request.headers.get('host') ||
    url.hostname;
  const hostname = rawHost.split(':')[0].toLowerCase();
  const isAdminHost =
    hostname.startsWith('admin.') ||
    hostname.startsWith('superadmin.') ||
    hostname.includes('admin.goshipping');
  const isGoshippingDomain = hostname.includes('goshipping.com.bd');
  const cookieDomain = isGoshippingDomain ? '.goshipping.com.bd' : undefined;

  // 1. Separate Admin and Customer Session Resolution
  // Admin Gateway (admin.goshipping.com.bd or /admin/*) uses 'goshipping_admin_session'
  // Customer Gateway (goshipping.com.bd, /dashboard, etc.) uses 'goshipping_session'
  const isAdminContext = isAdminHost || pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const urlAuthToken = url.searchParams.get('auth_token') || url.searchParams.get('impersonate_token');

  let adminSessionCookie = context.cookies.get('goshipping_admin_session')?.value;
  let customerSessionCookie = context.cookies.get('goshipping_session')?.value;

  if (urlAuthToken) {
    if (isAdminContext) {
      adminSessionCookie = urlAuthToken;
    } else {
      customerSessionCookie = urlAuthToken;
    }
  }

  // Fallback to raw cookie header if needed
  if (!adminSessionCookie || !customerSessionCookie) {
    const rawCookie = context.request.headers.get('cookie') || '';
    if (!adminSessionCookie) {
      const match = rawCookie.match(/(?:^|;\s*)goshipping_admin_session=([^;]+)/);
      if (match) adminSessionCookie = decodeURIComponent(match[1]);
    }
    if (!customerSessionCookie) {
      const match = rawCookie.match(/(?:^|;\s*)goshipping_session=([^;]+)/);
      if (match) customerSessionCookie = decodeURIComponent(match[1]);
    }
  }

  let currentUser: AuthUser | null = null;
  let activeSessionCookie: string | undefined;

  if (isAdminContext) {
    // In Admin context, check admin session first
    if (adminSessionCookie) {
      const session = await validateSession(adminSessionCookie);
      if (session && session.user.status !== 'suspended' && session.user.role !== 'customer') {
        currentUser = session.user;
        activeSessionCookie = adminSessionCookie;
      }
    }
    // Backward compatibility: if no admin session found yet, check goshipping_session if user is staff
    if (!currentUser && customerSessionCookie) {
      const session = await validateSession(customerSessionCookie);
      if (session && session.user.status !== 'suspended' && session.user.role !== 'customer') {
        currentUser = session.user;
        activeSessionCookie = customerSessionCookie;
        // Auto-upgrade / store into goshipping_admin_session so future requests are completely isolated
        context.cookies.set('goshipping_admin_session', customerSessionCookie, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: isSecure,
          domain: cookieDomain,
          maxAge: 30 * 24 * 60 * 60,
        });
      }
    }

    if (currentUser && activeSessionCookie) {
      // Sliding window refresh for admin session
      context.cookies.set('goshipping_admin_session', activeSessionCookie, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        domain: cookieDomain,
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  } else {
    // In Customer context, strictly use customer session
    if (customerSessionCookie) {
      const session = await validateSession(customerSessionCookie);
      if (session && session.user.status !== 'suspended') {
        currentUser = session.user;
        activeSessionCookie = customerSessionCookie;

        // Sliding window refresh for customer session
        context.cookies.set('goshipping_session', activeSessionCookie, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: isSecure,
          domain: cookieDomain,
          maxAge: 30 * 24 * 60 * 60,
        });
      }
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
      context.cookies.set('goshipping_admin_session', sessionId, {
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
      if (currentUser && ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'].includes(currentUser.role)) {
        return context.redirect('/admin');
      }
      return context.redirect('/admin/login');
    } else if (pathname === '/login') {
      return context.redirect('/admin/login');
    } else if (pathname === '/admin/login') {
      if (currentUser && ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'].includes(currentUser.role)) {
        return context.redirect('/admin');
      }
    } else if (pathname.startsWith('/admin')) {
      if (!currentUser) {
        return context.redirect(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
      }
      // If currently impersonating a customer, allow them to view customer dashboard directly
      const isStaff = ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'].includes(currentUser.role);
      if (!isStaff && !currentUser.impersonatedBy) {
        const dest = isGoshippingDomain ? 'https://goshipping.com.bd/dashboard?error=unauthorized_admin' : '/dashboard?error=unauthorized_admin';
        return context.redirect(dest);
      }
    } else if (pathname.startsWith('/dashboard')) {
      if (!currentUser) {
        return context.redirect(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
      }
      // Allow rendering customer dashboard directly on admin host when logged in/impersonating!
    } else {
      // Any customer marketing pages requested on admin subdomain redirect to primary domain
      if (isGoshippingDomain) {
        const targetSearch = url.search || '';
        return context.redirect(`https://goshipping.com.bd${pathname}${targetSearch}`);
      }
    }
  } else {
    // 4. Standard Domain Routing (goshipping.com.bd or localhost)
    // Protect admin operations routes
    if (pathname === '/admin/login') {
      if (currentUser && ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'].includes(currentUser.role)) {
        return context.redirect('/admin');
      }
      // Allow unauthenticated staff to view /admin/login
    } else if (pathname.startsWith('/admin')) {
      if (!currentUser) {
        return context.redirect(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
      }
      // STRICT RBAC: Only authorized staff can access the admin control center
      const isStaff = ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'].includes(currentUser.role);
      if (!isStaff) {
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

  // Add comprehensive enterprise security headers
  const response = await next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
  if (isSecure || isGoshippingDomain) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return response;
});
