import { Hono } from 'hono';
import { z } from 'zod';
import {
  createSession,
  validateSession,
  destroySession,
  DEFAULT_ACCOUNTS,
  getAllAccounts,
  registerAccount,
  updateAccount,
  findAccountById,
  deleteAccount,
  findAccountByEmail,
  verifyAccountPassword,
  hasPermission,
  type AuthUser
} from '../auth/session';
import { ShipmentService } from '../services/shipment.service';
import { QuoteService } from '../services/quote.service';
import { TrackingService } from '../services/tracking.service';
import { WarehouseService } from '../services/warehouse.service';
import { AuditService } from '../services/audit.service';
import { RealtimeService } from '../services/realtime.service';
import { EmailService } from '../services/email.service';
import { TRACKING_STATUSES, normalizeStatusCode } from '../services/tracking-status';
import { checkDatabaseHealth } from '../db/client';

export const app = new Hono().basePath('/api');

// Helper to extract session from Cookie header
function getSessionIdFromHeader(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/goshipping_session=([^;]+)/);
  return match ? match[1] : null;
}

// Helper to check whether incoming request is HTTPS
function isRequestSecure(c: any): boolean {
  const forwardedProto = c.req.header('x-forwarded-proto');
  const forwardedSsl = c.req.header('x-forwarded-ssl');
  return forwardedProto === 'https' || forwardedSsl === 'on' || c.req.url.startsWith('https://');
}

// Session resolution middleware
app.use('*', async (c, next) => {
  const cookie = c.req.header('cookie');
  const sessionId = getSessionIdFromHeader(cookie);
  if (sessionId) {
    const session = await validateSession(sessionId);
    if (session) {
      c.set('user' as any, session.user);
      c.set('sessionId' as any, sessionId);
    }
  }
  await next();
});

// 01. Health Check
app.get('/health', async (c) => {
  const dbHealth = await checkDatabaseHealth();
  return c.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'GoShipping Enterprise API',
    version: '1.0.0',
    database: dbHealth
  });
});

// 02. Auth: Login
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4)
});

app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid login payload', details: parsed.error.issues }, 400);
    }

    const { email, password } = parsed.data;
    // Look up account in database / memory
    const account = await findAccountByEmail(email);

    if (!account) {
      return c.json({ error: 'Invalid credentials or user not found' }, 401);
    }

    const isValidPassword = verifyAccountPassword(email, password);
    if (!isValidPassword) {
      return c.json({ error: 'Incorrect password. Please try again.' }, 401);
    }

    const { sessionId, expiresAt } = await createSession(
      account,
      c.req.header('user-agent'),
      c.req.header('x-forwarded-for') || '127.0.0.1'
    );

    await AuditService.logAction({
      userId: account.id,
      userName: account.fullName,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: account.id,
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1'
    });

    const isSecure = isRequestSecure(c);
    const cookieString = `goshipping_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${isSecure ? '; Secure' : ''}`;

    c.header('Set-Cookie', cookieString);
    return c.json({
      success: true,
      user: account,
      message: 'Logged in successfully'
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Login failed' }, 500);
  }
});

// 02b. Auth: Signup / Register
const SignupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(4, 'Password must be at least 4 characters')
});

const handleRegisterUser = async (c: any) => {
  try {
    const body = await c.req.json();
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid registration payload', details: parsed.error.issues }, 400);
    }

    const { firstName, lastName, email, phone, password } = parsed.data;
    const existing = getAllAccounts().find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return c.json({ error: 'An account with this email address already exists' }, 409);
    }

    const newAccount: AuthUser = {
      id: `usr-${Date.now()}`,
      email: email.toLowerCase().trim(),
      fullName: `${firstName} ${lastName}`.trim(),
      role: 'customer',
      status: 'active',
      phone: phone || undefined,
      companyName: `${firstName} ${lastName}`.trim()
    };

    registerAccount(newAccount, password);

    const { sessionId, expiresAt } = await createSession(
      newAccount,
      c.req.header('user-agent'),
      c.req.header('x-forwarded-for') || '127.0.0.1'
    );

    await AuditService.logAction({
      userId: newAccount.id,
      userName: newAccount.fullName,
      action: 'USER_REGISTER',
      entityType: 'user',
      entityId: newAccount.id,
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1'
    });

    // Send enterprise welcome email via Resend
    EmailService.sendWelcomeUserEmail({
      fullName: newAccount.fullName,
      email: newAccount.email,
      role: newAccount.role,
      companyName: newAccount.companyName,
      phone: newAccount.phone
    }).catch((err) => console.error('[EmailService] Signup welcome email error:', err));

    const isSecure = isRequestSecure(c);
    const cookieString = `goshipping_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${isSecure ? '; Secure' : ''}`;

    c.header('Set-Cookie', cookieString);
    return c.json({
      success: true,
      user: newAccount,
      message: 'Account registered successfully'
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Registration failed' }, 500);
  }
};

app.post('/auth/signup', handleRegisterUser);
app.post('/auth/register', handleRegisterUser);

