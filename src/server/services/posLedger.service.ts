import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { db } from '../db/client';
import { posLedger } from '../db/schema';
import { eq, desc, or } from 'drizzle-orm';
import { syncOrderToGoogleSheet, setSyncStatusListener } from './googleSheetSync.service';

export interface PaymentEntry {
  id: string;
  amount: number;
  dateTime: string; // BST formatted timestamp string, e.g. "19 Nov 2026, 05:45 PM BST"
  method: string;   // 'bKash' | 'Nagad' | 'Bank Transfer' | 'Cash' | 'Upay' | 'Rocket' | string
  trxId?: string;
  milestone?: string; // 'Order Advance' | 'China Warehouse Received' | 'Dispatched from China' | 'Bangladesh HSIA Arrival' | 'Doorstep Delivery' | string
  note?: string;
  recordedBy?: string;
}

export interface PosLedgerRecord {
  id: string;
  orderId: string;
  orderDate: string;
  cnDate: string;
  bdDate: string;
  customerName: string;
  mobileNo: string;
  importerClient: string;
  shippingMark: string;
  websiteOrderNo: string;
  itemDetails: string;
  chinaCourierTracking: string;
  currentStatus: string;
  supplierName: string;
  quantity: number;
  unitPriceRmb: number;
  totalPurchaseRmb: number;
  rmbRateBdt: number;
  purchaseCostBdt: number;
  purchaseCostPaidBdt: number;
  purchaseCostDueBdt: number;
  serviceType: string;
  cnWeightKg: number;
  bdWeightKg: number;
  shippingRatePerKgBdt: number;
  internationalFreightBdt: number;
  packingFeeBdt?: number;
  deliveryAddress?: string;
  totalBillBdt: number;
  paymentStatus: 'Due' | 'Paid' | 'Partial';
  payments?: PaymentEntry[];
  trackingNumber?: string;
  bdCourierName?: string;
  bdTrackingNo?: string;
  remark?: string;
  profitEstimateBdt?: number;
  sheetSyncStatus?: 'synced' | 'failed' | 'pending';
  sheetSyncedAt?: string;
  sheetSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

const STORE_PATH = path.resolve(process.cwd(), '.pos_ledger_store.json');

declare global {
  var __goshipping_pos_ledger: PosLedgerRecord[] | undefined;
}

export function autoCalculatePosFields(input: Partial<PosLedgerRecord>): {
  totalPurchaseRmb: number;
  purchaseCostBdt: number;
  purchaseCostPaidBdt: number;
  purchaseCostDueBdt: number;
  internationalFreightBdt: number;
  packingFeeBdt?: number;
  deliveryAddress?: string;
  totalBillBdt: number;
  paymentStatus: 'Due' | 'Paid' | 'Partial';
} {
  const qty = Number(input.quantity) || 0;
  const unitRmb = Number(input.unitPriceRmb) || 0;
  const totalRmb = Math.round(qty * unitRmb * 100) / 100;

  const rmbRate = Number(input.rmbRateBdt) || 19.5;
  const purchaseCostBdt = Math.round(totalRmb * rmbRate * 100) / 100;

  const bdWeight = Number(input.bdWeightKg) || Number(input.cnWeightKg) || 0;
  const shippingRate = Number(input.shippingRatePerKgBdt) || 0;
  const intlFreightBdt = Math.round(bdWeight * shippingRate * 100) / 100;

  const packingFeeBdt = Number(input.packingFeeBdt) || 0;
  const totalBillBdt = Math.round((purchaseCostBdt + intlFreightBdt + packingFeeBdt) * 100) / 100;

  // If input has payment entries, calculate total paid from payments
  let paidBdt = Number(input.purchaseCostPaidBdt) || 0;
  if (Array.isArray(input.payments) && input.payments.length > 0) {
    paidBdt = input.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  const purchaseDueBdt = Math.max(0, Math.round((totalBillBdt - paidBdt) * 100) / 100);

  let paymentStatus: 'Due' | 'Paid' | 'Partial' = 'Due';
  if (paidBdt >= totalBillBdt && totalBillBdt > 0) {
    paymentStatus = 'Paid';
  } else if (paidBdt > 0) {
    paymentStatus = 'Partial';
  } else {
    paymentStatus = 'Due';
  }

  return {
    totalPurchaseRmb: totalRmb,
    purchaseCostBdt,
    purchaseCostPaidBdt: paidBdt,
    purchaseCostDueBdt: purchaseDueBdt,
    internationalFreightBdt: intlFreightBdt,
    packingFeeBdt,
    totalBillBdt,
    paymentStatus
  };
}

function getInitialRecords(): PosLedgerRecord[] {
  return [];
}

/**
 * Normalizes legacy POS-XXXX-XXXX IDs to clean brand sequential format: GOS-XXXXX (e.g. GOS-00001, GOS-00023)
 */
function normalizeOrderId(orderId: string | undefined, fallbackSeq: number): string {
  if (!orderId || !orderId.trim()) {
    return `GOS-${String(fallbackSeq).padStart(5, '0')}`;
  }
  const clean = orderId.trim();
  // Already in GOS-XXXXX format
  if (/^GOS-\d{4,6}$/i.test(clean)) {
    return clean.toUpperCase();
  }
  // If old POS-2026-001 or POS-2026-0005, extract the trailing number
  if (/^POS-/i.test(clean)) {
    const match = clean.match(/(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        return `GOS-${String(num).padStart(5, '0')}`;
      }
    }
  }
  return clean;
}

function loadFromFile(): PosLedgerRecord[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return [];
        let hasMigrations = false;
        const normalized = parsed.map((item, idx) => {
          const cleanOrderId = normalizeOrderId(item.orderId, idx + 1);
          if (cleanOrderId !== item.orderId) {
            hasMigrations = true;
          }
          return {
            ...item,
            orderId: cleanOrderId,
            sheetSyncStatus: item.sheetSyncStatus || 'synced'
          };
        });
        if (hasMigrations) {
          saveToFile(normalized);
        }
        return normalized;
      }
    }
  } catch (err) {
    console.error('[PosLedgerService] Failed to load store:', err);
  }
  return [];
}

