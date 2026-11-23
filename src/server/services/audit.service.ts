import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/client';
import { auditLogs } from '../db/schema';

export interface AuditEntry {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

const STORE_PATH = path.resolve(process.cwd(), '.audit_store.json');

declare global {
  var __goshipping_audit_logs: AuditEntry[] | undefined;
}

let initialAuditLogs: AuditEntry[] = [
  {
    id: 'aud-101',
    userId: 'usr-admin-01',
    userName: 'Operations Director',
    action: 'QUOTE_PRICING_UPDATED',
    entityType: 'quote',
    entityId: 'qte-4401',
    details: { revisionNumber: 1, totalAmount: 14725, currency: 'BDT' },
    ipAddress: '103.112.54.12',
    createdAt: '2026-10-24T11:30:00Z'
  },
  {
    id: 'aud-102',
    userId: 'usr-ops-01',
    userName: 'Kamal Hossain',
    action: 'SHIPMENT_STATUS_TRANSIT',
    entityType: 'shipment',
    entityId: 'shp-9812-dac',
    details: { status: 'in_transit', carrier: 'Emirates SkyCargo' },
    ipAddress: '103.112.54.14',
    createdAt: '2026-10-24T17:40:00Z'
  }
];

function loadAuditLogsFromFile(): AuditEntry[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[AuditService] Failed to load store:', err);
  }
  return initialAuditLogs;
}

let lastStoreMtimeMs = 0;

function saveAuditLogsToFile(data: AuditEntry[]): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    if (fs.existsSync(STORE_PATH)) {
      lastStoreMtimeMs = fs.statSync(STORE_PATH).mtimeMs;
    }
  } catch (err) {
    console.error('[AuditService] Failed to save store:', err);
  }
}

function ensureLatestAuditStore(): void {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const stat = fs.statSync(STORE_PATH);
      if (stat.mtimeMs !== lastStoreMtimeMs || !memoryAuditLogs || memoryAuditLogs.length === 0) {
        lastStoreMtimeMs = stat.mtimeMs;
        const loaded = loadAuditLogsFromFile();
        if (loaded.length > 0) {
          memoryAuditLogs = loaded;
          globalThis.__goshipping_audit_logs = memoryAuditLogs;
        }
      }
    }
  } catch (err) {
    console.error('[AuditService] ensureLatestStore error:', err);
  }
}

let memoryAuditLogs: AuditEntry[] = globalThis.__goshipping_audit_logs || loadAuditLogsFromFile();
globalThis.__goshipping_audit_logs = memoryAuditLogs;

export class AuditService {
  static async logAction(entry: Omit<AuditEntry, 'id' | 'createdAt'>): Promise<AuditEntry> {
    ensureLatestAuditStore();
    const record: AuditEntry = {
      id: `aud-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      ...entry
    };

    if (!memoryAuditLogs) {
      memoryAuditLogs = [];
    }
    memoryAuditLogs.unshift(record);
    globalThis.__goshipping_audit_logs = memoryAuditLogs;

    saveAuditLogsToFile(memoryAuditLogs);

    // Dual write to MySQL audit_logs
    try {
      await db.insert(auditLogs).values({
        id: record.id,
        userId: record.userId || null,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId || null,
        details: record.details || null,
        ipAddress: record.ipAddress || null,
        createdAt: new Date(record.createdAt)
      });
    } catch (dbErr) {
      // Async failure is non-fatal
    }

    return record;
  }

  static async listLogs(limit = 50): Promise<AuditEntry[]> {
    ensureLatestAuditStore();
    return (memoryAuditLogs || []).slice(0, limit);
  }
}