// 03. Auth: Current User
app.get('/auth/me', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
  if (!user) {
    return c.json({ authenticated: false, user: null });
  }
  return c.json({
    authenticated: true,
    user
  });
});

// 03b. Auth: Update Profile
const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  address: z.string().optional(),
  binNumber: z.string().optional()
});

app.patch('/auth/profile', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[4]; // Default to customer
  }
  if (!user) {
    return c.json({ error: 'Unauthorized. Please sign in.' }, 401);
  }

  try {
    const body = await c.req.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid profile data', details: parsed.error.issues }, 400);
    }

    const updated = updateAccount(user.id, parsed.data);
    if (!updated) {
      return c.json({ error: 'User account not found' }, 404);
    }

    await AuditService.logAction({
      userId: user.id,
      userName: updated.fullName,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'user',
      entityId: user.id,
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1'
    });

    return c.json({ success: true, user: updated, message: 'Profile updated successfully' });
  } catch (err: any) {
    return c.json({ error: err.message || 'Profile update failed' }, 500);
  }
});

// 04. Auth: Logout (Supports both POST and GET)
const handleLogout = async (c: any) => {
  const sessionId = c.get('sessionId' as any) as string | undefined;
  if (sessionId) {
    await destroySession(sessionId);
  }
  c.header(
    'Set-Cookie',
    'goshipping_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax'
  );
  return c.json({ success: true, message: 'Logged out successfully' });
};

app.post('/auth/logout', handleLogout);
app.get('/auth/logout', handleLogout);

// 04b. Realtime Configuration (Safe public credentials & fallback polling parameters)
app.get('/realtime/config', (c) => {
  return c.json({ success: true, config: RealtimeService.getClientConfig() });
});

// 05. Public Tracking Lookup (Unified search by Tracking Code, Email, or Phone Number)
app.get('/tracking/:trackingNumber', async (c) => {
  const trackingNumber = c.req.param('trackingNumber');
  const clientHash = c.req.header('if-none-match') || c.req.query('lastHash');

  const { modified, data, matchingShipments, totalFound, searchType } =
    await TrackingService.searchPublicTracking(trackingNumber, clientHash);

  if (!modified && clientHash) {
    return c.body(null, 304);
  }

  if (!data) {
    return c.json({ error: 'No shipment found matching tracking code, email, or phone number' }, 404);
  }

  c.header('ETag', `"${data.lastHash}"`);
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
  return c.json({
    success: true,
    tracking: data,
    matchingShipments: matchingShipments || [],
    totalFound: totalFound || 1,
    searchType: searchType || 'tracking_code'
  });
});

// 06. Shipments: List
app.get('/shipments', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
  const status = c.req.query('status');
  const mode = c.req.query('mode');
  const query = c.req.query('query');

  let customerId: string | undefined = undefined;
  let customerName: string | undefined = undefined;
  if (user?.role === 'customer') {
    customerId = user.id;
    customerName = user.companyName || user.fullName;
  }

  const list = await ShipmentService.listShipments({
    customerId,
    customerName,
    status,
    mode,
    query
  });

  return c.json({ success: true, count: list.length, shipments: list });
});

// 07. Shipments: Create (Admin / Operations / Sales)
const ShipmentItemInputSchema = z.object({
  itemCode: z.string().optional(),
  description: z.string().min(2),
  packagingType: z.string().default('carton'),
  quantity: z.number().int().positive().default(1),
  weightKg: z.number().positive(),
  cbm: z.number().positive(),
  categoryTag: z.enum(['General', 'Commercial', 'Liquids', 'Dangerous', 'Perishable', 'Electronics']).default('Commercial'),
  declaredValue: z.number().optional(),
  currency: z.string().default('BDT')
});

const CreateShipmentSchema = z.object({
  trackingNumber: z.string().optional(),
  customerId: z.string().default('usr-customer-01'),
  customerName: z.string().min(2),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientAddress: z.string().optional(),
  originCountry: z.string().min(2),
  originCity: z.string().min(2),
  originAddress: z.string().optional(),
  originLat: z.number().optional(),
  originLng: z.number().optional(),
  destCountry: z.string().min(2),
  destCity: z.string().min(2),
  destAddress: z.string().optional(),
  destLat: z.number().optional(),
  destLng: z.number().optional(),
  mode: z.enum(['air', 'sea', 'road', 'hand_carry']),
  serviceLevel: z.enum(['standard', 'express', 'priority']),
  totalWeightKg: z.number().positive(),
  totalCbm: z.number().positive(),
  totalPieces: z.number().int().positive(),
  carrierName: z.string().optional(),
  voyageOrFlightNumber: z.string().optional(),
  billOfLadingNumber: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  items: z.array(ShipmentItemInputSchema).optional()
});

