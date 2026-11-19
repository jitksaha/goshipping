import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PosLedgerRecord } from './posLedger.service';

export const TARGET_GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1K7JQIwYXmKjy6CsLufuV-2Adljqg2qhJSwUQOboJUwQ/edit?gid=0#gid=0';

export const TARGET_GOOGLE_SHEET_ID = '1K7JQIwYXmKjy6CsLufuV-2Adljqg2qhJSwUQOboJUwQ';

export const TARGET_SHEET_TAB_NAME = 'Sheet1';

export const GOOGLE_SHEET_HEADERS_29 = [
  'Order ID',                          // 1 (A)
  'Order Date',                        // 2 (B)
  'CN Date',                           // 3 (C)
  'China Courier Tracking (SF/ZTO)',   // 4 (D)
  'Customer Name',                     // 5 (E)
  'Current Status',                    // 6 (F)
  'Mobile No',                         // 7 (G)
  'Importer / Client',                 // 8 (H)
  'Shipping Mark',                     // 9 (I)
  'Website Order No',                  // 10 (J)
  'Item / Product Details',            // 11 (K)
  'Supplier / Shop Name',              // 12 (L)
  'Quantity (Pcs)',                    // 13 (M)
  'Unit Price (RMB)',                  // 14 (N)
  'Total Purchase (RMB) [Auto]',       // 15 (O)
  'RMB Rate (BDT)',                    // 16 (P)
  'Purchase Cost (BDT) [Auto]',        // 17 (Q)
  'Purchase Cost Paid     [ Customer ]', // 18 (R)
  'Purchase Cost Due [Auto]',          // 19 (S)
  'Service Type',                      // 20 (T)
  'BD Date',                           // 21 (U)
  'BD Weight (KG)',                    // 22 (V)
  'Shipping Rate / KG (BDT)',          // 23 (W)
  'International Freight (BDT) [Auto]', // 24 (X)
  'Total Bill (BDT) [Auto]',           // 25 (Y)
  'Payment Status [Auto]',             // 26 (Z)
  'BD Tracking No',                    // 27 (AA)
  'Remark / Customer Update',          // 28 (AB)
  'Profit Estimate (BDT) [Auto]'       // 29 (AC)
] as const;

const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbyqiEhXqcfnApjc2Eptzu9jVRujk8ZmoQjvOBtqnVibPvnlUy5iBYEDE5x2g6xOIpXo/exec';

let dynamicWebhookUrl: string | null = null;

export function getGoogleSheetWebhookUrl(): string {
  return dynamicWebhookUrl || process.env.GOOGLE_SHEET_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
}

export function setGoogleSheetWebhookUrl(url: string): void {
  dynamicWebhookUrl = url.trim();
  process.env.GOOGLE_SHEET_WEBHOOK_URL = dynamicWebhookUrl;
}

export function updateEnvFileWebhookUrl(newUrl: string): boolean {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('GOOGLE_SHEET_WEBHOOK_URL=')) {
        content = content.replace(/GOOGLE_SHEET_WEBHOOK_URL=.*/, `GOOGLE_SHEET_WEBHOOK_URL=${newUrl}`);
      } else {
        content += `\nGOOGLE_SHEET_WEBHOOK_URL=${newUrl}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
      return true;
    }
  } catch (err) {
    console.error('[GoogleSheetSync] Failed to update .env with new webhook URL:', err);
  }
  return false;
}

export interface GoogleSheetSyncResult {
  success: boolean;
  orderId?: string;
  action?: string;
  error?: string;
}

/**
 * Helper to escape strings so Google Sheets does not treat phone numbers
 * or plus/equals signs as formulas (which causes #ERROR! in Google Sheets).
 */
function escapeForSheet(val: string | null | undefined): string {
  if (!val) return '';
  const str = String(val).trim();
  if (str.startsWith("'")) return str;
  // If string starts with +, =, -, @, or is a phone number, prepend single quote
  if (str.startsWith('+') || str.startsWith('=') || str.startsWith('-') || str.startsWith('@')) {
    return `'${str}`;
  }
  return str;
}

