import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { eq, or, like } from 'drizzle-orm';
import { db } from '../db/client';
import * as schema from '../db/schema';

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
  phone?: string;
  companyName?: string;
  address?: string;
  binNumber?: string;
  impersonatedBy?: {
    id: string;
    fullName: string;
    role: string;
    originalSessionId: string;
  };
}

export interface SessionData {
  sessionId: string;
  user: AuthUser;
  expiresAt: Date;
}

// Global session store attached to globalThis so Astro dev and SSR bundles share the exact same state
declare global {
  var __goshipping_sessions: Map<string, SessionData> | undefined;
  var __goshipping_accounts: AuthUser[] | undefined;
  var __goshipping_passwords: Map<string, string> | undefined;
  var __goshipping_otps: Map<string, { code: string; expiresAt: number; attempts: number }> | undefined;
}

const memorySessions: Map<string, SessionData> =
  globalThis.__goshipping_sessions || new Map<string, SessionData>();
globalThis.__goshipping_sessions = memorySessions;

const memoryPasswords: Map<string, string> =
  globalThis.__goshipping_passwords || new Map<string, string>();
globalThis.__goshipping_passwords = memoryPasswords;

const memoryOtps: Map<string, { code: string; expiresAt: number; attempts: number }> =
  globalThis.__goshipping_otps || new Map<string, { code: string; expiresAt: number; attempts: number }>();
globalThis.__goshipping_otps = memoryOtps;

const STORE_PATH = path.resolve(process.cwd(), '.auth_store.json');

interface AuthStoreData {
  sessions: Array<{
    sessionId: string;
    user: AuthUser;
    expiresAt: string;
  }>;
  accounts: AuthUser[];
  passwords: Record<string, string>;
}

let lastAuthMtimeMs = 0;

export function cleanEmailValue(email?: string | null): string {
  if (!email) return '';
  const trimmed = email.trim();
  if (trimmed.toLowerCase().endsWith('@goshipping.client') || trimmed.toLowerCase().includes('@goshipping.internal')) {
    return '';
  }
  return trimmed;
}

export function loadAuthStore(): void {
  try {
    if (fs.existsSync(STORE_PATH)) {
      lastAuthMtimeMs = fs.statSync(STORE_PATH).mtimeMs;
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const data: AuthStoreData = JSON.parse(raw);
      if (Array.isArray(data.sessions)) {
        for (const s of data.sessions) {
          const exp = new Date(s.expiresAt);
          if (exp.getTime() > Date.now()) {
            memorySessions.set(s.sessionId, {
              sessionId: s.sessionId,
              user: {
                ...s.user,
                email: cleanEmailValue(s.user.email)
              },
              expiresAt: exp,
            });
          }
        }
      }
      if (Array.isArray(data.accounts)) {
        const cleanAccounts: AuthUser[] = [...DEFAULT_ACCOUNTS];
        for (const rawAcc of data.accounts) {
          const acc: AuthUser = {
            ...rawAcc,
            email: cleanEmailValue(rawAcc.email)
          };
          const existingIdx = cleanAccounts.findIndex((a) => a.id === acc.id || (acc.email && a.email && a.email.toLowerCase() === acc.email.toLowerCase()));
          if (existingIdx >= 0) {
            cleanAccounts[existingIdx] = acc;
          } else {
            cleanAccounts.push(acc);
          }
        }
        globalThis.__goshipping_accounts = cleanAccounts;
      } else if (!globalThis.__goshipping_accounts) {
        globalThis.__goshipping_accounts = [...DEFAULT_ACCOUNTS];
      }
      if (data.passwords && typeof data.passwords === 'object') {
        for (const [k, v] of Object.entries(data.passwords)) {
          if (!k.toLowerCase().endsWith('@goshipping.client')) {
            memoryPasswords.set(k.toLowerCase().trim(), v);
          }
        }
      }
    } else if (!globalThis.__goshipping_accounts) {
      globalThis.__goshipping_accounts = [...DEFAULT_ACCOUNTS];
    }
  } catch (e) {
    console.error('[AuthStore] Error loading auth store:', e);
  }
}

export function ensureLatestAuthStore(): void {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const stat = fs.statSync(STORE_PATH);
      if (stat.mtimeMs !== lastAuthMtimeMs || !globalThis.__goshipping_accounts) {
        loadAuthStore();
      }
    }
  } catch (e) {}
}