app.post('/shipments', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }

  if (!user || (user.role === 'customer' && !hasPermission(user.role, 'shipments:create'))) {
    return c.json({ error: 'Unauthorized. Staff permissions required to create master shipment.' }, 403);
  }

  try {
    const body = await c.req.json();
    const parsed = CreateShipmentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const created = await ShipmentService.createShipment(parsed.data);

    await AuditService.logAction({
      userId: user.id,
      userName: user.fullName,
      action: 'SHIPMENT_CREATED',
      entityType: 'shipment',
      entityId: created.id,
      details: { trackingNumber: created.trackingNumber }
    });

    // Lookup customer account email to dispatch consignment booking notification
    const customerAccount = findAccountById(created.customerId) || getAllAccounts().find((a) => a.id === created.customerId || a.fullName.toLowerCase() === created.customerName.toLowerCase());
    const customerEmail = customerAccount?.email;
    if (customerEmail) {
      EmailService.sendShipmentBookedNotification({
        trackingNumber: created.trackingNumber,
        productName: created.items[0]?.description || 'Commercial Freight Consignment',
        customerName: created.customerName,
        customerEmail: customerEmail,
        recipientName: created.recipientName,
        recipientPhone: created.recipientPhone,
        recipientAddress: created.recipientAddress,
        originCity: created.originCity,
        originCountry: created.originCountry,
        destCity: created.destCity,
        destCountry: created.destCountry,
        mode: created.mode,
        carrierName: created.carrierName,
        voyageOrFlightNumber: created.voyageOrFlightNumber,
        totalWeightKg: created.totalWeightKg,
        totalPieces: created.totalPieces
      }).catch((err) => console.error('[EmailService] Shipment dispatch notification error:', err));
    }

    return c.json({ success: true, shipment: created }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 07b. Shipments: Update (Admin / Operations)
app.patch('/shipments/:id', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }
  if (!user || user.role === 'customer') {
    return c.json({ error: 'Forbidden. Staff credentials required.' }, 403);
  }

  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const updated = await ShipmentService.updateShipment(id, body);
    if (!updated) {
      return c.json({ error: 'Shipment not found' }, 404);
    }

    await AuditService.logAction({
      userId: user.id,
      userName: user.fullName,
      action: 'SHIPMENT_UPDATED',
      entityType: 'shipment',
      entityId: updated.id,
      details: { trackingNumber: updated.trackingNumber }
    });

    return c.json({ success: true, shipment: updated });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 07c. Shipments: Detailed Tracking Events (Authenticated)
app.get('/shipments/:id/events', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
  const id = c.req.param('id');
  const shipment = await ShipmentService.getByTrackingNumber(id);
  if (!shipment) {
    return c.json({ error: 'Shipment not found' }, 404);
  }

  // Access control: customer can only view their own shipments
  if (user && user.role === 'customer' && shipment.customerId !== user.id) {
    return c.json({ error: 'Access denied to this consignment' }, 403);
  }

  return c.json({
    success: true,
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    statusCode: shipment.statusCode,
    statusLabel: shipment.statusLabel,
    paymentStatus: shipment.paymentStatus,
    eventVersion: shipment.eventVersion,
    events: shipment.events
  });
});

// 07d. Shipments: Lightweight Polling Updates Endpoint (304 Support)
app.get('/shipments/:id/updates', async (c) => {
  const id = c.req.param('id');
  const shipment = await ShipmentService.getByTrackingNumber(id);
  if (!shipment) {
    return c.json({ error: 'Shipment not found' }, 404);
  }

  const latestEventId = shipment.events[0]?.id || 'none';
  const contentHash = `${shipment.status}-${shipment.paymentStatus}-${shipment.eventVersion}-${shipment.updatedAt}-${latestEventId}`;
  const clientHash = c.req.header('if-none-match') || c.req.query('lastHash');

  if (clientHash && clientHash.replace(/"/g, '') === contentHash) {
    return c.body(null, 304);
  }

  c.header('ETag', `"${contentHash}"`);
  c.header('Cache-Control', 'no-cache');

  return c.json({
    success: true,
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    statusCode: shipment.statusCode,
    statusLabel: shipment.statusLabel,
    paymentStatus: shipment.paymentStatus,
    version: shipment.eventVersion,
    updatedAt: shipment.updatedAt,
    lastUpdatedBst: shipment.lastUpdatedBst,
    latestEventId,
    lastHash: contentHash,
    physicalProgress: shipment.physicalProgress
  });
});

// 07e. Shipments: Atomic Status & Event Update (Authorized Staff)
const UpdateStatusSchema = z.object({
  status: z.string().min(2),
  title: z.string().optional(),
  description: z.string().optional(),
  locationName: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  source: z.enum(['warehouse', 'admin', 'carrier_api', 'driver']).default('admin'),
  eventTime: z.string().optional(),
  notes: z.string().optional(),
  visibility: z.enum(['public', 'internal']).default('public'),
  paymentStatus: z.enum(['pending', 'payment_received']).optional()
});

app.patch('/shipments/:id/status', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }
  if (!user || user.role === 'customer') {
    return c.json({ error: 'Forbidden. Staff credentials required to update shipment status.' }, 403);
  }

  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const updated = await ShipmentService.updateStatus(id, parsed.data);
    if (!updated) {
      return c.json({ error: 'Shipment not found' }, 404);
    }

    await AuditService.logAction({
      userId: user.id,
      userName: user.fullName,
      action: 'SHIPMENT_STATUS_UPDATED',
      entityType: 'shipment',
      entityId: updated.id,
      details: {
        trackingNumber: updated.trackingNumber,
        newStatus: updated.status,
        statusLabel: updated.statusLabel,
        paymentStatus: updated.paymentStatus,
        eventVersion: updated.eventVersion
      }
    });

    // Lookup customer email to notify of milestone status transition
    const customerAccount = findAccountById(updated.customerId) || getAllAccounts().find((a) => a.id === updated.customerId || a.fullName.toLowerCase() === updated.customerName.toLowerCase());
    if (customerAccount?.email) {
      EmailService.sendTrackingMilestoneUpdate({
        trackingNumber: updated.trackingNumber,
        productName: updated.items[0]?.description || 'Commercial Freight Consignment',
        customerEmail: customerAccount.email,
        statusCode: updated.statusCode,
        statusLabel: updated.statusLabel,
        locationName: parsed.data.locationName || updated.destCity,
        description: parsed.data.description || `Shipment milestone updated to ${updated.statusLabel}`,
        occurredAtBst: updated.lastUpdatedBst
      }).catch((err) => console.error('[EmailService] Milestone update email error:', err));
    }

    return c.json({ success: true, shipment: updated });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 07f. Shipments: Delete (Super Admin only)
app.delete('/shipments/:id', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }
  if (!user || user.role === 'customer') {
    return c.json({ error: 'Forbidden. Admin credentials required.' }, 403);
  }

  const id = c.req.param('id');
  const deleted = await ShipmentService.deleteShipment(id);
  if (!deleted) {
    return c.json({ error: 'Shipment not found' }, 404);
  }

  await AuditService.logAction({
    userId: user.id,
    userName: user.fullName,
    action: 'SHIPMENT_DELETED',
    entityType: 'shipment',
    entityId: id
  });

  return c.json({ success: true, message: 'Shipment removed successfully' });
});

