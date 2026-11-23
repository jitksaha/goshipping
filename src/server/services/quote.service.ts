import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/client';
import { quotes, quoteRevisions } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { ShipmentService } from './shipment.service';
import { PosLedgerService } from './posLedger.service';

export interface QuoteRevision {
  id: string;
  quoteId: string;
  revisionNumber: number;
  baseFreightCharge: number;
  fuelSurcharge: number;
  customsClearanceFee: number;
  handlingFee: number;
  insuranceFee: number;
  otherFees: number;
  totalAmount: number;
  currency: string;
  validityDate: string;
  transitTimeDays: string;
  notes?: string;
  staffName?: string;
  createdAt: string;
}

export interface QuoteRecord {
  id: string;
  quoteNumber: string;
  customerId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  originCountry: string;
  originCity: string;
  destCountry: string;
  destCity: string;
  mode: 'air' | 'sea' | 'hand_carry';
  serviceType: 'door_to_door' | 'port_to_port' | 'door_to_port';
  productName?: string;
  productCategory?: string;
  productImages?: string[];
  productUrl?: string;
  declaredValue?: number;
  cargoDescription: string;
  packagingType: string;
  quantity: number;
  totalWeightKg: number;
  totalCbm: number;
  status:
    | 'submitted'
    | 'under_review'
    | 'priced'
    | 'accepted'
    | 'revision_requested'
    | 'declined'
    | 'converted_to_shipment';
  targetShipmentDate?: string;
  validityDate?: string;
  assignedStaffName?: string;
  assignedStaffId?: string;
  convertedShipmentId?: string;
  revisions: QuoteRevision[];
  createdAt: string;
  updatedAt: string;
}

const STORE_PATH = path.resolve(process.cwd(), '.quotes_store.json');

declare global {
  var __goshipping_quotes: QuoteRecord[] | undefined;
}

function loadQuotesFromFile(): QuoteRecord[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[QuoteService] Failed to load quotes from store file:', err);
  }
  return [];
}

let lastQuotesMtimeMs = 0;

function saveQuotesToFile(data: QuoteRecord[]): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    if (fs.existsSync(STORE_PATH)) {
      lastQuotesMtimeMs = fs.statSync(STORE_PATH).mtimeMs;
    }
  } catch (err) {
    console.error('[QuoteService] Failed to save quotes store:', err);
  }
}

function ensureLatestQuotesStore(): QuoteRecord[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const stat = fs.statSync(STORE_PATH);
      if (stat.mtimeMs !== lastQuotesMtimeMs || !memoryQuotes || memoryQuotes.length === 0) {
        lastQuotesMtimeMs = stat.mtimeMs;
        const loaded = loadQuotesFromFile();
        if (loaded.length > 0 || !memoryQuotes || memoryQuotes.length === 0) {
          memoryQuotes = loaded;
          globalThis.__goshipping_quotes = memoryQuotes;
        }
      }
    }
  } catch (err) {
    console.error('[QuoteService] ensureLatestQuotesStore error:', err);
  }
  return memoryQuotes || [];
}

// Live operational quotes store
let memoryQuotes: QuoteRecord[] = globalThis.__goshipping_quotes || loadQuotesFromFile();
globalThis.__goshipping_quotes = memoryQuotes;