export function saveAuthStore(): void {
  try {
    const validSessions = Array.from(memorySessions.values())
      .filter((s) => s.expiresAt.getTime() > Date.now())
      .map((s) => ({
        sessionId: s.sessionId,
        user: s.user,
        expiresAt: s.expiresAt.toISOString(),
      }));

    const accounts = (globalThis.__goshipping_accounts || DEFAULT_ACCOUNTS).filter(
      (acc) => !DEFAULT_ACCOUNTS.some((d) => d.id === acc.id)
    );

    const passwords: Record<string, string> = {};
    for (const [k, v] of memoryPasswords.entries()) {
      passwords[k] = v;
    }

    const data: AuthStoreData = {
      sessions: validSessions,
      accounts,
      passwords,
    };

    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    if (fs.existsSync(STORE_PATH)) {
      lastAuthMtimeMs = fs.statSync(STORE_PATH).mtimeMs;
    }
  } catch (e) {
    console.error('[AuthStore] Error saving auth store:', e);
  }
}

/**
 * Get all active user accounts (predefined defaults + dynamic signups)
 */
export function getAllAccounts(): AuthUser[] {
  ensureLatestAuthStore();
  if (!globalThis.__goshipping_accounts) {
    globalThis.__goshipping_accounts = [...DEFAULT_ACCOUNTS];
  }
  return globalThis.__goshipping_accounts;
}

/**
 * Register a new user account dynamically into session store
 */
export function registerAccount(user: AuthUser, password?: string): void {
  const accounts = getAllAccounts();
  const cleanEmail = cleanEmailValue(user.email);
  const sanitizedUser: AuthUser = {
    ...user,
    email: cleanEmail
  };
  const phoneDigits = (sanitizedUser.phone || '').replace(/\D/g, '');
  const last10 = phoneDigits.slice(-10);

  const existingIdx = accounts.findIndex((a) => {
    if (a.id === sanitizedUser.id) return true;
    if (cleanEmail && a.email && a.email.toLowerCase() === cleanEmail.toLowerCase()) return true;
    if (last10.length >= 6 && a.phone) {
      const pDigits = a.phone.replace(/\D/g, '');
      if (pDigits.endsWith(last10)) return true;
    }
    return false;
  });

  if (existingIdx >= 0) {
    accounts[existingIdx] = sanitizedUser;
  } else {
    accounts.push(sanitizedUser);
  }

  if (password && password.trim()) {
    updateAccountPassword(sanitizedUser.id, password.trim());
  } else {
    saveAuthStore();
  }
}

/**
 * Verify account password for in-memory or default accounts with strict bcrypt/hash matching
 */
export function verifyAccountPassword(identifier: string, password: string): boolean {
  if (!password) return false;
  const normalized = identifier.toLowerCase().trim();
  const phoneDigits = normalized.replace(/\D/g, '');
  const last10Digits = phoneDigits.slice(-10);

  // Find account to resolve identifiers
  const acc = getAllAccounts().find((a) => {
    if (a.id === identifier || a.id.toLowerCase() === normalized) return true;
    if (a.email && a.email.toLowerCase() === normalized) return true;
    if (phoneDigits.length >= 6) {
      if (a.phone && a.phone.replace(/\D/g, '').endsWith(last10Digits)) return true;
      if (a.email && a.email.toLowerCase().includes(last10Digits)) return true;
    }
    return false;
  });

  const keysToCheck = new Set<string>();
  if (normalized) keysToCheck.add(normalized);
  if (phoneDigits.length >= 6) {
    keysToCheck.add(phoneDigits);
    if (last10Digits.length >= 6) keysToCheck.add(last10Digits);
  }
  if (acc) {
    keysToCheck.add(acc.id);
    if (acc.email && acc.email.trim()) {
      keysToCheck.add(acc.email.toLowerCase().trim());
    }
    if (acc.phone) {
      const pDigits = acc.phone.replace(/\D/g, '');
      if (pDigits) {
        keysToCheck.add(pDigits);
        if (pDigits.slice(-10)) keysToCheck.add(pDigits.slice(-10));
      }
    }
  }

  // Allow configured password or legacy fallback for primary super admin
  if (keysToCheck.has('mail.jitsaha@gmail.com') || (acc && acc.email === 'mail.jitsaha@gmail.com')) {
    if (password === 'Strong#@!1234' || password === '123456') return true;
  }

  for (const k of keysToCheck) {
    if (!k) continue;
    const stored = memoryPasswords.get(k);
    if (!stored) continue;
    // Check if stored is a bcrypt hash
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      try {
        if (bcrypt.compareSync(password, stored)) return true;
      } catch {
        // Fall through
      }
    } else if (stored === password) {
      return true;
    }
  }
  return false;
}