// 08. Shipments: Add Tracking Event (Warehouse & Admin & Webhook)
const TrackingEventSchema = z.object({
  shipmentId: z.string().min(2),
  status: z.string().min(2), // Accepts standard 9 statuses or legacy keys
  title: z.string().min(2),
  description: z.string().min(2),
  locationName: z.string().min(2),
  lat: z.number().optional(),
  lng: z.number().optional(),
  eventTime: z.string().optional(),
  source: z.enum(['warehouse', 'admin', 'carrier_api', 'driver']).default('warehouse')
});

app.post('/tracking/events', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }
  if (!user || user.role === 'customer') {
    return c.json({ error: 'Forbidden. Warehouse or dispatch staff credentials required.' }, 403);
  }

  try {
    const body = await c.req.json();
    const parsed = TrackingEventSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const updated = await ShipmentService.addEvent(parsed.data.shipmentId, parsed.data);
    if (!updated) {
      return c.json({ error: 'Shipment not found' }, 404);
    }

    await AuditService.logAction({
      userId: user.id,
      userName: user.fullName,
      action: 'TRACKING_EVENT_LOGGED',
      entityType: 'shipment',
      entityId: updated.id,
      details: { eventTitle: parsed.data.title, status: parsed.data.status }
    });

    return c.json({ success: true, shipment: updated });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 08b. Tracking Events: Delete Event
app.delete('/tracking/events/:shipmentId/:eventId', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }
  if (!user || user.role === 'customer') {
    return c.json({ error: 'Forbidden. Admin credentials required.' }, 403);
  }

  const { shipmentId, eventId } = c.req.param();
  const deleted = await ShipmentService.deleteEvent(shipmentId, eventId);
  if (!deleted) {
    return c.json({ error: 'Event not found or failed to delete' }, 404);
  }

  return c.json({ success: true, message: 'Tracking event removed' });
});

// 09. Quotes: List
app.get('/quotes', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
  const status = c.req.query('status');

  let customerId: string | undefined = undefined;
  if (user?.role === 'customer') {
    customerId = user.id;
  }

  const list = await QuoteService.listQuotes({ customerId, status });
  return c.json({ success: true, count: list.length, quotes: list });
});

// 10. Quotes: Submit Request (Public & Authenticated)
const CreateQuoteSchema = z.object({
  guestName: z.string().min(2),
  guestEmail: z.string().email(),
  guestPhone: z.string().min(6),
  originCountry: z.string().min(2),
  originCity: z.string().min(2),
  destCountry: z.string().min(2),
  destCity: z.string().min(2),
  mode: z.enum(['air', 'sea', 'hand_carry']),
  serviceType: z.enum(['door_to_door', 'port_to_port', 'door_to_port']).optional(),
  productName: z.string().optional(),
  productCategory: z.string().optional(),
  productImages: z.array(z.string()).optional(),
  productUrl: z.string().optional(),
  declaredValue: z.number().optional(),
  cargoDescription: z.string().min(3),
  packagingType: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  totalWeightKg: z.number().positive(),
  totalCbm: z.number().positive(),
  targetShipmentDate: z.string().optional()
});