export class QuoteService {
  static async listQuotes(params?: { customerId?: string; status?: string }): Promise<QuoteRecord[]> {
    ensureLatestQuotesStore();

    // If memoryQuotes is empty, attempt to read from MySQL quotes table
    if (!memoryQuotes || memoryQuotes.length === 0) {
      try {
        const dbQuotes = await db.select().from(quotes).orderBy(desc(quotes.createdAt));
        if (dbQuotes && dbQuotes.length > 0) {
          const revRecords = await db.select().from(quoteRevisions);
          memoryQuotes = dbQuotes.map((q) => {
            const quoteRevs = revRecords
              .filter((r) => r.quoteId === q.id)
              .map((r) => ({
                id: r.id,
                quoteId: r.quoteId,
                revisionNumber: r.revisionNumber,
                baseFreightCharge: Number(r.baseFreightCharge) || 0,
                fuelSurcharge: Number(r.fuelSurcharge) || 0,
                customsClearanceFee: Number(r.customsClearanceFee) || 0,
                handlingFee: Number(r.handlingFee) || 0,
                insuranceFee: Number(r.insuranceFee) || 0,
                otherFees: Number(r.otherFees) || 0,
                totalAmount: Number(r.totalAmount) || 0,
                currency: r.currency || 'BDT',
                validityDate: r.validityDate ? r.validityDate.toISOString() : '',
                transitTimeDays: r.transitTimeDays || '',
                notes: r.notes || undefined,
                createdAt: r.createdAt ? r.createdAt.toISOString() : ''
              }));

            return {
              id: q.id,
              quoteNumber: q.quoteNumber,
              customerId: q.customerId || undefined,
              guestName: q.guestName || 'Valued Importer',
              guestEmail: q.guestEmail || '',
              guestPhone: q.guestPhone || '',
              originCountry: q.originCountry,
              originCity: q.originCity,
              destCountry: q.destCountry,
              destCity: q.destCity,
              mode: (q.mode as any) || 'air',
              serviceType: (q.serviceType as any) || 'door_to_door',
              cargoDescription: q.cargoDescription,
              packagingType: q.packagingType || 'carton',
              quantity: q.quantity || 1,
              totalWeightKg: Number(q.totalWeightKg) || 0,
              totalCbm: Number(q.totalCbm) || 0,
              status: q.status as any,
              targetShipmentDate: q.targetShipmentDate ? q.targetShipmentDate.toISOString() : undefined,
              validityDate: q.validityDate ? q.validityDate.toISOString() : undefined,
              assignedStaffId: q.assignedStaffId || undefined,
              convertedShipmentId: q.convertedShipmentId || undefined,
              revisions: quoteRevs,
              createdAt: q.createdAt.toISOString(),
              updatedAt: q.updatedAt.toISOString()
            };
          });
          globalThis.__goshipping_quotes = memoryQuotes;
          saveQuotesToFile(memoryQuotes);
        }
      } catch (dbErr) {
        // Fallback to local memory / file
      }
    }

    let result = [...(memoryQuotes || [])];
    if (params?.customerId) {
      result = result.filter((q) => q.customerId === params.customerId);
    }
    if (params?.status && params.status !== 'all') {
      result = result.filter((q) => q.status === params.status);
    }
    return result.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }

  static async getById(quoteIdOrNumber: string): Promise<QuoteRecord | null> {
    ensureLatestQuotesStore();
    const clean = quoteIdOrNumber.trim().toUpperCase();
    const q = (memoryQuotes || []).find(
      (item) => item.id === quoteIdOrNumber || item.quoteNumber.toUpperCase() === clean
    );
    return q || null;
  }