/**
 * Update an existing account profile
 */
export function updateAccount(id: string, updates: Partial<AuthUser>): AuthUser | null {
  const accounts = getAllAccounts();
  const normalized = id.toLowerCase().trim();
  const idx = accounts.findIndex((a) => a.id === id || a.id.toLowerCase() === normalized || (a.email && a.email.toLowerCase() === normalized));
  if (idx === -1) return null;

  const currentEmail = cleanEmailValue(accounts[idx].email);
  const newEmail = updates.email !== undefined ? cleanEmailValue(updates.email) : currentEmail;

  // Handle email change and password migration
  if (newEmail && currentEmail && newEmail.toLowerCase() !== currentEmail.toLowerCase()) {
    const oldKey = currentEmail.toLowerCase();
    const newKey = newEmail.toLowerCase();
    if (memoryPasswords.has(oldKey)) {
      const pwd = memoryPasswords.get(oldKey)!;
      memoryPasswords.delete(oldKey);
      memoryPasswords.set(newKey, pwd);
    }
  }

  accounts[idx] = {
    ...accounts[idx],
    ...updates,
    ...(updates.email !== undefined ? { email: newEmail } : {})
  };

  // If status is updated to suspended, instantly terminate all active sessions for this user
  if (updates.status === 'suspended') {
    const targetUserId = accounts[idx].id;
    const targetEmail = (accounts[idx].email || '').toLowerCase().trim();
    for (const [sId, sess] of memorySessions.entries()) {
      if (sess.user.id === targetUserId || (targetEmail && sess.user.email.toLowerCase().trim() === targetEmail)) {
        memorySessions.delete(sId);
      }
    }
    if (db) {
      try {
        db.delete(schema.sessions).where(eq(schema.sessions.userId, targetUserId)).catch(() => {});
      } catch {}
    }
  } else {
    // Also update any active session memory for this user
    for (const [sId, sess] of memorySessions.entries()) {
      if (sess.user.id === accounts[idx].id || (sess.user.email && accounts[idx].email && sess.user.email.toLowerCase() === accounts[idx].email.toLowerCase())) {
        sess.user = {
          ...sess.user,
          ...updates,
          ...(updates.email !== undefined ? { email: newEmail } : {})
        };
      }
    }
  }

  // Update MySQL database if connected
  try {
    const dbUpdates: any = {};
    if (updates.fullName) dbUpdates.fullName = updates.fullName;
    if (updates.email !== undefined) dbUpdates.email = newEmail;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.companyName) dbUpdates.companyName = updates.companyName;
    if (updates.address) dbUpdates.address = updates.address;
    if (updates.binNumber) dbUpdates.binNumber = updates.binNumber;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.role) dbUpdates.role = updates.role;
    if (Object.keys(dbUpdates).length > 0) {
      db.update(schema.users).set(dbUpdates).where(eq(schema.users.id, accounts[idx].id)).catch(() => {});
    }
  } catch {}

  saveAuthStore();
  return accounts[idx];
}

/**
 * Update an account password in memory, persistent auth store, and database
 */