let lastStoreMtimeMs = 0;

function saveToFile(data: PosLedgerRecord[]): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    if (fs.existsSync(STORE_PATH)) {
      lastStoreMtimeMs = fs.statSync(STORE_PATH).mtimeMs;
    }
  } catch (err) {
    console.error('[PosLedgerService] Failed to save store:', err);
  }
}

function ensureLatestStore(): void {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const stat = fs.statSync(STORE_PATH);
      if (stat.mtimeMs !== lastStoreMtimeMs || !memoryLedger || memoryLedger.length === 0) {
        lastStoreMtimeMs = stat.mtimeMs;
        const loaded = loadFromFile();
        if (loaded.length > 0 || !memoryLedger || memoryLedger.length === 0) {
          memoryLedger = loaded;
          globalThis.__goshipping_pos_ledger = memoryLedger;
        }
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }
}

let memoryLedger: PosLedgerRecord[] = globalThis.__goshipping_pos_ledger || loadFromFile();
globalThis.__goshipping_pos_ledger = memoryLedger;
if (fs.existsSync(STORE_PATH)) {
  try {
    lastStoreMtimeMs = fs.statSync(STORE_PATH).mtimeMs;
  } catch {}
}

// Connect sync status listener so all background Google Sheet syncs automatically reflect in memory and database
setSyncStatusListener((idOrOrderId, status, error) => {
  PosLedgerService.updateSheetSyncStatusInMemory(idOrOrderId, status, error);
});

export class PosLedgerService {
  /**
   * Update sync status in memory and database
   */
  static updateSheetSyncStatusInMemory(
    idOrOrderId: string,
    status: 'synced' | 'failed' | 'pending',
    error?: string
  ): void {
    const idx = memoryLedger.findIndex((r) => r.id === idOrOrderId || r.orderId === idOrOrderId);
    if (idx !== -1) {
      memoryLedger[idx].sheetSyncStatus = status;
      if (status === 'synced') {
        memoryLedger[idx].sheetSyncedAt = new Date().toISOString();
        memoryLedger[idx].sheetSyncError = undefined;
      } else if (status === 'failed') {
        memoryLedger[idx].sheetSyncError = error || 'Sync failed';
      }
      saveToFile(memoryLedger);

      try {
        db.update(posLedger).set({
          sheetSyncStatus: status,
          sheetSyncedAt: status === 'synced' ? new Date().toISOString() : undefined,
          sheetSyncError: status === 'failed' ? (error || 'Sync failed') : null
        }).where(eq(posLedger.id, memoryLedger[idx].id)).catch(() => {});
      } catch {}
    }
  }