  static async createQuote(data: {
    customerId?: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    originCountry: string;
    originCity: string;
    destCountry: string;
    destCity: string;
    mode: 'air' | 'sea' | 'hand_carry';
    serviceType?: 'door_to_door' | 'port_to_port' | 'door_to_port';
    productName?: string;
    productCategory?: string;
    productImages?: string[];
    productUrl?: string;
    declaredValue?: number;
    cargoDescription: string;
    packagingType?: string;
    quantity?: number;
    totalWeightKg: number;
    totalCbm: number;
    targetShipmentDate?: string;
  }): Promise<QuoteRecord> {
    ensureLatestQuotesStore();

    // Anti-duplicate protection: check within last 20 seconds
    const nowMs = Date.now();
    const candEmail = (data.guestEmail || '').trim().toLowerCase();
    const candPhone = (data.guestPhone || '').replace(/\D/g, '');
    const candDesc = (data.cargoDescription || '').trim().toLowerCase();
    const candQty = Number(data.quantity) || 1;

    const duplicate = (memoryQuotes || []).find((q) => {
      const qTime = new Date(q.createdAt || 0).getTime();
      if ((nowMs - qTime) >= 20000) return false;
      const qEmail = (q.guestEmail || '').trim().toLowerCase();
      const qPhone = (q.guestPhone || '').replace(/\D/g, '');
      const qDesc = (q.cargoDescription || '').trim().toLowerCase();
      const qQty = Number(q.quantity) || 1;
      return (
        ((candEmail && qEmail === candEmail) || (candPhone && qPhone === candPhone)) &&
        qDesc === candDesc &&
        qQty === candQty
      );
    });

    if (duplicate) {
      console.warn(`[QuoteService] Duplicate quote submission prevented. Returning existing quote ${duplicate.quoteNumber} (${duplicate.id})`);
      return duplicate;
    }

    const id = `qte-${Date.now().toString(36)}`;
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `QTE-${new Date().getFullYear()}-${randomNum}`;
    const now = new Date().toISOString();

    const newQuote: QuoteRecord = {
      id,
      quoteNumber,
      customerId: data.customerId,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      originCountry: data.originCountry,
      originCity: data.originCity,
      destCountry: data.destCountry,
      destCity: data.destCity,
      mode: data.mode,
      serviceType: data.serviceType || 'door_to_door',
      productName: data.productName,
      productCategory: data.productCategory,
      productImages: data.productImages || [],
      productUrl: data.productUrl,
      declaredValue: data.declaredValue,
      cargoDescription: data.cargoDescription,
      packagingType: data.packagingType || 'carton',
      quantity: data.quantity || 1,
      totalWeightKg: data.totalWeightKg,
      totalCbm: data.totalCbm,
      status: 'submitted',
      targetShipmentDate: data.targetShipmentDate,
      revisions: [],
      createdAt: now,
      updatedAt: now
    };

    if (!memoryQuotes) {
      memoryQuotes = [];
    }
    memoryQuotes.unshift(newQuote);
    globalThis.__goshipping_quotes = memoryQuotes;

    // 1. Synchronously persist to disk for instant cross-process worker sync
    saveQuotesToFile(memoryQuotes);

    // 2. Dual-write to MySQL quotes table
    try {
      await db.insert(quotes).values({
        id: newQuote.id,
        quoteNumber: newQuote.quoteNumber,
        customerId: newQuote.customerId || null,
        guestName: newQuote.guestName,
        guestEmail: newQuote.guestEmail,
        guestPhone: newQuote.guestPhone,
        originCountry: newQuote.originCountry,
        originCity: newQuote.originCity,
        destCountry: newQuote.destCountry,
        destCity: newQuote.destCity,
        mode: newQuote.mode,
        serviceType: newQuote.serviceType,
        cargoDescription: newQuote.cargoDescription,
        packagingType: newQuote.packagingType,
        quantity: newQuote.quantity,
        totalWeightKg: String(newQuote.totalWeightKg || 0),
        totalCbm: String(newQuote.totalCbm || 0),
        status: newQuote.status,
        customerNotes: newQuote.productName ? `Product: ${newQuote.productName}` : null,
        createdAt: new Date(newQuote.createdAt),
        updatedAt: new Date(newQuote.updatedAt)
      });
    } catch (dbErr) {
      console.warn('[QuoteService] Async DB insert skipped/failed:', dbErr);
    }

    return newQuote;
  }

  static async addPricingRevision(
    quoteId: string,
    revision: {
      baseFreightCharge: number;
      fuelSurcharge: number;
      customsClearanceFee: number;
      handlingFee: number;
      insuranceFee: number;
      otherFees: number;
      currency?: string;
      validityDate?: string;
      transitTimeDays?: string;
      notes?: string;
      staffName?: string;
    }
  ): Promise<QuoteRecord | null> {
    ensureLatestQuotesStore();
    const clean = quoteId.trim().toUpperCase();
    const quote = (memoryQuotes || []).find((q) => q.id === quoteId || q.quoteNumber.toUpperCase() === clean);
    if (!quote) return null;

    const totalAmount =
      revision.baseFreightCharge +
      revision.fuelSurcharge +
      revision.customsClearanceFee +
      revision.handlingFee +
      revision.insuranceFee +
      revision.otherFees;

    const revObj: QuoteRevision = {
      id: `rev-${quote.revisions.length + 1}-${Date.now().toString(36)}`,
      quoteId: quote.id,
      revisionNumber: quote.revisions.length + 1,
      baseFreightCharge: revision.baseFreightCharge,
      fuelSurcharge: revision.fuelSurcharge,
      customsClearanceFee: revision.customsClearanceFee,
      handlingFee: revision.handlingFee,
      insuranceFee: revision.insuranceFee,
      otherFees: revision.otherFees,
      totalAmount,
      currency: revision.currency || 'BDT',
      validityDate: revision.validityDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      transitTimeDays: revision.transitTimeDays || '7-14 days',
      notes: revision.notes,
      staffName: revision.staffName,
      createdAt: new Date().toISOString()
    };

    quote.revisions.unshift(revObj);
    quote.status = 'priced';
    quote.validityDate = revObj.validityDate;
    if (revision.staffName) quote.assignedStaffName = revision.staffName;
    quote.updatedAt = new Date().toISOString();

    saveQuotesToFile(memoryQuotes);

    // Async DB update
    try {
      await db.insert(quoteRevisions).values({
        id: revObj.id,
        quoteId: quote.id,
        revisionNumber: revObj.revisionNumber,
        baseFreightCharge: String(revObj.baseFreightCharge),
        fuelSurcharge: String(revObj.fuelSurcharge),
        customsClearanceFee: String(revObj.customsClearanceFee),
        handlingFee: String(revObj.handlingFee),
        insuranceFee: String(revObj.insuranceFee),
        otherFees: String(revObj.otherFees),
        totalAmount: String(revObj.totalAmount),
        currency: revObj.currency,
        validityDate: new Date(revObj.validityDate),
        transitTimeDays: revObj.transitTimeDays,
        notes: revObj.notes,
        createdAt: new Date(revObj.createdAt)
      });

      await db.update(quotes).set({
        status: 'priced',
        validityDate: new Date(revObj.validityDate),
        updatedAt: new Date()
      }).where(eq(quotes.id, quote.id));
    } catch (dbErr) {
      console.warn('[QuoteService] Async DB revision update failed:', dbErr);
    }

    return quote;
  }