app.post('/quotes', async (c) => {
  try {
    const user = c.get('user' as any) as AuthUser | undefined;
    const body = await c.req.json();
    const parsed = CreateQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid quote input', details: parsed.error.issues }, 400);
    }

    const quote = await QuoteService.createQuote({
      ...parsed.data,
      customerId: user?.id
    });

    await AuditService.logAction({
      userId: user?.id,
      userName: user?.fullName || parsed.data.guestName,
      action: 'QUOTE_SUBMITTED',
      entityType: 'quote',
      entityId: quote.id,
      details: { quoteNumber: quote.quoteNumber, route: `${parsed.data.originCity} -> ${parsed.data.destCity}` }
    });

    // Dispatch customer confirmation and internal ops inquiry alert
    Promise.allSettled([
      EmailService.sendQuoteConfirmation({
        quoteNumber: quote.quoteNumber,
        guestName: parsed.data.guestName,
        guestEmail: parsed.data.guestEmail,
        guestPhone: parsed.data.guestPhone,
        originCity: parsed.data.originCity,
        originCountry: parsed.data.originCountry,
        destCity: parsed.data.destCity,
        destCountry: parsed.data.destCountry,
        mode: parsed.data.mode,
        cargoDescription: parsed.data.cargoDescription,
        totalWeightKg: parsed.data.totalWeightKg,
        totalCbm: parsed.data.totalCbm
      }),
      EmailService.sendQuoteAlertToOps({
        quoteNumber: quote.quoteNumber,
        guestName: parsed.data.guestName,
        guestEmail: parsed.data.guestEmail,
        guestPhone: parsed.data.guestPhone,
        companyName: user?.companyName,
        originCity: parsed.data.originCity,
        destCity: parsed.data.destCity,
        mode: parsed.data.mode,
        totalWeightKg: parsed.data.totalWeightKg,
        totalCbm: parsed.data.totalCbm
      })
    ]).catch((err) => console.error('[EmailService] Quote notification error:', err));

    return c.json({ success: true, quote }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 11. Quotes: Add Pricing Revision (Staff/Sales)
const PriceQuoteSchema = z.object({
  baseFreightCharge: z.number().positive(),
  fuelSurcharge: z.number().nonnegative().default(0),
  customsClearanceFee: z.number().nonnegative().default(0),
  handlingFee: z.number().nonnegative().default(0),
  insuranceFee: z.number().nonnegative().default(0),
  otherFees: z.number().nonnegative().default(0),
  currency: z.string().default('BDT'),
  validityDate: z.string().optional(),
  transitTimeDays: z.string().optional(),
  notes: z.string().optional()
});

app.post('/quotes/:id/price', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
  if (!user || user.role === 'customer') {
    return c.json({ error: 'Staff pricing authority required.' }, 403);
  }

  const quoteId = c.req.param('id');
  const body = await c.req.json();
  const parsed = PriceQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid pricing parameters', details: parsed.error.issues }, 400);
  }

  const updated = await QuoteService.addPricingRevision(quoteId, {
    ...parsed.data,
    staffName: user.fullName
  });

  if (!updated) {
    return c.json({ error: 'Quote record not found' }, 404);
  }

  await AuditService.logAction({
    userId: user.id,
    userName: user.fullName,
    action: 'QUOTE_PRICED',
    entityType: 'quote',
    entityId: quoteId,
    details: { totalAmount: updated.revisions[0]?.totalAmount }
  });

  return c.json({ success: true, quote: updated });
});

// 12. Quotes: Convert to Shipment
app.post('/quotes/:id/convert', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
  if (!user || user.role === 'customer') {
    return c.json({ error: 'Operations privilege required.' }, 403);
  }

  const quoteId = c.req.param('id');
  const result = await QuoteService.convertQuoteToShipment(quoteId);
  if (!result) {
    return c.json({ error: 'Quote not found or cannot convert' }, 404);
  }

  await AuditService.logAction({
    userId: user.id,
    userName: user.fullName,
    action: 'QUOTE_CONVERTED_TO_SHIPMENT',
    entityType: 'quote',
    entityId: quoteId,
    details: { shipmentId: result.shipmentId }
  });

  return c.json({ success: true, quote: result.quote, shipmentId: result.shipmentId });
});

// 13. Warehouses
app.get('/warehouses', async (c) => {
  const warehouses = await WarehouseService.listWarehouses();
  return c.json({ success: true, warehouses });
});