/**
 * Format phone numbers specifically with a leading apostrophe so Google Sheets
 * keeps the plus sign and leading zeroes without formula evaluation errors.
 */
function formatPhoneForSheet(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = String(phone).trim();
  if (clean.startsWith("'")) return clean;
  return `'${clean}`;
}

/**
 * Format a PosLedgerRecord into the complete 29-column payload matching
 * the official GoShipping Google Spreadsheet (Sheet1, Columns A to AC).
 */
export function formatRecordForSheet(record: PosLedgerRecord & { oldOrderId?: string; previousOrderId?: string }) {
  const mobile = formatPhoneForSheet(record.mobileNo);

  const rowValues = [
    record.orderId || '',
    record.orderDate || '',
    record.cnDate || '',
    record.chinaCourierTracking || '',
    record.customerName || '',
    record.currentStatus || 'Processing',
    mobile,
    record.importerClient || '',
    record.shippingMark || '',
    record.websiteOrderNo || '',
    record.itemDetails || '',
    record.supplierName || 'Taobao',
    Number(record.quantity || 1),
    Number(record.unitPriceRmb || 0),
    Number(record.totalPurchaseRmb || 0),
    Number(record.rmbRateBdt || 19.5),
    Number(record.purchaseCostBdt || 0),
    Number(record.purchaseCostPaidBdt || 0),
    Number(record.purchaseCostDueBdt || 0),
    record.serviceType || 'Sourcing & Shipping',
    record.bdDate || '',
    Number(record.bdWeightKg || 0),
    Number(record.shippingRatePerKgBdt || 850),
    Number(record.internationalFreightBdt || 0),
    Number(record.totalBillBdt || 0),
    record.paymentStatus || 'Due',
    record.bdTrackingNo || '',
    record.remark || '',
    Number(record.profitEstimateBdt || 0)
  ];

  return {
    orderId: record.orderId || '',
    orderDate: record.orderDate || '',
    cnDate: record.cnDate || '',
    chinaCourierTracking: record.chinaCourierTracking || '',
    customerName: record.customerName || '',
    currentStatus: record.currentStatus || 'Processing',
    mobileNo: mobile,
    importerClient: record.importerClient || '',
    shippingMark: record.shippingMark || '',
    websiteOrderNo: record.websiteOrderNo || '',
    itemDetails: record.itemDetails || '',
    supplierName: record.supplierName || 'Taobao',
    quantity: Number(record.quantity || 1),
    unitPriceRmb: Number(record.unitPriceRmb || 0),
    totalPurchaseRmb: Number(record.totalPurchaseRmb || 0),
    rmbRateBdt: Number(record.rmbRateBdt || 19.5),
    purchaseCostBdt: Number(record.purchaseCostBdt || 0),
    purchaseCostPaidBdt: Number(record.purchaseCostPaidBdt || 0),
    purchaseCostDueBdt: Number(record.purchaseCostDueBdt || 0),
    serviceType: record.serviceType || 'Sourcing & Shipping',
    bdDate: record.bdDate || '',
    bdWeightKg: Number(record.bdWeightKg || 0),
    shippingRatePerKgBdt: Number(record.shippingRatePerKgBdt || 850),
    internationalFreightBdt: Number(record.internationalFreightBdt || 0),
    totalBillBdt: Number(record.totalBillBdt || 0),
    paymentStatus: record.paymentStatus || 'Due',
    bdCourierName: record.bdCourierName || '',
    bdTrackingNo: record.bdTrackingNo || '',
    remark: record.remark || '',
    profitEstimateBdt: Number(record.profitEstimateBdt || 0),
    // Pre-aligned 29 values for Columns A to AC
    rowValues,
    oldOrderId: (record as any).oldOrderId || undefined,
    previousOrderId: (record as any).previousOrderId || (record as any).oldOrderId || undefined,
    sheetUrl: TARGET_GOOGLE_SHEET_URL,
    sheetTab: TARGET_SHEET_TAB_NAME
  };
}

