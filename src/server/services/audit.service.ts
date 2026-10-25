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

let initialAuditLogs: AuditEntry[] = [
  {
    id: 'aud-101',
    userId: 'usr-admin-01',
    userName: 'Operations Director',
    action: 'QUOTE_PRICING_UPDATED',
    entityType: 'quote',
    entityId: 'qte-4401',
    details: { revisionNumber: 1, totalAmount: 329400, currency: 'BDT' },
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

export class AuditService {
  static async logAction(entry: Omit<AuditEntry, 'id' | 'createdAt'>): Promise<AuditEntry> {
    const record: AuditEntry = {
      id: `aud-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      ...entry
    };
    initialAuditLogs.unshift(record);
    return record;
  }

  static async listLogs(limit = 50): Promise<AuditEntry[]> {
    return initialAuditLogs.slice(0, limit);
  }
}