  /**
   * Automatically retry all failed or pending Google Sheet syncs
   */
  static async retryFailedSyncs(): Promise<{ total: number; successful: number; failed: number }> {
    const failedRecords = memoryLedger.filter(
      (r) => r.sheetSyncStatus === 'failed' || r.sheetSyncStatus === 'pending'
    );
    let successful = 0;
    let failed = 0;
    for (const rec of failedRecords) {
      try {
        const res = await syncOrderToGoogleSheet(rec);
        if (res.success) {
          successful++;
        } else {
          failed++;
        }
        await new Promise((r) => setTimeout(r, 400));
      } catch {
        failed++;
      }
    }
    return { total: failedRecords.length, successful, failed };
  }
  /**
   * List records with optional filtering
   */
  static async listRecords(filters?: {
    search?: string;
    serviceType?: string;
    paymentStatus?: string;
    supplier?: string;
  }): Promise<PosLedgerRecord[]> {
    ensureLatestStore();
    // In-memory deduplication: prevent any twin duplicate records with identical orderId or identical timestamp/details
    const seenOrderIds = new Set<string>();
    const dedupedMemory: PosLedgerRecord[] = [];
    for (const r of memoryLedger) {
      const cleanOrderId = (r.orderId || '').trim().toUpperCase();
      if (cleanOrderId && seenOrderIds.has(cleanOrderId)) {
        continue; // Skip redundant duplicate
      }
      if (cleanOrderId) {
        seenOrderIds.add(cleanOrderId);
      }
      dedupedMemory.push(r);
    }

    let list = dedupedMemory;

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter((r) =>
        r.orderId.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.mobileNo.includes(q) ||
        r.importerClient.toLowerCase().includes(q) ||
        r.shippingMark.toLowerCase().includes(q) ||
        r.itemDetails.toLowerCase().includes(q) ||
        r.chinaCourierTracking.toLowerCase().includes(q) ||
        (r.bdTrackingNo && r.bdTrackingNo.toLowerCase().includes(q))
      );
    }

    if (filters?.serviceType && filters.serviceType !== 'all') {
      list = list.filter((r) => r.serviceType.toLowerCase() === filters.serviceType?.toLowerCase());
    }