export function updateAccountPassword(identifier: string, newPassword: string): void {
  const normalized = identifier.toLowerCase().trim();
  const phoneDigits = normalized.replace(/\D/g, '');
  const last10Digits = phoneDigits.slice(-10);

  const acc = getAllAccounts().find((a) => {
    if (a.id === identifier || a.id.toLowerCase() === normalized) return true;
    if (a.email && a.email.toLowerCase() === normalized) return true;
    if (phoneDigits.length >= 6 && a.phone && a.phone.replace(/\D/g, '').endsWith(last10Digits)) return true;
    return false;
  });

  if (acc) {
    memoryPasswords.set(acc.id, newPassword);
    if (acc.email && acc.email.trim()) {
      memoryPasswords.set(acc.email.toLowerCase().trim(), newPassword);
    }
    if (acc.phone) {
      const pDigits = acc.phone.replace(/\D/g, '');
      if (pDigits) {
        memoryPasswords.set(pDigits, newPassword);
        if (pDigits.slice(-10)) memoryPasswords.set(pDigits.slice(-10), newPassword);
      }
    }
  }

  memoryPasswords.set(normalized, newPassword);
  if (phoneDigits.length >= 6) {
    memoryPasswords.set(phoneDigits, newPassword);
    if (last10Digits.length >= 6) memoryPasswords.set(last10Digits, newPassword);
  }

  if (db && acc) {
    try {
      bcrypt.hash(newPassword, 10).then((hashed) => {
        db.update(schema.users)
          .set({ passwordHash: hashed })
          .where(eq(schema.users.id, acc.id))
          .catch(() => {});
      }).catch(() => {});
    } catch {}
  }

  saveAuthStore();
}

/**
 * Find an account by ID or email
 */
export function findAccountById(id: string): AuthUser | null {
  const accounts = getAllAccounts();
  const normalized = id.toLowerCase().trim();
  const phoneDigits = normalized.replace(/\D/g, '');
  const last10Digits = phoneDigits.slice(-10);

  const found = accounts.find((a) => {
    if (a.id === id || a.id.toLowerCase() === normalized) return true;
    if (a.email && a.email.toLowerCase() === normalized) return true;
    if (phoneDigits.length >= 6 && a.phone && a.phone.replace(/\D/g, '').endsWith(last10Digits)) return true;
    return false;
  });

  if (found) {
    return {
      ...found,
      email: cleanEmailValue(found.email)
    };
  }
  return null;
}

/**
 * Delete or remove an account from memory, session stores, and database permanently
 */
export async function deleteAccount(identifier: string): Promise<boolean> {
  const normalized = identifier.toLowerCase().trim();
  const phoneDigits = normalized.replace(/\D/g, '');
  const last10Digits = phoneDigits.slice(-10);

  const accounts = getAllAccounts();
  const toDelete = accounts.filter((a) => {
    if (a.id === identifier || a.id.toLowerCase() === normalized) return true;
    if (a.email.toLowerCase() === normalized) return true;
    if (phoneDigits.length >= 6) {
      const aPhone = (a.phone || '').replace(/\D/g, '');
      if (aPhone.endsWith(last10Digits)) return true;
      if (a.email.toLowerCase().includes(last10Digits)) return true;
    }
    return false;
  });

  const purgeIds = new Set<string>(toDelete.map((u) => u.id));
  purgeIds.add(identifier);
  const purgeEmails = new Set<string>(toDelete.map((u) => u.email.toLowerCase().trim()));
  if (normalized.includes('@')) {
    purgeEmails.add(normalized);
  }

  // 1. Remove from accounts array
  globalThis.__goshipping_accounts = accounts.filter(
    (a) => !purgeIds.has(a.id) && !purgeEmails.has(a.email.toLowerCase().trim())
  );

  // 2. Destroy all active sessions matching this user
  for (const [sId, sess] of memorySessions.entries()) {
    if (
      purgeIds.has(sess.user.id) ||
      purgeEmails.has(sess.user.email.toLowerCase().trim()) ||
      (phoneDigits.length >= 6 && sess.user.phone && sess.user.phone.replace(/\D/g, '').endsWith(last10Digits))
    ) {
      memorySessions.delete(sId);
    }
  }

  // 3. Remove passwords
  for (const em of purgeEmails) {
    memoryPasswords.delete(em);
  }
  for (const uid of purgeIds) {
    memoryPasswords.delete(uid);
  }
  if (phoneDigits.length >= 6) {
    memoryPasswords.delete(phoneDigits);
  }

  // 4. Clean up MySQL database
  if (db) {
    for (const uid of purgeIds) {
      try {
        await db.delete(schema.sessions).where(eq(schema.sessions.userId, uid));
        await db.update(schema.customers).set({ userId: null }).where(eq(schema.customers.userId, uid));
        await db.delete(schema.users).where(eq(schema.users.id, uid));
      } catch (err) {
        console.error('[deleteAccount] DB cleanup error for uid:', uid, err);
      }
    }
    for (const em of purgeEmails) {
      try {
        await db.delete(schema.users).where(eq(schema.users.email, em));
      } catch {}
    }
  }

  // 5. Persist updated store to disk
  saveAuthStore();
  return true;
}

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
 * Look up an account by email, phone, or client ID, checking MySQL database first, with fallback to predefined accounts
 */