  static async convertQuoteToShipment(
    quoteId: string,
    overrides?: {
      negotiatedPrice?: number;
      currency?: string;
      pricingNotes?: string;
      productName?: string;
      cargoDescription?: string;
      originCountry?: string;
      originCity?: string;
      destCountry?: string;
      destCity?: string;
      mode?: 'air' | 'sea' | 'road' | 'hand_carry';
      serviceLevel?: 'standard' | 'express' | 'priority';
      totalWeightKg?: number;
      totalCbm?: number;
      totalPieces?: number;
      packagingType?: string;
      recipientName?: string;
      recipientPhone?: string;
      recipientAddress?: string;
      carrierName?: string;
      voyageOrFlightNumber?: string;
      items?: Array<{
        description: string;
        itemCode?: string;
        packagingType?: string;
        quantity?: number;
        weightKg?: number;
        cbm?: number;
        categoryTag?: 'General' | 'Commercial' | 'Liquids' | 'Dangerous' | 'Perishable' | 'Electronics';
        declaredValue?: number;
      }>;
    }
  ): Promise<{ quote: QuoteRecord; shipmentId: string; shipment: any } | null> {
    ensureLatestQuotesStore();
    const clean = quoteId.trim().toUpperCase();
    const quote = (memoryQuotes || []).find((q) => q.id === quoteId || q.quoteNumber.toUpperCase() === clean);
    if (!quote) return null;

    // Prevent duplicate shipment creation if quote is already converted
    if (quote.status === 'converted_to_shipment' && quote.convertedShipmentId) {
      console.warn(`[QuoteService] Quote ${quote.quoteNumber} is already converted to shipment ${quote.convertedShipmentId}. Returning existing shipment.`);
      const existingShp = await ShipmentService.getById(quote.convertedShipmentId);
      return { quote, shipmentId: quote.convertedShipmentId, shipment: existingShp };
    }

    // If a negotiated price or custom budget was agreed upon, record a new revision
    if (overrides?.negotiatedPrice !== undefined && overrides.negotiatedPrice > 0) {
      const agreedAmount = Number(overrides.negotiatedPrice);
      const curr = overrides.currency || 'BDT';
      const revObj: QuoteRevision = {
        id: `rev-nego-${Date.now().toString(36)}`,
        quoteId: quote.id,
        revisionNumber: quote.revisions.length + 1,
        baseFreightCharge: agreedAmount,
        fuelSurcharge: 0,
        customsClearanceFee: 0,
        handlingFee: 0,
        insuranceFee: 0,
        otherFees: 0,
        totalAmount: agreedAmount,
        currency: curr,
        validityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        transitTimeDays: 'Standard Logistics Transit',
        notes: overrides.pricingNotes || 'Final negotiated budget agreed with client prior to booking conversion.',
        createdAt: new Date().toISOString()
      };
      quote.revisions.unshift(revObj);
    }

    const mode = (overrides?.mode || quote.mode || 'air') as 'air' | 'sea' | 'road' | 'hand_carry';
    const originCountry = overrides?.originCountry || quote.originCountry;
    const originCity = overrides?.originCity || quote.originCity;
    const destCountry = overrides?.destCountry || quote.destCountry;
    const destCity = overrides?.destCity || quote.destCity;
    const totalWeightKg = Number(overrides?.totalWeightKg) || quote.totalWeightKg;
    const totalCbm = Number(overrides?.totalCbm) || quote.totalCbm;
    const totalPieces = Number(overrides?.totalPieces) || quote.quantity;
    const cargoDescription = overrides?.cargoDescription || quote.cargoDescription;
    const productName = overrides?.productName || quote.productName || cargoDescription;

    const items =
      overrides?.items && overrides.items.length > 0
        ? overrides.items
        : [
            {
              description: cargoDescription,
              quantity: totalPieces,
              packagingType: overrides?.packagingType || quote.packagingType || 'carton',
              weightKg: totalWeightKg,
              cbm: totalCbm,
              categoryTag: 'Commercial' as const,
              declaredValue: quote.declaredValue
            }
          ];

    const newShipment = await ShipmentService.createShipment({
      customerId: quote.customerId || 'usr-customer-01',
      customerName: quote.guestName,
      customerEmail: quote.guestEmail,
      customerPhone: quote.guestPhone,
      productName,
      recipientName: overrides?.recipientName || `${quote.guestName} Receiving Facility`,
      recipientPhone: overrides?.recipientPhone || quote.guestPhone,
      recipientAddress: overrides?.recipientAddress || `${destCity}, ${destCountry}`,
      originCountry,
      originCity,
      destCountry,
      destCity,
      mode,
      serviceLevel: overrides?.serviceLevel || 'express',
      totalWeightKg,
      totalCbm,
      totalPieces,
      carrierName: overrides?.carrierName || (mode === 'air' ? 'GoShipping Air Priority' : mode === 'sea' ? 'GoShipping Ocean Line' : 'GoShipping Surface'),
      voyageOrFlightNumber: overrides?.voyageOrFlightNumber || (mode === 'air' ? 'Flight GOSH-CARGO' : 'Vessel GOSH-VOYAGE'),
      items
    });

    quote.status = 'converted_to_shipment';
    quote.convertedShipmentId = newShipment.id;
    quote.updatedAt = new Date().toISOString();

    saveQuotesToFile(memoryQuotes);

    try {
      await db.update(quotes).set({
        status: 'converted_to_shipment',
        convertedShipmentId: newShipment.id,
        updatedAt: new Date()
      }).where(eq(quotes.id, quote.id));
    } catch (dbErr) {
      console.warn('[QuoteService] Async DB convert update failed:', dbErr);
    }

    // Auto-create corresponding entry in master POS Sourcing & Freight Ledger
    try {
      const agreedAmount =
        overrides?.negotiatedPrice !== undefined && overrides.negotiatedPrice > 0
          ? Number(overrides.negotiatedPrice)
          : (quote.revisions[0]?.totalAmount || 0);

      const freightRateCalc = totalWeightKg > 0 && agreedAmount > 0 ? Math.round(agreedAmount / totalWeightKg) : 950;

      await PosLedgerService.createRecord({
        customerName: quote.guestName || 'Valued Customer',
        mobileNo: quote.guestPhone || '',
        importerClient: quote.guestName || '',
        shippingMark: quote.quoteNumber,
        itemDetails: productName || cargoDescription || 'Commercial Freight Cargo',
        supplierName: 'GoShipping Logistics Direct',
        serviceType: 'International Freight Cargo',
        cnWeightKg: totalWeightKg,
        bdWeightKg: totalWeightKg,
        shippingRatePerKgBdt: freightRateCalc,
        internationalFreightBdt: agreedAmount,
        totalBillBdt: agreedAmount,
        paymentStatus: 'Due',
        currentStatus: 'Processing',
        orderDate: new Date().toISOString().split('T')[0],
        cnDate: new Date().toISOString().split('T')[0],
        bdCourierName: 'Steadfast',
        bdTrackingNo: newShipment.trackingNumber,
        remark: `Converted from Quote #${quote.quoteNumber} (Consignment: ${newShipment.trackingNumber})`
      });
    } catch (ledgerErr) {
      console.error('[QuoteService] Failed to auto-create POS ledger for converted quote:', ledgerErr);
    }

    return { quote, shipmentId: newShipment.id, shipment: newShipment };
  }
}