export async function setupGoogleSheetHeaders(): Promise<GoogleSheetSyncResult> {
  const webhookUrl = getGoogleSheetWebhookUrl();
  if (!webhookUrl) {
    return { success: false, error: 'Google Sheet webhook URL not configured' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'setup_headers' }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script returned HTTP ${response.status}`);
    }

    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: true, raw: text };
    }

    return {
      success: data.success !== false,
      action: 'setup_headers'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to trigger header setup'
    };
  }
}

export type SyncStatusListener = (
  idOrOrderId: string,
  status: 'synced' | 'failed' | 'pending',
  error?: string
) => Promise<void> | void;

let syncStatusListener: SyncStatusListener | null = null;

export function setSyncStatusListener(listener: SyncStatusListener | null) {
  syncStatusListener = listener;
}

/**
 * Push a single order row to the Google Sheet webhook.
 * Executes with automatic 3-tier exponential backoff and persistent status updates.
 */
export async function syncOrderToGoogleSheet(
  record: PosLedgerRecord
): Promise<GoogleSheetSyncResult> {
  const webhookUrl = getGoogleSheetWebhookUrl();
  const idOrCode = record.id || record.orderId;

  if (!webhookUrl) {
    if (syncStatusListener && idOrCode) {
      syncStatusListener(idOrCode, 'failed', 'Google Sheet webhook URL not configured');
    }
    return { success: false, error: 'Google Sheet webhook URL not configured' };
  }

  // Notify listener of pending state
  if (syncStatusListener && idOrCode) {
    try {
      syncStatusListener(idOrCode, 'pending');
    } catch {}
  }

  const payload = formatRecordForSheet(record);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000) // 15 second timeout to handle Google Apps Script cold starts
      });

      if (!response.ok) {
        throw new Error(`Google Apps Script HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: true, raw: text };
      }

      if (data.success === false) {
        throw new Error(data.error || 'Apps Script returned failure');
      }

      // Mark as successfully synced
      if (syncStatusListener && idOrCode) {
        try {
          syncStatusListener(idOrCode, 'synced');
        } catch {}
      }

      return {
        success: true,
        orderId: record.orderId,
        action: data.action || 'synced'
      };
    } catch (err: any) {
      if (attempt === maxAttempts) {
        console.error(`[GoogleSheetSync] Error syncing order ${record.orderId} after ${maxAttempts} attempts:`, err.message);
        if (syncStatusListener && idOrCode) {
          try {
            syncStatusListener(idOrCode, 'failed', err.message || 'Sync failed');
          } catch {}
        }
        return {
          success: false,
          orderId: record.orderId,
          error: err.message || 'Unknown webhook sync error'
        };
      }
      // Progressive backoff: 1s, then 2.5s
      const delayMs = attempt === 1 ? 1000 : 2500;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { success: false, orderId: record.orderId, error: 'Sync failed after retries' };
}

/**
 * Batch sync an array of order records to the Google Sheet sequentially.
 */
export async function batchSyncOrdersToGoogleSheet(
  records: PosLedgerRecord[]
): Promise<{ total: number; successful: number; failed: number; errors: string[] }> {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      const result = await syncOrderToGoogleSheet(record);
      if (result.success) {
        successful++;
      } else {
        failed++;
        if (result.error) errors.push(`${record.orderId}: ${result.error}`);
      }
      // Modest delay between batch pushes to prevent rate-limiting Google Apps Script
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: any) {
      failed++;
      errors.push(`${record.orderId}: ${err.message}`);
    }
  }

  return {
    total: records.length,
    successful,
    failed,
    errors
  };
}