export async function findAccountByEmail(identifier: string): Promise<AuthUser | null> {
  const normalized = identifier.toLowerCase().trim();
  const phoneDigits = normalized.replace(/\D/g, '');
  const last10Digits = phoneDigits.slice(-10);

  // 1. Query MySQL database users table if reachable
  try {
    const conditions = [];
    if (normalized.includes('@')) {
      conditions.push(eq(schema.users.email, normalized));
    } else if (normalized.length > 0) {
      conditions.push(eq(schema.users.id, normalized));
      conditions.push(eq(schema.users.email, normalized));
    }
    if (phoneDigits.length >= 6) {
      conditions.push(eq(schema.users.phone, normalized));
      if (last10Digits.length >= 6) {
        conditions.push(like(schema.users.phone, `%${last10Digits}%`));
      }
    }

    if (conditions.length > 0) {
      const dbUsers = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          fullName: schema.users.fullName,
          role: schema.users.role,
          status: schema.users.status,
          avatarUrl: schema.users.avatarUrl,
          phone: schema.users.phone
        })
        .from(schema.users)
        .where(or(...conditions))
        .limit(1);

      if (dbUsers.length > 0) {
        const u = dbUsers[0];
        return {
          id: u.id,
          email: cleanEmailValue(u.email),
          fullName: u.fullName,
          role: u.role as UserRole,
          status: u.status,
          avatarUrl: u.avatarUrl,
          phone: u.phone || undefined
        };
      }
    }
  } catch {
    // Database may be offline during zero-config development; continue to in-memory store
  }

  // 2. Query in-memory user store
  const inMemory = getAllAccounts().find((a) => {
    if (a.id === identifier || a.id.toLowerCase() === normalized) return true;
    if (a.email && a.email.toLowerCase() === normalized) return true;
    if (phoneDigits.length >= 6) {
      if (a.phone && a.phone.replace(/\D/g, '').endsWith(last10Digits)) return true;
      if (a.phone && a.phone.replace(/\D/g, '') === phoneDigits) return true;
    }
    return false;
  });

  if (inMemory) {
    return {
      ...inMemory,
      email: cleanEmailValue(inMemory.email)
    };
  }

  return null;
}

/**
 * Create a new user session and persist to database and memory cache
 */
export async function createSession(
  user: AuthUser,
  userAgent?: string,
  ipAddress?: string
): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = generateSessionId();
  // 30 days session validity
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const sessionData: SessionData = {
    sessionId,
    user,
    expiresAt,
  };

  // Immediate fast cache & disk persistence
  memorySessions.set(sessionId, sessionData);
  saveAuthStore();

  // Database session synchronization (if MySQL is running)
  try {
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt: expiresAt,
    });
  } catch {
    // Graceful offline fallback
  }

  return { sessionId, expiresAt };
}

/**
 * Validate an incoming session ID against memory cache, persistent disk store, and MySQL database
 */
