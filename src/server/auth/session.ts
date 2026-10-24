import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export type UserRole =
  | 'super_admin'
  | 'ops_manager'
  | 'warehouse_staff'
  | 'sales_team'
  | 'support_agent'
  | 'customer';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: string;
  avatarUrl?: string | null;
}

export interface SessionData {
  sessionId: string;
  user: AuthUser;
  expiresAt: Date;
}

// Global session store attached to globalThis so Astro dev and SSR bundles share the exact same state
declare global {
  var __goshipping_sessions: Map<string, SessionData> | undefined;
}

const memorySessions: Map<string, SessionData> =
  globalThis.__goshipping_sessions || new Map<string, SessionData>();
globalThis.__goshipping_sessions = memorySessions;

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a plain text password with salt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a plain text password against a bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new user session
 */
export async function createSession(
  user: AuthUser,
  _userAgent?: string,
  _ipAddress?: string
): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = generateSessionId();
  // 30 days session validity
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const sessionData: SessionData = {
    sessionId,
    user,
    expiresAt,
  };

  memorySessions.set(sessionId, sessionData);
  return { sessionId, expiresAt };
}

/**
 * Validate an incoming session ID
 */
export async function validateSession(sessionId: string): Promise<SessionData | null> {
  if (!sessionId) return null;
  const session = memorySessions.get(sessionId);
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    memorySessions.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Invalidate a session (Logout)
 */
export async function destroySession(sessionId: string): Promise<void> {
  memorySessions.delete(sessionId);
}

/**
 * Role-Based Access Control permissions matrix
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: [
    'shipments:read', 'shipments:create', 'shipments:update', 'shipments:delete',
    'quotes:read', 'quotes:price', 'quotes:approve', 'quotes:delete',
    'tracking:update', 'tracking:events',
    'warehouses:manage',
    'users:manage', 'staff:manage', 'customers:manage',
    'reports:view', 'reports:export',
    'settings:update', 'audit:view'
  ],
  ops_manager: [
    'shipments:read', 'shipments:create', 'shipments:update',
    'quotes:read', 'quotes:price', 'quotes:approve',
    'tracking:update', 'tracking:events',
    'warehouses:manage',
    'customers:manage',
    'reports:view',
    'audit:view'
  ],
  warehouse_staff: [
    'shipments:read', 'shipments:update',
    'tracking:events',
    'warehouses:read',
    'receiving:process', 'dispatch:process'
  ],
  sales_team: [
    'shipments:read',
    'quotes:read', 'quotes:price', 'quotes:create',
    'customers:read', 'customers:manage'
  ],
  support_agent: [
    'shipments:read',
    'tracking:events',
    'quotes:read',
    'customers:read'
  ],
  customer: [
    'customer:shipments:read',
    'customer:quotes:create', 'customer:quotes:read', 'customer:quotes:accept',
    'customer:documents:read',
    'customer:profile:manage'
  ]
};

/**
 * Verify if role possesses specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  if (role === 'super_admin') return true;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Default mock admin and customer accounts for immediate development & staging access
 */
export const DEFAULT_ACCOUNTS = [
  {
    id: 'usr-admin-01',
    email: 'admin@goshipping.com',
    fullName: 'Operations Director',
    role: 'super_admin' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-ops-01',
    email: 'ops@goshipping.com',
    fullName: 'Kamal Hossain',
    role: 'ops_manager' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-warehouse-01',
    email: 'warehouse@goshipping.com',
    fullName: 'Dhaka Hub Officer',
    role: 'warehouse_staff' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-sales-01',
    email: 'sales@goshipping.com',
    fullName: 'Nafis Chowdhury',
    role: 'sales_team' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-customer-01',
    email: 'client@apextextiles.com',
    fullName: 'Apex Textiles Ltd',
    role: 'customer' as UserRole,
    status: 'active'
  }
];