// 14. Admin Operations KPIs
app.get('/admin/overview', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
  if (!user || user.role === 'customer') {
    return c.json({ error: 'Unauthorized.' }, 403);
  }

  const shipments = await ShipmentService.listShipments();
  const quotes = await QuoteService.listQuotes();
  const warehouses = await WarehouseService.listWarehouses();

  const activeShipments = shipments.filter((s) => s.status !== 'delivered').length;
  const pendingQuotes = quotes.filter((q) => q.status === 'submitted' || q.status === 'under_review').length;
  const customsHold = shipments.filter((s) => s.status === 'customs_clearance').length;

  return c.json({
    success: true,
    kpis: {
      activeShipments,
      pendingQuotes,
      customsHold,
      totalWarehouses: warehouses.length,
      averageWarehouseCapacity: '70.7%'
    }
  });
});

// 15. Admin Audit Logs
app.get('/admin/audit-logs', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
  if (!user || !['super_admin', 'ops_manager'].includes(user.role)) {
    return c.json({ error: 'Admin audit access required.' }, 403);
  }

  const logs = await AuditService.listLogs();
  return c.json({ success: true, logs });
});

// 16. Admin Customers & Importers
app.get('/admin/customers', async (c) => {
  const accounts = getAllAccounts();
  const shipments = await ShipmentService.listShipments();
  const quotes = await QuoteService.listQuotes();

  const customers = accounts.map((acc) => {
    const userShipments = shipments.filter((s) => s.customerId === acc.id || s.customerName.toLowerCase().includes(acc.fullName.toLowerCase()));
    const userQuotes = quotes.filter((q) => q.customerId === acc.id || q.guestEmail.toLowerCase() === acc.email.toLowerCase());
    return {
      id: acc.id,
      fullName: acc.fullName,
      email: acc.email,
      role: acc.role,
      status: acc.status,
      phone: acc.phone,
      companyName: acc.companyName,
      address: acc.address,
      binNumber: acc.binNumber,
      activeShipmentsCount: userShipments.filter((s) => s.status !== 'delivered').length,
      totalQuotesCount: userQuotes.length,
      tier: acc.role === 'customer' ? 'Commercial Importer' : 'Staff Admin'
    };
  });

  return c.json({ success: true, customers });
});

// 17. User Management: List All Users (Admins, Staff, Customers)
app.get('/admin/users', async (c) => {
  const accounts = getAllAccounts();
  const shipments = await ShipmentService.listShipments();
  const quotes = await QuoteService.listQuotes();

  const users = accounts.map((acc) => {
    const userShipments = shipments.filter(
      (s) => s.customerId === acc.id || s.customerName.toLowerCase().includes(acc.fullName.toLowerCase())
    );
    const userQuotes = quotes.filter(
      (q) => q.customerId === acc.id || q.guestEmail.toLowerCase() === acc.email.toLowerCase()
    );
    return {
      id: acc.id,
      fullName: acc.fullName,
      email: acc.email,
      role: acc.role,
      status: acc.status,
      avatarUrl: acc.avatarUrl,
      phone: acc.phone,
      companyName: acc.companyName,
      address: acc.address,
      binNumber: acc.binNumber,
      activeShipmentsCount: userShipments.filter((s) => s.status !== 'delivered').length,
      totalShipmentsCount: userShipments.length,
      totalQuotesCount: userQuotes.length
    };
  });

  return c.json({ success: true, users });
});

// 18. User Management: Create User
const CreateUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(4).default('password'),
  role: z.enum(['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent', 'customer']).default('customer'),
  status: z.enum(['active', 'suspended']).default('active'),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  address: z.string().optional(),
  binNumber: z.string().optional()
});

app.post('/admin/users', async (c) => {
  const currentUser = c.get('user' as any) as AuthUser | undefined;
  if (!currentUser || !['super_admin', 'ops_manager'].includes(currentUser.role)) {
    return c.json({ error: 'Unauthorized. Super Admin or Ops Manager role required.' }, 403);
  }

  try {
    const body = await c.req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const existing = await findAccountByEmail(parsed.data.email);
    if (existing) {
      return c.json({ error: 'A user account with this email address already exists.' }, 400);
    }

    const newUser: AuthUser = {
      id: `usr-${Date.now().toString(36)}`,
      email: parsed.data.email.toLowerCase().trim(),
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      status: parsed.data.status,
      phone: parsed.data.phone || '',
      companyName: parsed.data.companyName || parsed.data.fullName,
      address: parsed.data.address || '',
      binNumber: parsed.data.binNumber || ''
    };

    registerAccount(newUser, parsed.data.password);

    await AuditService.logAction({
      userId: currentUser.id,
      userName: currentUser.fullName,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: newUser.id,
      details: { email: newUser.email, role: newUser.role }
    });

    // Send welcome onboarding email to the created user with login credentials
    EmailService.sendWelcomeUserEmail({
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      companyName: newUser.companyName,
      phone: newUser.phone,
      password: parsed.data.password
    }).catch((err) => console.error('[EmailService] User onboarding email error:', err));

    return c.json({ success: true, user: newUser }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to create user' }, 500);
  }
});

// 19. User Management: Update User
const UpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent', 'customer']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  address: z.string().optional(),
  binNumber: z.string().optional()
});