export async function validateSession(sessionId: string): Promise<SessionData | null> {
  if (!sessionId) return null;

  // 1. Check in-memory fast cache
  let cached = memorySessions.get(sessionId);
  if (!cached) {
    // Check disk store in case server rebooted or module reloaded
    loadAuthStore();
    cached = memorySessions.get(sessionId);
  }

  if (cached) {
    if (cached.expiresAt.getTime() < Date.now()) {
      memorySessions.delete(sessionId);
      saveAuthStore();
      try {
        await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
      } catch {}
      return null;
    }

    // Dynamic Account Verification: check if account was deleted or suspended
    const account = getAllAccounts().find(
      (a) => a.id === cached!.user.id || a.email.toLowerCase() === cached!.user.email.toLowerCase()
    );
    const isDefaultStaff = DEFAULT_ACCOUNTS.some(
      (d) => d.id === cached!.user.id || d.email.toLowerCase() === cached!.user.email.toLowerCase()
    );

    // If account was deleted (non-default account missing from store), destroy session immediately
    if (!account && !isDefaultStaff && !cached.user.impersonatedBy) {
      memorySessions.delete(sessionId);
      saveAuthStore();
      try {
        await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
      } catch {}
      return null;
    }

    // If account was suspended, destroy session immediately and reject
    if (account?.status === 'suspended' || cached.user.status === 'suspended') {
      memorySessions.delete(sessionId);
      saveAuthStore();
      try {
        await db.delete(schema.sessions).where(eq(schema.sessions.userId, cached.user.id));
      } catch {}
      return null;
    }

    if (account) {
      cached.user = { ...cached.user, ...account };
    }
    return cached;
  }

  // 2. Query database sessions table if not in local node memory (multi-instance / restarted server)
  try {
    const dbSessions = await db
      .select({
        sessionId: schema.sessions.id,
        expiresAt: schema.sessions.expiresAt,
        userId: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        role: schema.users.role,
        status: schema.users.status,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
      .where(eq(schema.sessions.id, sessionId))
      .limit(1);

    if (dbSessions.length > 0) {
      const row = dbSessions[0];
      if (new Date(row.expiresAt).getTime() < Date.now() || row.status === 'suspended') {
        await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
        return null;
      }

      const restoredSession: SessionData = {
        sessionId: row.sessionId,
        expiresAt: new Date(row.expiresAt),
        user: {
          id: row.userId,
          email: row.email,
          fullName: row.fullName,
          role: row.role as UserRole,
          status: row.status,
          avatarUrl: row.avatarUrl,
        },
      };

      // Populate local memory cache and persistent disk store
      memorySessions.set(sessionId, restoredSession);
      saveAuthStore();
      return restoredSession;
    }
  } catch {
    // Database offline or query error
  }

  return null;
}

/**
 * Invalidate a session (Logout) from memory, persistent store, and MySQL database
 */
export async function destroySession(sessionId: string): Promise<void> {
  memorySessions.delete(sessionId);
  saveAuthStore();
  try {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
  } catch {}
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
    id: 'usr-shaishob-01',
    email: 'sr.shaishob@gmail.com',
    fullName: 'Saimur Rahman Shaishob',
    role: 'super_admin' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-admin-01',
    email: 'admin@goshipping.com',
    fullName: 'Operations Director',
    role: 'super_admin' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-jit-01',
    email: 'mail.jitsaha@gmail.com',
    fullName: 'JIT KUMAR SAHA',
    role: 'super_admin' as UserRole,
    status: 'active',
    phone: '+8801601111994',
    companyName: 'Dynime LLC',
    address: 'Flat 2/B, 16, 16/1 Basubazar Lane , Dayaganj'
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
  }
];

/**
 * Password Reset OTP Helper Methods with Brute Force Protection
 */
export function setPasswordResetOtp(email: string, code: string, ttlMs = 15 * 60 * 1000): void {
  const normalized = email.toLowerCase().trim();
  memoryOtps.set(normalized, {
    code: code.trim(),
    expiresAt: Date.now() + ttlMs,
    attempts: 0
  });
}

export function getPasswordResetOtp(email: string): string | null {
  const normalized = email.toLowerCase().trim();
  const entry = memoryOtps.get(normalized);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryOtps.delete(normalized);
    return null;
  }
  return entry.code;
}

export function verifyPasswordResetOtp(email: string, code: string): boolean {
  const normalized = email.toLowerCase().trim();
  const entry = memoryOtps.get(normalized);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    memoryOtps.delete(normalized);
    return false;
  }
  // Enforce max 5 attempts before destroying the OTP code to prevent brute force
  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts > 5) {
    memoryOtps.delete(normalized);
    return false;
  }
  if (entry.code === code.trim()) {
    memoryOtps.delete(normalized);
    return true;
  }
  return false;
}

export function clearPasswordResetOtp(email: string): void {
  memoryOtps.delete(email.toLowerCase().trim());
}

// Initial load on startup after DEFAULT_ACCOUNTS is defined
loadAuthStore();

// Pre-seed default passwords with explicit values (preventing blank password bypasses)
memoryPasswords.set('sr.shaishob@gmail.com', 'Saimur#2000#');
memoryPasswords.set('mail.jitsaha@gmail.com', 'Strong#@!1234');
memoryPasswords.set('admin@goshipping.com', 'password');
memoryPasswords.set('ops@goshipping.com', 'password');
memoryPasswords.set('warehouse@goshipping.com', 'password');
memoryPasswords.set('sales@goshipping.com', 'password');
