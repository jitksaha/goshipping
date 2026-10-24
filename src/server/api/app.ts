import { Hono } from 'hono';
import { z } from 'zod';
import {
  createSession,
  validateSession,
  destroySession,
  DEFAULT_ACCOUNTS,
  hasPermission,
  type AuthUser
} from '../auth/session';
import { ShipmentService } from '../services/shipment.service';
import { QuoteService } from '../services/quote.service';
import { TrackingService } from '../services/tracking.service';
import { WarehouseService } from '../services/warehouse.service';
import { AuditService } from '../services/audit.service';
import { checkDatabaseHealth } from '../db/client';

export const app = new Hono().basePath('/api');

// Helper to extract session from Cookie header
function getSessionIdFromHeader(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/goshipping_session=([^;]+)/);
  return match ? match[1] : null;
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
    // Check against predefined roles or user repository
    const account = DEFAULT_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase());

    if (!account) {
      return c.json({ error: 'Invalid credentials or user not found' }, 401);
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

    const isSecure = process.env.NODE_ENV === 'production';
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

// 04. Auth: Logout
app.post('/auth/logout', async (c) => {
  const sessionId = c.get('sessionId' as any) as string | undefined;
  if (sessionId) {
    await destroySession(sessionId);
  }
  c.header('Set-Cookie', 'goshipping_session=; Path=/; HttpOnly; Max-Age=0');
  return c.json({ success: true, message: 'Logged out successfully' });
});

// 05. Public Tracking Lookup (Adaptive polling + unchanged conditional response)
app.get('/tracking/:trackingNumber', async (c) => {
  const trackingNumber = c.req.param('trackingNumber');
  const clientHash = c.req.header('if-none-match') || c.req.query('lastHash');

  const { modified, data } = await TrackingService.getPublicTracking(trackingNumber, clientHash);

  if (!modified && clientHash) {
    return c.body(null, 304);
  }

  if (!data) {
    return c.json({ error: 'Shipment with specified tracking number not found' }, 404);
  }

  c.header('ETag', `"${data.lastHash}"`);
  c.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
  return c.json({ success: true, tracking: data });
});

// 06. Shipments: List
app.get('/shipments', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
  const status = c.req.query('status');
  const mode = c.req.query('mode');
  const query = c.req.query('query');

  let customerId: string | undefined = undefined;
  if (user?.role === 'customer') {
    customerId = user.id;
  }

  const list = await ShipmentService.listShipments({
    customerId,
    status,
    mode,
    query
  });

  return c.json({ success: true, count: list.length, shipments: list });
});

// 07. Shipments: Create (Admin / Operations / Sales)
const CreateShipmentSchema = z.object({
  customerId: z.string().default('usr-customer-01'),
  customerName: z.string().min(2),
  originCountry: z.string().min(2),
  originCity: z.string().min(2),
  destCountry: z.string().min(2),
  destCity: z.string().min(2),
  mode: z.enum(['air', 'sea', 'road']),
  serviceLevel: z.enum(['standard', 'express', 'priority']),
  totalWeightKg: z.number().positive(),
  totalCbm: z.number().positive(),
  totalPieces: z.number().int().positive(),
  carrierName: z.string().optional(),
  estimatedDelivery: z.string().optional()
});

app.post('/shipments', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
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

    return c.json({ success: true, shipment: created }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 08. Shipments: Add Tracking Event (Warehouse & Admin & Webhook)
const TrackingEventSchema = z.object({
  shipmentId: z.string().min(2),
  status: z.enum([
    'order_created',
    'warehouse_received',
    'in_transit',
    'customs_clearance',
    'out_for_delivery',
    'delivered',
    'exception'
  ]),
  title: z.string().min(3),
  description: z.string().min(3),
  locationName: z.string().min(2),
  lat: z.number().optional(),
  lng: z.number().optional(),
  source: z.enum(['warehouse', 'admin', 'carrier_api']).default('warehouse')
});

app.post('/tracking/events', async (c) => {
  const user = c.get('user' as any) as AuthUser | undefined;
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
  mode: z.enum(['air', 'sea']),
  serviceType: z.enum(['door_to_door', 'port_to_port', 'door_to_port']).optional(),
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
  currency: z.string().default('USD'),
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