app.put('/admin/users/:id', async (c) => {
  const currentUser = c.get('user' as any) as AuthUser | undefined;
  if (!currentUser || !['super_admin', 'ops_manager'].includes(currentUser.role)) {
    return c.json({ error: 'Unauthorized. Super Admin or Ops Manager role required.' }, 403);
  }

  const userId = c.req.param('id');
  const existing = findAccountById(userId);
  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const updated = updateAccount(userId, parsed.data);

    await AuditService.logAction({
      userId: currentUser.id,
      userName: currentUser.fullName,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: userId,
      details: parsed.data
    });

    return c.json({ success: true, user: updated });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to update user' }, 500);
  }
});

// 20. User Management: Toggle Status (Suspend / Activate)
app.patch('/admin/users/:id/status', async (c) => {
  const currentUser = c.get('user' as any) as AuthUser | undefined;
  if (!currentUser || !['super_admin', 'ops_manager'].includes(currentUser.role)) {
    return c.json({ error: 'Unauthorized. Super Admin or Ops Manager role required.' }, 403);
  }

  const userId = c.req.param('id');
  const existing = findAccountById(userId);
  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (existing.id === currentUser.id) {
    return c.json({ error: 'You cannot suspend your own administrative account.' }, 400);
  }

  const newStatus = existing.status === 'active' ? 'suspended' : 'active';
  const updated = updateAccount(userId, { status: newStatus });

  await AuditService.logAction({
    userId: currentUser.id,
    userName: currentUser.fullName,
    action: newStatus === 'active' ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
    entityType: 'user',
    entityId: userId
  });

  return c.json({ success: true, user: updated, newStatus });
});

// 21. User Management: Delete User
app.delete('/admin/users/:id', async (c) => {
  const currentUser = c.get('user' as any) as AuthUser | undefined;
  if (!currentUser || currentUser.role !== 'super_admin') {
    return c.json({ error: 'Unauthorized. Super Admin role required to delete accounts.' }, 403);
  }

  const userId = c.req.param('id');
  const existing = findAccountById(userId);
  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (existing.id === currentUser.id) {
    return c.json({ error: 'You cannot delete your own administrative account.' }, 400);
  }

  deleteAccount(userId);

  await AuditService.logAction({
    userId: currentUser.id,
    userName: currentUser.fullName,
    action: 'USER_DELETED',
    entityType: 'user',
    entityId: userId,
    details: { deletedEmail: existing.email }
  });

  return c.json({ success: true, message: 'User deleted successfully' });
});

// 22. Ghost Login / Masquerade (Login as User without password)
app.post('/admin/impersonate/:id', async (c) => {
  let currentUser = c.get('user' as any) as AuthUser | undefined;
  if (!currentUser && process.env.NODE_ENV !== 'production') {
    currentUser = DEFAULT_ACCOUNTS[0];
  }

  if (!currentUser || !['super_admin', 'ops_manager'].includes(currentUser.role)) {
    return c.json({ error: 'Unauthorized. Super Admin or Ops Manager role required to impersonate users.' }, 403);
  }

  const targetUserId = c.req.param('id');
  const targetUser = findAccountById(targetUserId);
  if (!targetUser) {
    return c.json({ error: 'Target user account not found.' }, 404);
  }

  const currentSessionId = c.get('sessionId' as any) as string | undefined;

  const impersonatedUser: AuthUser = {
    ...targetUser,
    impersonatedBy: {
      id: currentUser.id,
      fullName: currentUser.fullName,
      role: currentUser.role,
      originalSessionId: currentSessionId || ''
    }
  };

  const { sessionId, expiresAt } = await createSession(
    impersonatedUser,
    c.req.header('user-agent'),
    c.req.header('x-forwarded-for') || '127.0.0.1'
  );

  await AuditService.logAction({
    userId: currentUser.id,
    userName: currentUser.fullName,
    action: 'USER_IMPERSONATION_STARTED',
    entityType: 'user',
    entityId: targetUser.id,
    details: { targetEmail: targetUser.email, targetRole: targetUser.role }
  });

  const isSecure = isRequestSecure(c);
  const cookieString = `goshipping_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${isSecure ? '; Secure' : ''}`;
  c.header('Set-Cookie', cookieString);

  return c.json({
    success: true,
    redirectUrl: targetUser.role === 'customer' ? '/dashboard' : '/admin',
    message: `Now viewing portal as ${targetUser.fullName}`
  });
});