    if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
      list = list.filter((r) => r.paymentStatus.toLowerCase() === filters.paymentStatus?.toLowerCase());
    }

    if (filters?.supplier && filters.supplier !== 'all') {
      list = list.filter((r) => r.supplierName.toLowerCase().includes(filters.supplier?.toLowerCase() || ''));
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async getById(id: string): Promise<PosLedgerRecord | null> {
    ensureLatestStore();
    const clean = id.trim().toUpperCase();
    const cleanAlnum = clean.replace(/[^A-Z0-9]/g, '');
    const numMatch = clean.match(/(\d+)$/);
    const num = numMatch ? parseInt(numMatch[1], 10) : NaN;

    return (
      memoryLedger.find((r) => {
        if (r.id === id) return true;
        if (r.orderId && r.orderId.toUpperCase() === clean) return true;
        if (r.trackingNumber && r.trackingNumber.toUpperCase() === clean) return true;
        if (r.bdTrackingNo && r.bdTrackingNo.toUpperCase() === clean) return true;
        if (r.chinaCourierTracking && r.chinaCourierTracking.toUpperCase() === clean) return true;
        if (r.shippingMark && r.shippingMark.toUpperCase() === clean) return true;

        if (cleanAlnum && r.orderId) {
          const rAlnum = r.orderId.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (rAlnum === cleanAlnum) return true;
        }

        if (!isNaN(num) && r.orderId) {
          const rNumMatch = r.orderId.match(/(\d+)$/);
          if (rNumMatch && parseInt(rNumMatch[1], 10) === num) {
            if (/^\d+$/.test(clean) || clean.startsWith('GOS') || clean.startsWith('POS')) {
              return true;
            }
          }
        }
        return false;
      }) || null
    );
  }

  /**
   * Create POS Order Record with Auto Calculations
   */
  /**
   * Generate next sequential Order ID in GOS-XXXXX brand format (e.g. GOS-00001, GOS-00023)
   * Strictly maintains serial numbering: 1 -> GOS-00001, 2 -> GOS-00002, 23 -> GOS-00023
   */
  static generateNextOrderId(): string {
    ensureLatestStore();
    let maxSeq = 0;
    for (const record of memoryLedger) {
      if (!record.orderId) continue;
      const match = record.orderId.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    const nextSeq = maxSeq + 1;
    return `GOS-${String(nextSeq).padStart(5, '0')}`;
  }

  /**
   * Create POS Order Record with Auto Calculations
   */
  static async createRecord(payload: Partial<PosLedgerRecord>): Promise<PosLedgerRecord> {
    ensureLatestStore();

    // Anti-duplicate protection: check for recent duplicate submission (within 20 seconds)
    const nowMs = Date.now();
    const candidateCustomer = (payload.customerName || '').trim().toLowerCase();
    const candidateItem = (payload.itemDetails || '').trim().toLowerCase();
    const candidateCnTracking = (payload.chinaCourierTracking || '').trim().toUpperCase();
    const candidateTracking = (payload.trackingNumber || '').trim().toUpperCase();
    const candidatePhone = (payload.mobileNo || '').replace(/\D/g, '');
    const candidateQty = Number(payload.quantity) || 1;
    const candidateUnitRmb = Number(payload.unitPriceRmb) || 0;

    const duplicate = memoryLedger.find((r) => {
      // 1. Explicit orderId match
      if (payload.orderId?.trim() && r.orderId.toUpperCase() === payload.orderId.trim().toUpperCase()) {
        return true;
      }
      // 2. Created within 20s anti-duplicate time window
      const recordTime = new Date(r.createdAt || 0).getTime();
      const isRecent = (nowMs - recordTime) < 20000;
      if (!isRecent) return false;

      // Same tracking number if explicitly passed
      if (candidateTracking && r.trackingNumber && r.trackingNumber.toUpperCase() === candidateTracking) {
        return true;
      }
      // Same China courier tracking if non-empty
      if (candidateCnTracking && candidateCnTracking.length >= 4 && r.chinaCourierTracking && r.chinaCourierTracking.toUpperCase() === candidateCnTracking) {
        return true;
      }
      // Same customer + phone + item + quantity + unit price
      const rPhone = (r.mobileNo || '').replace(/\D/g, '');
      const rCustomer = (r.customerName || '').trim().toLowerCase();
      const rItem = (r.itemDetails || '').trim().toLowerCase();
      if (
        rCustomer === candidateCustomer &&
        (candidatePhone && rPhone ? rPhone === candidatePhone : true) &&
        rItem === candidateItem &&
        Number(r.quantity) === candidateQty &&
        Number(r.unitPriceRmb) === candidateUnitRmb
      ) {
        return true;
      }
      return false;
    });

    if (duplicate) {
      console.warn(`[PosLedgerService] Duplicate order creation prevented. Returning existing order ${duplicate.orderId} (ID: ${duplicate.id})`);
      return duplicate;
    }

    const id = `pos-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const orderId = payload.orderId?.trim() ? payload.orderId.trim().toUpperCase() : PosLedgerService.generateNextOrderId();
    const today = new Date().toISOString().split('T')[0];

    const calc = autoCalculatePosFields(payload);

    const record: PosLedgerRecord = {
      id,
      orderId,
      orderDate: payload.orderDate !== undefined ? payload.orderDate : '',
      cnDate: payload.cnDate !== undefined ? payload.cnDate : '',
      bdDate: payload.bdDate || '',
      customerName: payload.customerName?.trim() || 'Valued Customer',
      mobileNo: payload.mobileNo?.trim() || '',
      importerClient: payload.importerClient?.trim() || '',
      shippingMark: payload.shippingMark?.trim() || '',
      websiteOrderNo: payload.websiteOrderNo?.trim() || '',
      itemDetails: payload.itemDetails?.trim() || 'General Cargo Products',
      chinaCourierTracking: payload.chinaCourierTracking?.trim() || '',
      currentStatus: payload.currentStatus || 'Processing',
      supplierName: payload.supplierName?.trim() || 'Taobao / 1688',
      quantity: Number(payload.quantity) || 1,
      unitPriceRmb: Number(payload.unitPriceRmb) || 0,
      totalPurchaseRmb: calc.totalPurchaseRmb,
      rmbRateBdt: Number(payload.rmbRateBdt) || 19.5,
      purchaseCostBdt: calc.purchaseCostBdt,
      purchaseCostPaidBdt: Number(payload.purchaseCostPaidBdt) || 0,
      purchaseCostDueBdt: calc.purchaseCostDueBdt,
      serviceType: payload.serviceType || 'Sourcing & Shipping',
      cnWeightKg: Number(payload.cnWeightKg) || 0,
      bdWeightKg: Number(payload.bdWeightKg) || 0,
      shippingRatePerKgBdt: Number(payload.shippingRatePerKgBdt) || 0,
      internationalFreightBdt: calc.internationalFreightBdt,
      packingFeeBdt: calc.packingFeeBdt || 0,
      totalBillBdt: calc.totalBillBdt,
      paymentStatus: calc.paymentStatus,
      trackingNumber: payload.trackingNumber || '',
      bdCourierName: payload.bdCourierName || '',
      bdTrackingNo: payload.bdTrackingNo || '',
      remark: payload.remark || '',
      sheetSyncStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    memoryLedger.unshift(record);
    saveToFile(memoryLedger);

    // Sync to DB if accessible
    try {
      await db.insert(posLedger).values({
        id: record.id,
        orderId: record.orderId,
        orderDate: record.orderDate,
        cnDate: record.cnDate,
        bdDate: record.bdDate,
        customerName: record.customerName,
        mobileNo: record.mobileNo,
        importerClient: record.importerClient,
        shippingMark: record.shippingMark,
        websiteOrderNo: record.websiteOrderNo,
        itemDetails: record.itemDetails,
        chinaCourierTracking: record.chinaCourierTracking,
        currentStatus: record.currentStatus,
        supplierName: record.supplierName,
        quantity: record.quantity,
        unitPriceRmb: String(record.unitPriceRmb),
        totalPurchaseRmb: String(record.totalPurchaseRmb),
        rmbRateBdt: String(record.rmbRateBdt),
        purchaseCostBdt: String(record.purchaseCostBdt),
        purchaseCostPaidBdt: String(record.purchaseCostPaidBdt),
        purchaseCostDueBdt: String(record.purchaseCostDueBdt),
        serviceType: record.serviceType,
        cnWeightKg: String(record.cnWeightKg),
        bdWeightKg: String(record.bdWeightKg),
        shippingRatePerKgBdt: String(record.shippingRatePerKgBdt),
        internationalFreightBdt: String(record.internationalFreightBdt),
        packingFeeBdt: String(record.packingFeeBdt || 0),
        totalBillBdt: String(record.totalBillBdt),
        paymentStatus: record.paymentStatus,
        bdCourierName: record.bdCourierName,
        bdTrackingNo: record.bdTrackingNo,
        remark: record.remark,
        payments: record.payments || []
      });
    } catch {}

    // Synchronous or background sync to Google Sheet
    try {
      const syncRes = await syncOrderToGoogleSheet(record);
      if (syncRes.success) {
        record.sheetSyncStatus = 'synced';
        record.sheetSyncedAt = new Date().toISOString();
        saveToFile(memoryLedger);
        try {
          await db.update(posLedger).set({
            sheetSyncStatus: 'synced',
            sheetSyncedAt: record.sheetSyncedAt
          }).where(eq(posLedger.id, record.id));
        } catch {}
      }
    } catch (err) {
      console.error('[GoogleSheetSync] Initial create sync error:', err);
    }

    return record;
  }

  /**
   * Update POS Record with Auto Recalculations & Synchronous Google Sheet Sync
   */
  static async updateRecord(id: string, updates: Partial<PosLedgerRecord>): Promise<PosLedgerRecord | null> {
    ensureLatestStore();
    const cleanId = String(id).trim();
    let idx = memoryLedger.findIndex(
      (r) => r.id === cleanId || r.orderId.toUpperCase() === cleanId.toUpperCase()
    );
    if (idx === -1 && updates.orderId) {
      const targetOrder = updates.orderId.trim().toUpperCase();
      idx = memoryLedger.findIndex((r) => r.orderId.toUpperCase() === targetOrder);
    }
    if (idx === -1) {
      try {
        const rows = await db.select().from(posLedger).where(
          or(eq(posLedger.id, cleanId), eq(posLedger.orderId, cleanId))
        );
        if (rows.length > 0) {
          const rec = rows[0] as unknown as PosLedgerRecord;
          memoryLedger.push(rec);
          idx = memoryLedger.length - 1;
        }
      } catch {}
    }
    if (idx === -1) return null;

    const existing = memoryLedger[idx];
    const oldOrderId = existing.orderId;
    const targetOrderId = updates.orderId ? updates.orderId.trim().toUpperCase() : existing.orderId;
    const merged = { ...existing, ...updates };
    const calc = autoCalculatePosFields(merged);

    const updated: PosLedgerRecord = {
      ...merged,
      ...calc,
      id: existing.id,
      orderId: targetOrderId,
      sheetSyncStatus: 'pending',
      updatedAt: new Date().toISOString()
    };

    memoryLedger[idx] = updated;
    saveToFile(memoryLedger);

    // Sync to DB
    try {
      await db.update(posLedger).set({
        orderId: updated.orderId,
        orderDate: updated.orderDate,
        cnDate: updated.cnDate,
        bdDate: updated.bdDate,
        customerName: updated.customerName,
        mobileNo: updated.mobileNo,
        importerClient: updated.importerClient,
        shippingMark: updated.shippingMark,
        websiteOrderNo: updated.websiteOrderNo,
        itemDetails: updated.itemDetails,
        chinaCourierTracking: updated.chinaCourierTracking,
        currentStatus: updated.currentStatus,
        supplierName: updated.supplierName,
        quantity: updated.quantity,
        unitPriceRmb: String(updated.unitPriceRmb),
        totalPurchaseRmb: String(updated.totalPurchaseRmb),
        rmbRateBdt: String(updated.rmbRateBdt),
        purchaseCostBdt: String(updated.purchaseCostBdt),
        purchaseCostPaidBdt: String(updated.purchaseCostPaidBdt),
        purchaseCostDueBdt: String(updated.purchaseCostDueBdt),
        serviceType: updated.serviceType,
        cnWeightKg: String(updated.cnWeightKg),
        bdWeightKg: String(updated.bdWeightKg),
        shippingRatePerKgBdt: String(updated.shippingRatePerKgBdt),
        internationalFreightBdt: String(updated.internationalFreightBdt),
        packingFeeBdt: String(updated.packingFeeBdt || 0),
        totalBillBdt: String(updated.totalBillBdt),
        paymentStatus: updated.paymentStatus,
        bdCourierName: updated.bdCourierName,
        bdTrackingNo: updated.bdTrackingNo,
        remark: updated.remark,
        payments: updated.payments || []
      }).where(eq(posLedger.id, existing.id));
    } catch {}

    // Await synchronous Google Sheet Sync so the caller receives the updated sync state
    try {
      const syncPayload = {
        ...updated,
        ...(oldOrderId !== targetOrderId ? { oldOrderId } : {})
      };
      const syncRes = await syncOrderToGoogleSheet(syncPayload as any);
      if (syncRes.success) {
        updated.sheetSyncStatus = 'synced';
        updated.sheetSyncedAt = new Date().toISOString();
        updated.sheetSyncError = undefined;
      } else {
        updated.sheetSyncStatus = 'failed';
        updated.sheetSyncError = syncRes.error;
      }
      memoryLedger[idx] = updated;
      saveToFile(memoryLedger);

      try {
        await db.update(posLedger).set({
          sheetSyncStatus: updated.sheetSyncStatus,
          sheetSyncedAt: updated.sheetSyncedAt,
          sheetSyncError: updated.sheetSyncError || null
        }).where(eq(posLedger.id, existing.id));
      } catch {}
    } catch (syncErr: any) {
      console.error('[GoogleSheetSync] Edit sync failed:', syncErr);
    }

    return updated;
  }

  /**
   * Delete Record
   */
  static async deleteRecord(id: string): Promise<boolean> {
    ensureLatestStore();
    const len = memoryLedger.length;
    memoryLedger = memoryLedger.filter((r) => r.id !== id && r.orderId !== id);
    if (memoryLedger.length !== len) {
      saveToFile(memoryLedger);
      try {
        await db.delete(posLedger).where(or(eq(posLedger.id, id), eq(posLedger.orderId, id)));
      } catch {}
      return true;
    }
    return false;
  }

  /**
   * Add Partial Payment / Installment Entry with Automatic Recalculation
   */
  static async addPayment(
    idOrOrderId: string,
    payment: Omit<PaymentEntry, 'id'>
  ): Promise<{ record: PosLedgerRecord; payment: PaymentEntry } | null> {
    ensureLatestStore();
    const cleanId = String(idOrOrderId).trim();
    const idx = memoryLedger.findIndex(
      (r) => r.id === cleanId || r.orderId.toUpperCase() === cleanId.toUpperCase()
    );
    if (idx === -1) return null;

    const record = { ...memoryLedger[idx] };
    const existingPayments = Array.isArray(record.payments) ? [...record.payments] : [];

    // If order already had an advance recorded previously but no payment history array exists yet,
    // establish the initial baseline entry
    if (record.purchaseCostPaidBdt > 0 && existingPayments.length === 0) {
      existingPayments.push({
        id: `pay-init-${record.id}`,
        amount: record.purchaseCostPaidBdt,
        dateTime: record.orderDate ? `${record.orderDate} BST` : 'Initial Order Advance BST',
        method: 'Advance',
        milestone: 'Order Confirmation Advance',
        note: 'Baseline advance registered at order creation'
      });
    }

    const bstDateTime = payment.dateTime || new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date()) + ' BST';

    const newPayment: PaymentEntry = {
      id: `pay-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      amount: Math.round((Number(payment.amount) || 0) * 100) / 100,
      dateTime: bstDateTime,
      method: payment.method || 'Cash',
      trxId: payment.trxId?.trim() || undefined,
      milestone: payment.milestone?.trim() || 'Installment Payment',
      note: payment.note?.trim() || undefined,
      recordedBy: payment.recordedBy?.trim() || 'Accounts Desk'
    };

    existingPayments.push(newPayment);
    record.payments = existingPayments;

    // Recalculate totals
    const totalPaid = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    record.purchaseCostPaidBdt = Math.round(totalPaid * 100) / 100;
    record.purchaseCostDueBdt = Math.max(0, Math.round((record.totalBillBdt - record.purchaseCostPaidBdt) * 100) / 100);

    if (record.purchaseCostDueBdt <= 0 && record.totalBillBdt > 0) {
      record.paymentStatus = 'Paid';
    } else if (record.purchaseCostPaidBdt > 0) {
      record.paymentStatus = 'Partial';
    } else {
      record.paymentStatus = 'Due';
    }
    record.updatedAt = new Date().toISOString();

    memoryLedger[idx] = record;
    saveToFile(memoryLedger);

    try {
      await db.update(posLedger).set({
        purchaseCostPaidBdt: String(record.purchaseCostPaidBdt),
        purchaseCostDueBdt: String(record.purchaseCostDueBdt),
        paymentStatus: record.paymentStatus,
        payments: record.payments
      }).where(eq(posLedger.id, record.id));
    } catch {}

    // Synchronous or background sync to Google Sheet
    try {
      syncOrderToGoogleSheet(record).catch(() => {});
    } catch {}

    return { record, payment: newPayment };
  }

  /**
   * Get overall outstanding financial summary across all active consignments for a customer
   */
  static async getCustomerOutstandingSummary(customerKey: string): Promise<{
    customerName: string;
    importerClient: string;
    totalOrders: number;
    activeOrders: number;
    totalBillBdt: number;
    totalPaidBdt: number;
    totalDueBdt: number;
    orders: Array<{
      id: string;
      orderId: string;
      itemDetails: string;
      currentStatus: string;
      totalBillBdt: number;
      purchaseCostPaidBdt: number;
      purchaseCostDueBdt: number;
      paymentStatus: string;
      shippingMark?: string;
    }>;
  }> {
    const k = (customerKey || '').trim().toLowerCase();
    const matching = memoryLedger.filter((r) => {
      if (!k) return false;
      return (
        r.customerName.toLowerCase().includes(k) ||
        r.importerClient.toLowerCase().includes(k) ||
        (r.shippingMark && r.shippingMark.toLowerCase().includes(k)) ||
        (r.mobileNo && r.mobileNo.includes(k))
      );
    });

    const totalOrders = matching.length;
    const activeOrders = matching.filter(
      (r) => !r.currentStatus.toLowerCase().includes('delivered')
    ).length;
    const totalBillBdt = Math.round(matching.reduce((s, r) => s + (Number(r.totalBillBdt) || 0), 0));
    const totalPaidBdt = Math.round(matching.reduce((s, r) => s + (Number(r.purchaseCostPaidBdt) || 0), 0));
    const totalDueBdt = Math.round(matching.reduce((s, r) => s + (Number(r.purchaseCostDueBdt) || 0), 0));

    const primary = matching[0] || { customerName: customerKey, importerClient: '' };

    return {
      customerName: primary.customerName || customerKey,
      importerClient: primary.importerClient || '',
      totalOrders,
      activeOrders,
      totalBillBdt,
      totalPaidBdt,
      totalDueBdt,
      orders: matching.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        itemDetails: r.itemDetails,
        currentStatus: r.currentStatus,
        totalBillBdt: Number(r.totalBillBdt) || 0,
        purchaseCostPaidBdt: Number(r.purchaseCostPaidBdt) || 0,
        purchaseCostDueBdt: Number(r.purchaseCostDueBdt) || 0,
        paymentStatus: r.paymentStatus,
        shippingMark: r.shippingMark
      }))
    };
  }

  /**
   * Compute POS Summary Statistics
   */
  static async getStats() {
    const totalOrders = memoryLedger.length;
    let totalPurchaseRmb = 0;
    let totalPurchaseBdt = 0;
    let totalFreightBdt = 0;
    let totalBilledBdt = 0;
    let totalCollectedBdt = 0;
    let totalDueBdt = 0;
    let totalWeightKg = 0;

    for (const r of memoryLedger) {
      totalPurchaseRmb += Number(r.totalPurchaseRmb) || 0;
      totalPurchaseBdt += Number(r.purchaseCostBdt) || 0;
      totalFreightBdt += Number(r.internationalFreightBdt) || 0;
      const billed = Number(r.totalBillBdt) || 0;
      const paid = Number(r.purchaseCostPaidBdt) || 0;
      totalBilledBdt += billed;
      totalCollectedBdt += paid;
      totalDueBdt += Math.max(0, billed - paid);
      totalWeightKg += Number(r.bdWeightKg || r.cnWeightKg) || 0;
    }

    return {
      totalOrders,
      totalPurchaseRmb: Math.round(totalPurchaseRmb * 100) / 100,
      totalPurchaseBdt: Math.round(totalPurchaseBdt),
      totalFreightBdt: Math.round(totalFreightBdt),
      totalBilledBdt: Math.round(totalBilledBdt),
      totalCollectedBdt: Math.round(totalCollectedBdt),
      totalDueBdt: Math.round(totalDueBdt),
      totalWeightKg: Math.round(totalWeightKg * 10) / 10
    };
  }

  /**
   * Export to 1:1 Google Sheet CSV (28 Columns matching GoShipping Sheet1 A-AB)
   */
  static exportToCsv(): string {
    const headers = [
      'Order ID',
      'Order Date',
      'CN Date',
      'China Courier Tracking (SF/ZTO)',
      'Customer Name',
      'Current Status',
      'Mobile No',
      'Importer / Client',
      'Shipping Mark',
      'Website Order No',
      'Item / Product Details',
      'Supplier / Shop Name',
      'Quantity (Pcs)',
      'Unit Price (RMB)',
      'Total Purchase (RMB) [Auto]',
      'RMB Rate (BDT)',
      'Purchase Cost (BDT) [Auto]',
      'Purchase Cost Paid     [ Customer ]',
      'Purchase Cost Due [Auto]',
      'Service Type',
      'BD Date',
      'BD Weight (KG)',
      'Shipping Rate / KG (BDT)',
      'International Freight (BDT) [Auto]',
      'Total Bill (BDT) [Auto]',
      'Payment Status [Auto]',
      'BD Tracking No',
      'Remark / Customer Update'
    ];

    const escape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = memoryLedger.map((r) => [
      escape(r.orderId),
      escape(r.orderDate),
      escape(r.cnDate),
      escape(r.chinaCourierTracking),
      escape(r.customerName),
      escape(r.currentStatus),
      escape(r.mobileNo),
      escape(r.importerClient),
      escape(r.shippingMark),
      escape(r.websiteOrderNo),
      escape(r.itemDetails),
      escape(r.supplierName),
      escape(r.quantity),
      escape(r.unitPriceRmb.toFixed(2)),
      escape(r.totalPurchaseRmb.toFixed(2)),
      escape(r.rmbRateBdt.toFixed(2)),
      escape(r.purchaseCostBdt.toFixed(2)),
      escape(r.purchaseCostPaidBdt.toFixed(2)),
      escape(r.purchaseCostDueBdt.toFixed(2)),
      escape(r.serviceType),
      escape(r.bdDate),
      escape(r.bdWeightKg.toFixed(2)),
      escape(r.shippingRatePerKgBdt.toFixed(2)),
      escape(r.internationalFreightBdt.toFixed(2)),
      escape(r.totalBillBdt.toFixed(2)),
      escape(r.paymentStatus),
      escape(r.bdCourierName ? `${r.bdCourierName}: ${r.bdTrackingNo || ''}` : (r.bdTrackingNo || '')),
      escape(r.remark)
    ].join(','));

    return [headers.map(escape).join(','), ...rows].join('\n');
  }

  /**
   * Import from CSV Text (Intelligently maps headers for 29-column and 30-column formats)
   */
  static async importFromCsv(csvText: string): Promise<{ imported: number; errors: string[] }> {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) return { imported: 0, errors: ['CSV file is empty or missing headers'] };

    let count = 0;
    const errors: string[] = [];

    const parseLine = (line: string): string[] => {
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = regex.exec(line)) !== null) {
        let val = m[1] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        matches.push(val.trim());
        if (regex.lastIndex >= line.length) break;
      }
      return matches;
    };

    const headerMatches = parseLine(lines[0]);
    const headerMap: Record<string, number> = {};
    headerMatches.forEach((h, idx) => {
      const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm) headerMap[norm] = idx;
    });

    const getCol = (matches: string[], ...keys: string[]): string => {
      for (const k of keys) {
        const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm in headerMap && headerMap[norm] < matches.length) {
          return matches[headerMap[norm]] || '';
        }
      }
      return '';
    };

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i];
        const matches = parseLine(line);
        if (matches.length < 3) continue;

        const customerName = getCol(matches, 'Customer Name') || matches[4] || matches[0];
        if (!customerName) continue;

        await this.createRecord({
          orderId: getCol(matches, 'Order ID') || matches[0] || undefined,
          orderDate: getCol(matches, 'Order Date') || matches[1] || undefined,
          cnDate: getCol(matches, 'CN Date') || matches[2] || undefined,
          chinaCourierTracking: getCol(matches, 'China Courier Tracking', 'China Courier Tracking (SF/ZTO)') || matches[3] || '',
          customerName,
          currentStatus: getCol(matches, 'Current Status') || matches[5] || 'Processing',
          mobileNo: getCol(matches, 'Mobile No', 'Mobile') || matches[6] || '',
          importerClient: getCol(matches, 'Importer / Client', 'Importer') || matches[7] || '',
          shippingMark: getCol(matches, 'Shipping Mark') || matches[8] || '',
          websiteOrderNo: getCol(matches, 'Website Order No') || matches[9] || '',
          itemDetails: getCol(matches, 'Item / Product Details', 'Item Details') || matches[10] || 'Imported Goods',
          supplierName: getCol(matches, 'Supplier / Shop Name', 'Supplier') || matches[11] || 'Taobao',
          quantity: Number(getCol(matches, 'Quantity (Pcs)', 'Quantity') || matches[12]) || 1,
          unitPriceRmb: Number(getCol(matches, 'Unit Price (RMB)', 'Unit Price') || matches[13]) || 0,
          rmbRateBdt: Number(getCol(matches, 'RMB Rate (BDT)', 'RMB Rate') || matches[15]) || 19.5,
          purchaseCostPaidBdt: Number(getCol(matches, 'Purchase Cost Paid', 'Purchase Cost Paid [ Customer ]') || matches[17]) || 0,
          serviceType: getCol(matches, 'Service Type') || matches[19] || 'Sourcing & Shipping',
          bdDate: getCol(matches, 'BD Date') || matches[20] || undefined,
          bdWeightKg: Number(getCol(matches, 'BD Weight (KG)', 'BD Weight') || matches[21]) || 0,
          shippingRatePerKgBdt: Number(getCol(matches, 'Shipping Rate / KG (BDT)', 'Shipping Rate') || matches[22]) || 0,
          bdTrackingNo: getCol(matches, 'BD Tracking No', 'BD Tracking') || matches[26] || '',
          remark: getCol(matches, 'Remark / Customer Update', 'Remark') || matches[27] || ''
        });
        count++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    return { imported: count, errors };
  }
}