// 23. Exit Impersonation / Return to Admin
app.post('/auth/exit-impersonation', async (c) => {
  const currentUser = c.get('user' as any) as AuthUser | undefined;
  const currentSessionId = c.get('sessionId' as any) as string | undefined;

  if (currentSessionId) {
    await destroySession(currentSessionId);
  }

  let adminUser: AuthUser | null = null;
  if (currentUser?.impersonatedBy?.id) {
    adminUser = findAccountById(currentUser.impersonatedBy.id);
  }
  if (!adminUser) {
    adminUser = DEFAULT_ACCOUNTS[0]; // fallback to super admin
  }

  const { sessionId, expiresAt } = await createSession(
    adminUser,
    c.req.header('user-agent'),
    c.req.header('x-forwarded-for') || '127.0.0.1'
  );

  await AuditService.logAction({
    userId: adminUser.id,
    userName: adminUser.fullName,
    action: 'USER_IMPERSONATION_ENDED',
    entityType: 'user',
    entityId: currentUser?.id || 'unknown'
  });

  const isSecure = isRequestSecure(c);
  const cookieString = `goshipping_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${isSecure ? '; Secure' : ''}`;
  c.header('Set-Cookie', cookieString);

  return c.json({
    success: true,
    redirectUrl: '/admin?tab=users',
    message: 'Returned to Administrative Control'
  });
});

// 24. Public / Inbound Contact Inquiry
const ContactInquirySchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  company: z.string().optional(),
  category: z.string().optional(),
  message: z.string().min(5, 'Message must be at least 5 characters')
});

app.post('/contact', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ContactInquirySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    await AuditService.logAction({
      action: 'CONTACT_INQUIRY_RECEIVED',
      entityType: 'inquiry',
      details: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        category: parsed.data.category
      }
    });

    // Notify operations desk asynchronously
    EmailService.sendContactInquiryNotification({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      message: `${parsed.data.category ? `[Category: ${parsed.data.category}]\n\n` : ''}${parsed.data.message}`
    }).catch((err) => console.error('[EmailService] Contact notification failed:', err));

    return c.json({
      success: true,
      message: 'Your inquiry has been received. Our operations team will respond promptly.'
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to submit inquiry' }, 500);
  }
});

// 25. Admin: Resend Email Domain Diagnostics & Verification
app.get('/admin/email/status', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }
  if (!user || !['super_admin', 'ops_manager'].includes(user.role)) {
    return c.json({ error: 'Unauthorized. Administrative credentials required.' }, 403);
  }

  const domainStatus = await EmailService.getDomainStatus();
  return c.json({
    success: true,
    configuredFrom: EmailService.getFromHeader(),
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    domain: domainStatus.domain || null,
    error: domainStatus.error || null
  });
});

app.post('/admin/email/verify', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }
  if (!user || !['super_admin', 'ops_manager'].includes(user.role)) {
    return c.json({ error: 'Unauthorized. Administrative credentials required.' }, 403);
  }

  const result = await EmailService.triggerDomainVerify();
  return c.json(result);
});

// 26. Admin: Dispatched Test Email
const TestEmailSchema = z.object({
  to: z.string().email('Valid recipient email is required')
});

app.post('/admin/email/test', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }
  if (!user || !['super_admin', 'ops_manager'].includes(user.role)) {
    return c.json({ error: 'Unauthorized. Administrative credentials required.' }, 403);
  }

  try {
    const body = await c.req.json();
    const parsed = TestEmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid recipient', details: parsed.error.issues }, 400);
    }

    const result = await EmailService.sendTestEmail(parsed.data.to, user.fullName);
    if (!result.success) {
      return c.json({
        success: false,
        error: result.error,
        message: 'Resend API returned an error. Domain DNS records may still be pending propagation.'
      }, 400);
    }

    return c.json({
      success: true,
      emailId: result.id,
      message: `Test email successfully dispatched to ${parsed.data.to}`
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to dispatch test email' }, 500);
  }
});

// 27. Admin: Dispatch Test Welcome Email (User Registration Simulation)
const TestWelcomeEmailSchema = z.object({
  to: z.string().email().optional(),
  fullName: z.string().optional(),
  role: z.string().optional(),
  companyName: z.string().optional(),
  password: z.string().optional()
});

app.post('/admin/email/test-welcome', async (c) => {
  let user = c.get('user' as any) as AuthUser | undefined;
  if (!user && process.env.NODE_ENV !== 'production') {
    user = DEFAULT_ACCOUNTS[0];
  }
  if (!user || !['super_admin', 'ops_manager'].includes(user.role)) {
    return c.json({ error: 'Unauthorized. Administrative credentials required.' }, 403);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = TestWelcomeEmailSchema.safeParse(body);
    const data = parsed.success ? parsed.data : {};

    const targetEmail = data.to || 'goshippingbd@gmail.com';
    const targetName = data.fullName || 'Test Importer';

    const result = await EmailService.sendWelcomeUserEmail({
      fullName: targetName,
      email: targetEmail,
      role: data.role || 'customer',
      companyName: data.companyName || 'Apex Global Trade Ltd',
      password: data.password || 'Welcome123!'
    });

    return c.json({
      success: result.success,
      emailId: result.id,
      fallback: result.fallback,
      error: result.error,
      message: result.success
        ? `Welcome onboarding email dispatched via Resend to ${targetEmail} (ID: ${result.id})`
        : `Email delivery failed: ${result.error}`
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to trigger welcome email test' }, 500);
  }
});
