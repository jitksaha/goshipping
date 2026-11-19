import crypto from 'node:crypto';
import {
  TRACKING_STATUSES,
  PHYSICAL_STAGES,
  TrackingStatusCode,
  normalizeStatusCode,
  calculatePhysicalProgress
} from './tracking-status';
import { formatBstDateTime } from '../utils/date';
import { RealtimeService } from './realtime.service';
import { getAllAccounts } from '../auth/session';
import { PosLedgerService, PosLedgerRecord } from './posLedger.service';

export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export function isPhoneMatch(query: string, target?: string | null): boolean {
  if (!target) return false;
  const qDigits = normalizePhoneDigits(query);
  const tDigits = normalizePhoneDigits(target);
  if (!qDigits || qDigits.length < 6 || !tDigits || tDigits.length < 6) return false;

  if (qDigits === tDigits) return true;

  // In Bangladesh: standard 10 or 11 digits: e.g. 01711002233 vs 8801711002233
  // Also compare last 9 digits (ignoring leading 0 or country code)
  const qLast9 = qDigits.slice(-9);
  const tLast9 = tDigits.slice(-9);
  if (qLast9.length === 9 && tLast9.length === 9 && qLast9 === tLast9) return true;

  const qLast10 = qDigits.slice(-10);
  const tLast10 = tDigits.slice(-10);
  if (qLast10.length === 10 && tLast10.length === 10 && qLast10 === tLast10) return true;

  return tDigits.endsWith(qDigits) || qDigits.endsWith(tDigits) || tDigits.includes(qDigits) || qDigits.includes(tDigits);
}

export function isOrderIdMatch(query: string, targetOrderId?: string | null): boolean {
  if (!targetOrderId) return false;
  const qClean = query.trim().toUpperCase();
  const tClean = targetOrderId.trim().toUpperCase();

  if (qClean === tClean) return true;

  // Compare without non-alphanumeric chars: GOS-00005 vs GOS00005
  const qAlnum = qClean.replace(/[^A-Z0-9]/g, '');
  const tAlnum = tClean.replace(/[^A-Z0-9]/g, '');
  if (qAlnum && tAlnum && qAlnum === tAlnum) return true;

  // Check numeric tail: e.g. "00005" or "5" against "GOS-00005"
  const qNumMatch = qClean.match(/(\d+)$/);
  const tNumMatch = tClean.match(/(\d+)$/);
  if (qNumMatch && tNumMatch) {
    const qNum = parseInt(qNumMatch[1], 10);
    const tNum = parseInt(tNumMatch[1], 10);
    if (!isNaN(qNum) && !isNaN(tNum) && qNum === tNum) {
      if (/^\d+$/.test(qClean) || qClean.startsWith('GOS') || qClean.startsWith('POS')) {
        return true;
      }
    }
  }

  return false;
}

export function isShippingMarkMatch(query: string, targetMark?: string | null): boolean {
  if (!targetMark) return false;
  const q = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const t = targetMark.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!q || !t || q.length < 3) return false;
  return q === t || t.includes(q) || q.includes(t);
}

export function isCourierTrackingMatch(query: string, trackingNo?: string | null): boolean {
  if (!trackingNo) return false;
  const q = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const t = trackingNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!q || !t || q.length < 4) return false;
  return q === t || t.includes(q);
}

export function convertPosRecordToShipment(record: PosLedgerRecord): ShipmentRecord {
  const normStatus = normalizeStatusCode(record.currentStatus);
  const statusDef = TRACKING_STATUSES[normStatus] || TRACKING_STATUSES.purchased;

  let mode: 'air' | 'sea' | 'road' | 'hand_carry' = 'air';
  const stLower = (record.serviceType || '').toLowerCase();
  if (stLower.includes('sea') || stLower.includes('ocean')) {
    mode = 'sea';
  } else if (stLower.includes('road') || stLower.includes('truck')) {
    mode = 'road';
  }

  const bdWeight = Number(record.bdWeightKg) || 0;
  const cnWeight = Number(record.cnWeightKg) || 0;
  const isBdStage = ['arrived_dhaka_airport', 'awaiting_customs', 'bd_warehouse_received', 'payment_received', 'out_for_delivery', 'delivered'].includes(normStatus);
  // Weight is initially blank/0 until cargo arrives in Bangladesh and admin enters BD weight
  const weight = bdWeight > 0 ? bdWeight : (isBdStage && cnWeight > 0 ? cnWeight : 0);
  const pieces = Number(record.quantity) || 1;
  const trackingNumber = record.orderId || `GOS-${record.id}`;

  const orderDateIso = record.orderDate
    ? new Date(record.orderDate).toISOString()
    : new Date(record.createdAt || Date.now()).toISOString();
  const cnDateIso = record.cnDate
    ? new Date(record.cnDate).toISOString()
    : orderDateIso;
  const bdDateIso = record.bdDate
    ? new Date(record.bdDate).toISOString()
    : new Date(record.updatedAt || Date.now()).toISOString();
  const nowIso = new Date().toISOString();

  // Find physical index for standard 8 stages
  const activePhysicalIdx = PHYSICAL_STAGES.indexOf(normStatus);
  const maxStageIdx = activePhysicalIdx >= 0 ? activePhysicalIdx : 0;

  const events: ShipmentEvent[] = [];

  // Stage 1: purchased
  const stage1Time = orderDateIso;
  events.push({
    id: `evt-${record.id}-purchased`,
    shipmentId: record.id,
    status: 'purchased',
    statusCode: 'purchased',
    statusLabel: TRACKING_STATUSES.purchased.label,
    title: 'PURCHASED CHINA WAREHOUSE',
    description: record.supplierName
      ? `Procured from ${record.supplierName} and assigned to consolidation manifest.`
      : TRACKING_STATUSES.purchased.defaultDescription,
    locationName: `${record.supplierName || 'China'} Supplier Warehouse, China`,
    eventTime: stage1Time,
    occurredAtBst: formatBstDateTime(stage1Time),
    source: 'admin',
    visibility: 'public',
    eventVersion: 1
  });

  // Stage 2: cn_warehouse_received
  if (maxStageIdx >= 1) {
    const stage2Time = cnDateIso;
    events.push({
      id: `evt-${record.id}-cn-rcvd`,
      shipmentId: record.id,
      status: 'cn_warehouse_received',
      statusCode: 'cn_warehouse_received',
      statusLabel: TRACKING_STATUSES.cn_warehouse_received.label,
      title: 'CN WAREHOUSE RECEIVED',
      description: cnWeight > 0
        ? `Cargo received from domestic carrier ${record.chinaCourierTracking || 'domestic partner'}. Weighed (${cnWeight} KG) and palletized.`
        : (record.chinaCourierTracking ? `Cargo received from domestic carrier ${record.chinaCourierTracking} and staged for consolidation.` : TRACKING_STATUSES.cn_warehouse_received.defaultDescription),
      locationName: 'GoShipping Guangzhou Logistics Center, China',
      eventTime: stage2Time,
      occurredAtBst: formatBstDateTime(stage2Time),
      lat: 23.3924,
      lng: 113.2988,
      source: 'warehouse',
      visibility: 'public',
      eventVersion: 2
    });
  }

  // Stage 3: dispatched_from_china
  if (maxStageIdx >= 2) {
    const stage3Time = new Date(new Date(cnDateIso).getTime() + 24 * 3600000).toISOString();
    events.push({
      id: `evt-${record.id}-dispatched`,
      shipmentId: record.id,
      status: 'dispatched_from_china',
      statusCode: 'dispatched_from_china',
      statusLabel: TRACKING_STATUSES.dispatched_from_china.label,
      title: 'DISPATCHED FROM CHINA',
      description:
        mode === 'air'
          ? 'Export customs cleared and departed Guangzhou Baiyun (CAN) via scheduled flight.'
          : 'Export customs cleared and departed Shenzhen Maritime Port via container vessel.',
      locationName: mode === 'air' ? 'Guangzhou Baiyun Airport (CAN), China' : 'Shenzhen Shekou Port, China',
      eventTime: stage3Time,
      occurredAtBst: formatBstDateTime(stage3Time),
      source: 'carrier_api',
      visibility: 'public',
      eventVersion: 3
    });
  }

  // Stage 4: arrived_dhaka_airport
  if (maxStageIdx >= 3) {
    const stage4Time = bdDateIso;
    events.push({
      id: `evt-${record.id}-arrived-dac`,
      shipmentId: record.id,
      status: 'arrived_dhaka_airport',
      statusCode: 'arrived_dhaka_airport',
      statusLabel: TRACKING_STATUSES.arrived_dhaka_airport.label,
      title: 'ARRIVED DHAKA AIRPORT',
      description: 'Cargo flight touched down at Dhaka Hazrat Shahjalal International Airport (HSIA). Transferred to Cargo Village.',
      locationName: 'HSIA Cargo Village, Dhaka, Bangladesh',
      eventTime: stage4Time,
      occurredAtBst: formatBstDateTime(stage4Time),
      lat: 23.8433,
      lng: 90.4029,
      source: 'carrier_api',
      visibility: 'public',
      eventVersion: 4
    });
  }

  // Stage 5: awaiting_customs
  if (maxStageIdx >= 4) {
    const stage5Time = new Date(new Date(bdDateIso).getTime() + 12 * 3600000).toISOString();
    events.push({
      id: `evt-${record.id}-customs`,
      shipmentId: record.id,
      status: 'awaiting_customs',
      statusCode: 'awaiting_customs',
      statusLabel: TRACKING_STATUSES.awaiting_customs.label,
      title: 'AWAITING CUSTOMS CLEARANCE',
      description: 'Bill of Entry submitted to NBR Customs. Document assessment and duty valuation in progress.',
      locationName: 'Dhaka Custom House, HSIA, Bangladesh',
      eventTime: stage5Time,
      occurredAtBst: formatBstDateTime(stage5Time),
      lat: 23.8433,
      lng: 90.4029,
      source: 'admin',
      visibility: 'public',
      eventVersion: 5
    });
  }

  // Stage 6: bd_warehouse_received
  if (maxStageIdx >= 5) {
    const stage6Time = new Date(new Date(bdDateIso).getTime() + 24 * 3600000).toISOString();
    events.push({
      id: `evt-${record.id}-bd-warehouse`,
      shipmentId: record.id,
      status: 'bd_warehouse_received',
      statusCode: 'bd_warehouse_received',
      statusLabel: TRACKING_STATUSES.bd_warehouse_received.label,
      title: 'BD WAREHOUSE RECEIVED',
      description: 'Customs cleared and securely received at GoShipping Dhaka sorting terminal for sorting and dispatch.',
      locationName: 'GoShipping Central Sorting Terminal, Dhaka',
      eventTime: stage6Time,
      occurredAtBst: formatBstDateTime(stage6Time),
      source: 'warehouse',
      visibility: 'public',
      eventVersion: 6
    });
  }

  // Independent milestone: payment_received (if paid)
  if (record.paymentStatus === 'Paid') {
    events.push({
      id: `evt-${record.id}-payment`,
      shipmentId: record.id,
      status: 'payment_received',
      statusCode: 'payment_received',
      statusLabel: TRACKING_STATUSES.payment_received.label,
      title: 'PAYMENT RECEIVED',
      description: 'Freight tariffs, duties, and local delivery charges settled in full.',
      locationName: 'GoShipping Corporate Finance & Billing Desk, Dhaka',
      eventTime: record.updatedAt || nowIso,
      occurredAtBst: formatBstDateTime(record.updatedAt || nowIso),
      source: 'admin',
      visibility: 'public',
      eventVersion: 7
    });
  }

  // Stage 7: out_for_delivery
  if (maxStageIdx >= 6) {
    const stage7Time = new Date(new Date(bdDateIso).getTime() + 36 * 3600000).toISOString();
    events.push({
      id: `evt-${record.id}-out-delivery`,
      shipmentId: record.id,
      status: 'out_for_delivery',
      statusCode: 'out_for_delivery',
      statusLabel: TRACKING_STATUSES.out_for_delivery.label,
      title: 'OUT FOR DELIVERY',
      description: record.bdCourierName
        ? `Consignment handed over to ${record.bdCourierName}${record.bdTrackingNo ? ` (Tracking: ${record.bdTrackingNo})` : ''} for doorstep delivery.`
        : TRACKING_STATUSES.out_for_delivery.defaultDescription,
      locationName: 'Dhaka Metropolitan Urban Dispatch Unit',
      eventTime: stage7Time,
      occurredAtBst: formatBstDateTime(stage7Time),
      source: 'driver',
      visibility: 'public',
      eventVersion: 8
    });
  }

  // Stage 8: delivered
  if (maxStageIdx >= 7) {
    const stage8Time = new Date(new Date(bdDateIso).getTime() + 48 * 3600000).toISOString();
    events.push({
      id: `evt-${record.id}-delivered`,
      shipmentId: record.id,
      status: 'delivered',
      statusCode: 'delivered',
      statusLabel: TRACKING_STATUSES.delivered.label,
      title: 'DELIVERED',
      description: 'Package successfully delivered and received with consignee confirmation.',
      locationName: 'Consignee Delivery Address, Bangladesh',
      eventTime: stage8Time,
      occurredAtBst: formatBstDateTime(stage8Time),
      source: 'driver',
      visibility: 'public',
      eventVersion: 9
    });
  }

  // Reverse events so newest is first
  events.reverse();

  // Progress
  const physicalProgress = calculatePhysicalProgress(normStatus, events);

  // Clean customer display name
  const cleanCustomerName = (record.customerName || 'Valued Importer').replace(/\s*\([^)]*\)/g, '').trim();

  // Item image
  let productImage = '/assets/products/cotton-fabrics.svg';
  const itemLower = (record.itemDetails || '').toLowerCase();
  if (
    itemLower.includes('watch') ||
    itemLower.includes('sensor') ||
    itemLower.includes('electronics') ||
    itemLower.includes('earbuds') ||
    itemLower.includes('module')
  ) {
    productImage = '/assets/products/electronics.svg';
  }

  return {
    id: record.id,
    trackingNumber,
    productName: record.itemDetails || 'Commercial Cargo Consignment',
    productImage,
    customerId: `cust-${record.mobileNo.replace(/\D/g, '') || record.id}`,
    customerName: cleanCustomerName,
    customerPhone: record.mobileNo,
    recipientName: cleanCustomerName,
    recipientPhone: record.mobileNo,
    recipientAddress: record.importerClient ? `${record.importerClient}, Dhaka, Bangladesh` : 'Dhaka, Bangladesh',
    originCountry: 'China',
    originCity: 'Guangzhou',
    originAddress: 'GoShipping Guangzhou Logistics Center, China',
    originLat: 23.3924,
    originLng: 113.2988,
    destCountry: 'Bangladesh',
    destCity: 'Dhaka',
    destAddress: 'Cargo Village, Hazrat Shahjalal International Airport, Dhaka',
    destLat: 23.8433,
    destLng: 90.4029,
    mode,
    serviceLevel: 'express',
    status: normStatus,
    statusCode: normStatus,
    statusLabel: statusDef.label,
    paymentStatus: record.paymentStatus === 'Paid' ? 'payment_received' : 'pending',
    eventVersion: events.length,
    currentLocation: events[0]?.locationName || statusDef.defaultLocation,
    currentLat: events[0]?.lat,
    currentLng: events[0]?.lng,
    totalWeightKg: weight,
    totalCbm: weight > 0 ? Math.max(0.01, Math.round((weight / 167) * 100) / 100) : 0,
    totalPieces: pieces,
    cnWeightKg: cnWeight,
    bdWeightKg: bdWeight,
    carrierName: record.bdCourierName ? `${record.bdCourierName} / GoShipping Lines` : 'GoShipping Express Linehaul',
    carrierWaybillNumber: record.chinaCourierTracking || record.bdTrackingNo || undefined,
    voyageOrFlightNumber: mode === 'air' ? 'Flight GS-701 (CAN-DAC)' : 'Vessel GS OCEAN-12',
    billOfLadingNumber: record.shippingMark ? `MARK-${record.shippingMark}` : `BL-${trackingNumber}`,
    departureTime: cnDateIso,
    estimatedDelivery: new Date(new Date(orderDateIso).getTime() + 7 * 86400000).toISOString(),
    actualDelivery: normStatus === 'delivered' ? bdDateIso : undefined,
    bookingReference: record.websiteOrderNo || record.shippingMark || undefined,
    notes: record.remark || undefined,
    items: [
      {
        id: `itm-${record.id}`,
        shipmentId: record.id,
        itemCode: record.shippingMark ? `#${record.shippingMark}` : `#ITM-${pieces}`,
        description: record.itemDetails || 'Commercial Cargo Items',
        imageUrl: productImage,
        packagingType: 'carton',
        quantity: pieces,
        weightKg: weight,
        cbm: weight > 0 ? Math.max(0.01, Math.round((weight / 167) * 100) / 100) : 0,
        categoryTag: 'Commercial',
        currency: 'BDT'
      }
    ],
    events,
    physicalProgress,
    createdAt: record.createdAt || nowIso,
    updatedAt: record.updatedAt || nowIso,
    lastUpdatedBst: formatBstDateTime(record.updatedAt || nowIso)
  };
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  itemCode: string; // e.g. '#GA5133'
  description: string;
  imageUrl?: string;
  packagingType: '40ft_hq' | '20ft_container' | '10ft_container' | 'air_uld' | 'pallet' | 'carton' | string;
  quantity: number;
  weightKg: number;
  cbm: number;
  categoryTag: 'General' | 'Commercial' | 'Liquids' | 'Dangerous' | 'Perishable' | 'Electronics';
  declaredValue?: number;
  currency?: string;
  arrived?: boolean;
  arrivedQuantity?: number;
  arrivedWeightKg?: number;
  arrivedAt?: string;
  invoiceNumber?: string;
}

export interface ShipmentEvent {
  id: string;
  shipmentId: string;
  status: string;
  statusCode: TrackingStatusCode;
  statusLabel: string;
  title: string;
  description: string;
  locationName: string;
  eventTime: string; // ISO UTC
  occurredAtBst: string; // "25 Oct 2026, 08:15 PM BST"
  lat?: number;
  lng?: number;
  source: 'warehouse' | 'admin' | 'carrier_api' | 'driver';
  visibility: 'public' | 'internal';
  eventVersion: number;
}

export interface ShipmentRecord {
  id: string;
  trackingNumber: string;
  productName: string;
  productImage?: string;
  productImages?: string[];
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientAddress: string;
  originCountry: string;
  originCity: string;
  originAddress: string;
  originLat: number;
  originLng: number;
  destCountry: string;
  destCity: string;
  destAddress: string;
  destLat: number;
  destLng: number;
  mode: 'air' | 'sea' | 'road' | 'hand_carry';
  serviceLevel: 'standard' | 'express' | 'priority';
  status: TrackingStatusCode;
  statusCode: TrackingStatusCode;
  statusLabel: string;
  paymentStatus: 'pending' | 'payment_received';
  eventVersion: number;
  currentLocation: string;
  currentLat?: number;
  currentLng?: number;
  totalWeightKg: number;
  totalCbm: number;
  totalPieces: number;
  cnWeightKg?: number;
  bdWeightKg?: number;
  carrierName: string;
  carrierWaybillNumber?: string;
  voyageOrFlightNumber: string;
  billOfLadingNumber: string;
  departureTime: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  bookingReference?: string;
  notes?: string;
  items: ShipmentItem[];
  events: ShipmentEvent[];
  physicalProgress: {
    completedStagesCount: number;
    totalStagesCount: number;
    percentage: number;
    currentPhysicalStageIndex: number;
    isComplete: boolean;
  };
  createdAt: string;
  updatedAt: string;
  lastUpdatedBst: string;
}

// Live operational shipments store (empty by default; populated via bookings & admin dispatch)
let initialShipments: ShipmentRecord[] = [];

export class ShipmentService {
  /**
   * Get all shipments with filtering & search
   */
  static async listShipments(params?: {
    trackingNumber?: string;
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    status?: string;
    mode?: string;
    query?: string;
  }): Promise<ShipmentRecord[]> {
    let posShipments: ShipmentRecord[] = [];
    try {
      const posRecords = await PosLedgerService.listRecords();
      posShipments = posRecords.map(convertPosRecordToShipment);
    } catch (e) {
      console.error('[ShipmentService] listShipments posRecords error:', e);
    }

    const seen = new Set<string>();
    const all: ShipmentRecord[] = [];
    for (const p of posShipments) {
      seen.add(p.trackingNumber.toUpperCase());
      all.push(p);
    }
    for (const s of initialShipments) {
      if (!seen.has(s.trackingNumber.toUpperCase())) {
        seen.add(s.trackingNumber.toUpperCase());
        all.push(s);
      }
    }

    let results = all;

    if (params?.customerId) {
      const cId = params.customerId;
      const cName = params.customerName?.toLowerCase();
      results = results.filter(
        (s) =>
          s.customerId === cId ||
          (cName && s.customerName.toLowerCase() === cName)
      );
    }
    if (params?.status && params.status !== 'all') {
      const normalized = normalizeStatusCode(params.status);
      results = results.filter((s) => s.statusCode === normalized || s.status === params.status);
    }
    if (params?.mode && params.mode !== 'all') {
      results = results.filter((s) => s.mode === params.mode);
    }
    if (params?.query) {
      const q = params.query.toLowerCase().trim();
      results = results.filter(
        (s) =>
          s.trackingNumber.toLowerCase().includes(q) ||
          s.originCity.toLowerCase().includes(q) ||
          s.destCity.toLowerCase().includes(q) ||
          s.productName.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.carrierName.toLowerCase().includes(q) ||
          s.voyageOrFlightNumber.toLowerCase().includes(q)
      );
    }

    return results;
  }

  /**
   * Unified tracking search by Tracking Code, Email, or Phone Number
   */
  static async searchShipmentsUnified(query: string): Promise<{
    shipments: ShipmentRecord[];
    searchType: 'tracking_code' | 'email' | 'phone';
  }> {
    const raw = query.trim();
    if (!raw) {
      return { shipments: [], searchType: 'tracking_code' };
    }

    const cleanUpper = raw.toUpperCase();
    const cleanLower = raw.toLowerCase();
    const digitsOnly = normalizePhoneDigits(raw);

    const isEmail = cleanLower.includes('@');

    // 1. Fetch all POS ledger records
    let posRecords: PosLedgerRecord[] = [];
    try {
      posRecords = await PosLedgerService.listRecords();
    } catch (e) {
      console.error('[ShipmentService] Failed to load POS ledger records:', e);
    }

    // Check if query is directly a known tracking number or carrier waybill before guessing phone number
    const isDirectTracking =
      initialShipments.some(
        (s) =>
          s.trackingNumber.toUpperCase() === cleanUpper ||
          s.id.toLowerCase() === cleanLower ||
          (s.carrierWaybillNumber && s.carrierWaybillNumber.toUpperCase() === cleanUpper) ||
          (s.billOfLadingNumber && s.billOfLadingNumber.toUpperCase() === cleanUpper)
      ) ||
      posRecords.some(
        (r) =>
          isOrderIdMatch(raw, r.orderId) ||
          (r.id && r.id.toLowerCase() === cleanLower) ||
          isShippingMarkMatch(raw, r.shippingMark) ||
          isCourierTrackingMatch(raw, r.chinaCourierTracking) ||
          isCourierTrackingMatch(raw, r.bdTrackingNo)
      );

    const isPhone = !isDirectTracking && !isEmail && digitsOnly.length >= 6 && /^[\d\s+\-()]{6,}$/.test(raw);
    const searchType: 'tracking_code' | 'email' | 'phone' = isEmail ? 'email' : isPhone ? 'phone' : 'tracking_code';

    // Look up accounts matching email or phone
    const accounts = getAllAccounts();
    const matchedAccountIds = new Set<string>();

    if (isEmail) {
      for (const acc of accounts) {
        if (acc.email && acc.email.toLowerCase() === cleanLower) {
          matchedAccountIds.add(acc.id);
        }
      }
    } else if (isPhone) {
      for (const acc of accounts) {
        if (acc.phone && isPhoneMatch(raw, acc.phone)) {
          matchedAccountIds.add(acc.id);
        }
      }
    }

    const matchedShipments: ShipmentRecord[] = [];
    const addedIds = new Set<string>();

    // 2. Search POS ledger records first (they are live operational orders)
    for (const record of posRecords) {
      let matches = false;

      // Phone query
      if (isPhone) {
        if (isPhoneMatch(raw, record.mobileNo)) {
          matches = true;
        }
      }

      // Order ID / Tracking query
      if (!isEmail && (isOrderIdMatch(raw, record.orderId) || (record.id && record.id.toLowerCase() === cleanLower))) {
        matches = true;
      }

      // Shipping mark
      if (!isEmail && !isPhone && isShippingMarkMatch(raw, record.shippingMark)) {
        matches = true;
      }

      // Courier tracking (China SF/ZTO or BD Courier)
      if (
        !isEmail &&
        !isPhone &&
        (isCourierTrackingMatch(raw, record.chinaCourierTracking) || isCourierTrackingMatch(raw, record.bdTrackingNo))
      ) {
        matches = true;
      }

      // Customer name or Importer name partial match
      if (!isEmail && !isPhone && raw.length >= 4) {
        if (
          record.customerName?.toLowerCase().includes(cleanLower) ||
          record.importerClient?.toLowerCase().includes(cleanLower)
        ) {
          matches = true;
        }
      }

      if (matches && !addedIds.has(record.orderId || record.id)) {
        addedIds.add(record.orderId || record.id);
        matchedShipments.push(convertPosRecordToShipment(record));
      }
    }

    // 3. Search initialShipments
    for (const s of initialShipments) {
      if (addedIds.has(s.trackingNumber) || addedIds.has(s.id)) continue;

      let matches = false;

      // Direct tracking number / identifiers match
      if (
        s.trackingNumber.toUpperCase() === cleanUpper ||
        s.id.toLowerCase() === cleanLower ||
        (s.carrierWaybillNumber && s.carrierWaybillNumber.toUpperCase() === cleanUpper) ||
        (s.billOfLadingNumber && s.billOfLadingNumber.toUpperCase() === cleanUpper)
      ) {
        matches = true;
      }

      // Partial tracking number match
      if (!isEmail && !isPhone && raw.length >= 4) {
        if (s.trackingNumber.toUpperCase().includes(cleanUpper)) {
          matches = true;
        }
      }

      // Email match
      if (isEmail) {
        if (s.customerEmail && s.customerEmail.toLowerCase() === cleanLower) matches = true;
        if (s.recipientEmail && s.recipientEmail.toLowerCase() === cleanLower) matches = true;
        if (matchedAccountIds.has(s.customerId)) matches = true;
      }

      // Phone match
      if (isPhone) {
        if (isPhoneMatch(raw, s.customerPhone)) matches = true;
        if (isPhoneMatch(raw, s.recipientPhone)) matches = true;
        if (matchedAccountIds.has(s.customerId)) matches = true;
      }

      if (matches) {
        addedIds.add(s.trackingNumber);
        matchedShipments.push(s);
      }
    }

    // 4. Fallback: if searchType was tracking_code but didn't match, check phone or email
    if (matchedShipments.length === 0 && !isEmail && digitsOnly.length >= 8) {
      for (const record of posRecords) {
        if (isPhoneMatch(raw, record.mobileNo) && !addedIds.has(record.orderId || record.id)) {
          addedIds.add(record.orderId || record.id);
          matchedShipments.push(convertPosRecordToShipment(record));
        }
      }
      for (const s of initialShipments) {
        if (addedIds.has(s.trackingNumber) || addedIds.has(s.id)) continue;
        if (isPhoneMatch(raw, s.customerPhone) || isPhoneMatch(raw, s.recipientPhone)) {
          addedIds.add(s.trackingNumber);
          matchedShipments.push(s);
        }
      }
      if (matchedShipments.length > 0) {
        return { shipments: matchedShipments, searchType: 'phone' };
      }
    }

    return { shipments: matchedShipments, searchType };
  }

  /**
   * Get single shipment by tracking number, id, email, or phone
   */
  static async getByTrackingNumber(trackingNumber: string): Promise<ShipmentRecord | null> {
    const clean = trackingNumber.trim();
    if (!clean) return null;

    // Check POS record directly
    try {
      const posRec = await PosLedgerService.getById(clean);
      if (posRec) {
        return convertPosRecordToShipment(posRec);
      }
    } catch {}

    const direct = initialShipments.find(
      (s) => s.trackingNumber.toUpperCase() === clean.toUpperCase() || s.id.toLowerCase() === clean.toLowerCase()
    );
    if (direct) return { ...direct };

    const { shipments } = await this.searchShipmentsUnified(clean);
    return shipments.length > 0 ? { ...shipments[0] } : null;
  }

  /**
   * Get direct reference to shipment by ID or Tracking
   */
  static async getById(idOrTracking: string): Promise<ShipmentRecord | null> {
    const clean = idOrTracking.trim();
    if (!clean) return null;

    try {
      const posRec = await PosLedgerService.getById(clean);
      if (posRec) {
        return convertPosRecordToShipment(posRec);
      }
    } catch {}

    const found = initialShipments.find(
      (s) => s.id === clean || s.trackingNumber.toUpperCase() === clean.toUpperCase()
    );
    if (found) return { ...found };

    const { shipments } = await this.searchShipmentsUnified(clean);
    return shipments.length > 0 ? { ...shipments[0] } : null;
  }

  /**
   * Update selective product item arrival statuses
   */
  static async updateItemArrivals(
    shipmentId: string,
    arrivals: Array<{ itemId: string; arrived: boolean; arrivedQuantity?: number; arrivedWeightKg?: number }>
  ): Promise<ShipmentRecord | null> {
    const shipment = await this.getById(shipmentId);
    if (!shipment) return null;

    const arrivalMap = new Map<string, { arrived: boolean; arrivedQuantity?: number; arrivedWeightKg?: number }>();
    arrivals.forEach((a) => arrivalMap.set(a.itemId, a));

    if (shipment.items) {
      shipment.items = shipment.items.map((si: ShipmentItem) => {
        const match = arrivalMap.get(si.id);
        if (match) {
          return {
            ...si,
            arrived: match.arrived,
            arrivedQuantity: match.arrivedQuantity !== undefined ? match.arrivedQuantity : si.quantity,
            arrivedWeightKg: match.arrivedWeightKg !== undefined ? match.arrivedWeightKg : si.weightKg,
            arrivedAt: match.arrived ? new Date().toISOString() : undefined
          };
        }
        return si;
      });
    }

    shipment.updatedAt = new Date().toISOString();
    return shipment;
  }

  /**
   * Create master shipment
   */
  static async createShipment(data: {
    trackingNumber?: string;
    customerId?: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    productName?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    recipientAddress?: string;
    originCountry: string;
    originCity: string;
    originAddress?: string;
    originLat?: number;
    originLng?: number;
    destCountry: string;
    destCity: string;
    destAddress?: string;
    destLat?: number;
    destLng?: number;
    mode: 'air' | 'sea' | 'road' | 'hand_carry';
    serviceLevel: 'standard' | 'express' | 'priority';
    totalWeightKg: number;
    totalCbm: number;
    totalPieces: number;
    items?: Array<{
      description: string;
      itemCode?: string;
      packagingType?: string;
      quantity?: number;
      weightKg?: number;
      cbm?: number;
      categoryTag?: 'General' | 'Commercial' | 'Liquids' | 'Dangerous' | 'Perishable' | 'Electronics';
      declaredValue?: number;
      currency?: string;
    }>;
    estimatedDelivery?: string;
    carrierName?: string;
    voyageOrFlightNumber?: string;
    billOfLadingNumber?: string;
    notes?: string;
  }): Promise<ShipmentRecord> {
    const id = `shp-${Date.now().toString(36)}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingNumber = data.trackingNumber?.trim()
      ? data.trackingNumber.trim().toUpperCase()
      : `GOSH-${new Date().getFullYear()}-${randomSuffix}`;
    const now = new Date().toISOString();

    const originLat =
      data.originLat ||
      (data.originCity.toLowerCase().includes('guangzhou')
        ? 23.3924
        : data.originCity.toLowerCase().includes('yiwu')
        ? 29.3068
        : 22.5431);
    const originLng =
      data.originLng ||
      (data.originCity.toLowerCase().includes('guangzhou')
        ? 113.2988
        : data.originCity.toLowerCase().includes('yiwu')
        ? 120.0751
        : 114.0579);
    const destLat = data.destLat || (data.destCity.toLowerCase().includes('chittagong') ? 22.3193 : 23.8433);
    const destLng = data.destLng || (data.destCity.toLowerCase().includes('chittagong') ? 91.8105 : 90.4029);

    const defaultItems: ShipmentItem[] =
      data.items && data.items.length > 0
        ? data.items.map((it, idx) => ({
            id: `itm-${id}-${idx}`,
            shipmentId: id,
            itemCode: it.itemCode || `#ITM-${1000 + idx}`,
            description: it.description,
            packagingType: it.packagingType || 'carton',
            quantity: it.quantity || 1,
            weightKg: it.weightKg || data.totalWeightKg,
            cbm: it.cbm || data.totalCbm,
            categoryTag: it.categoryTag || 'Commercial',
            declaredValue: it.declaredValue,
            currency: it.currency || 'BDT'
          }))
        : [
            {
              id: `itm-${id}-0`,
              shipmentId: id,
              itemCode: `#GOSH-${randomSuffix}`,
              description: data.productName || `${data.mode.toUpperCase()} Commercial Cargo Consignment`,
              packagingType: data.mode === 'sea' ? '40ft_hq' : data.mode === 'air' ? 'air_uld' : 'pallet',
              quantity: data.totalPieces,
              weightKg: data.totalWeightKg,
              cbm: data.totalCbm,
              categoryTag: 'Commercial',
              declaredValue: 2450000,
              currency: 'BDT'
            }
          ];

    const initialEvent: ShipmentEvent = {
      id: `evt-${id}-init`,
      shipmentId: id,
      status: 'purchased',
      statusCode: 'purchased',
      statusLabel: 'PURCHASED',
      title: 'PURCHASED CHINA WAREHOUSE',
      description: `Commercial consignment registered and booked from ${data.originCity}, ${data.originCountry} to ${data.destCity}, ${data.destCountry}.`,
      locationName: `${data.originCity} Operations Hub, ${data.originCountry}`,
      eventTime: now,
      occurredAtBst: formatBstDateTime(now),
      lat: originLat,
      lng: originLng,
      source: 'admin',
      visibility: 'public',
      eventVersion: 1
    };

    const newShipment: ShipmentRecord = {
      id,
      trackingNumber,
      productName: data.productName || 'Commercial Freight Cargo',
      customerId: data.customerId || 'usr-customer-01',
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      recipientName: data.recipientName || `${data.customerName} Receiving Hub`,
      recipientPhone: data.recipientPhone || '+880 1711-000000',
      recipientEmail: data.recipientEmail,
      recipientAddress: data.recipientAddress || `${data.destCity}, ${data.destCountry}`,
      originCountry: data.originCountry,
      originCity: data.originCity,
      originAddress: data.originAddress || `${data.originCity} International Terminal`,
      originLat,
      originLng,
      destCountry: data.destCountry,
      destCity: data.destCity,
      destAddress: data.destAddress || `${data.destCity} Cargo Receiving Station`,
      destLat,
      destLng,
      mode: data.mode,
      serviceLevel: data.serviceLevel,
      status: 'purchased',
      statusCode: 'purchased',
      statusLabel: 'PURCHASED',
      paymentStatus: 'pending',
      eventVersion: 1,
      currentLocation: `${data.originCity} Receiving Hub`,
      currentLat: originLat,
      currentLng: originLng,
      totalWeightKg: data.totalWeightKg,
      totalCbm: data.totalCbm,
      totalPieces: data.totalPieces,
      carrierName: data.carrierName || 'GoShipping Logistics Lines',
      voyageOrFlightNumber:
        data.voyageOrFlightNumber ||
        (data.mode === 'air' ? 'Flight GS-701' : data.mode === 'sea' ? 'Vessel GS OCEAN-12' : 'Truck TRC-101'),
      billOfLadingNumber: data.billOfLadingNumber || `BL-${trackingNumber}`,
      departureTime: now,
      estimatedDelivery: data.estimatedDelivery || new Date(Date.now() + 6 * 86400000).toISOString(),
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
      lastUpdatedBst: formatBstDateTime(now),
      items: defaultItems,
      events: [initialEvent],
      physicalProgress: {
        completedStagesCount: 1,
        totalStagesCount: 8,
        percentage: 13,
        currentPhysicalStageIndex: 0,
        isComplete: false
      }
    };

    initialShipments.unshift(newShipment);

    // Broadcast new consignment
    RealtimeService.broadcastShipmentUpdate({
      trackingNumber: newShipment.trackingNumber,
      shipmentId: newShipment.id,
      status: newShipment.status,
      statusCode: newShipment.statusCode,
      statusLabel: newShipment.statusLabel,
      paymentStatus: newShipment.paymentStatus,
      version: newShipment.eventVersion,
      updatedAt: newShipment.updatedAt,
      latestEvent: initialEvent
    }).catch(() => {});

    return newShipment;
  }

  /**
   * Update shipment status and atomically record a new verified tracking event
   */
  static async updateStatus(
    shipmentId: string,
    data: {
      status: TrackingStatusCode | string;
      title?: string;
      description?: string;
      locationName?: string;
      lat?: number;
      lng?: number;
      source?: 'warehouse' | 'admin' | 'carrier_api' | 'driver';
      eventTime?: string; // ISO string if specified by admin
      notes?: string;
      visibility?: 'public' | 'internal';
      paymentStatus?: 'pending' | 'payment_received';
    }
  ): Promise<ShipmentRecord | null> {
    // 1. Check if target is a POS Ledger order
    try {
      const posRec = await PosLedgerService.getById(shipmentId);
      if (posRec) {
        const normalizedCode = normalizeStatusCode(data.status);
        const statusDef = TRACKING_STATUSES[normalizedCode];

        const updatedPos = await PosLedgerService.updateRecord(posRec.id, {
          currentStatus: statusDef.label
        });
        if (updatedPos) {
          const converted = convertPosRecordToShipment(updatedPos);

          RealtimeService.broadcastShipmentUpdate({
            trackingNumber: converted.trackingNumber,
            shipmentId: converted.id,
            status: converted.status,
            statusCode: converted.statusCode,
            statusLabel: converted.statusLabel,
            paymentStatus: converted.paymentStatus,
            version: converted.eventVersion,
            updatedAt: converted.updatedAt,
            latestEvent: {
              id: converted.events[0]?.id || `evt-${Date.now()}`,
              statusCode: converted.statusCode,
              statusLabel: converted.statusLabel,
              title: data.title || statusDef.label,
              description: data.description || statusDef.defaultDescription,
              locationName: data.locationName || statusDef.defaultLocation,
              eventTime: new Date().toISOString(),
              occurredAtBst: formatBstDateTime(new Date().toISOString()),
              source: data.source || 'admin'
            }
          }).catch(() => {});

          return converted;
        }
      }
    } catch (e) {
      console.error('[ShipmentService] Error updating POS status:', e);
    }

    // 2. Otherwise check initialShipments
    const shipment = initialShipments.find((s) => s.id === shipmentId || s.trackingNumber === shipmentId);
    if (!shipment) return null;

    const normalizedCode = normalizeStatusCode(data.status);
    const statusDef = TRACKING_STATUSES[normalizedCode];
    const nowIso = new Date().toISOString();
    const eventTimeIso = data.eventTime ? new Date(data.eventTime).toISOString() : nowIso;
    const eventBst = formatBstDateTime(eventTimeIso);

    // Increment optimistic version
    shipment.eventVersion += 1;

    // Unconditionally update shipment status to the chosen status so UI and live tracker match
    shipment.status = normalizedCode;
    shipment.statusCode = normalizedCode;
    shipment.statusLabel = statusDef.label;

    // Mark payment status if payment_received
    if (normalizedCode === 'payment_received' || data.paymentStatus === 'payment_received') {
      shipment.paymentStatus = 'payment_received';
    }

    if (data.locationName) {
      shipment.currentLocation = data.locationName;
    } else if (statusDef.defaultLocation) {
      shipment.currentLocation = statusDef.defaultLocation;
    }
    if (data.lat !== undefined) shipment.currentLat = data.lat;
    if (data.lng !== undefined) shipment.currentLng = data.lng;

    const eventId = `evt-${crypto.randomBytes(4).toString('hex')}`;
    const newEvent: ShipmentEvent = {
      id: eventId,
      shipmentId: shipment.id,
      status: normalizedCode,
      statusCode: normalizedCode,
      statusLabel: statusDef.label,
      title: data.title || statusDef.label,
      description: data.description || statusDef.defaultDescription,
      locationName: data.locationName || statusDef.defaultLocation,
      eventTime: eventTimeIso,
      occurredAtBst: eventBst,
      lat: data.lat,
      lng: data.lng,
      source: data.source || 'admin',
      visibility: data.visibility || 'public',
      eventVersion: shipment.eventVersion
    };

    // Add event at top of events list
    shipment.events.unshift(newEvent);
    shipment.updatedAt = nowIso;
    shipment.lastUpdatedBst = formatBstDateTime(nowIso);

    // Recalculate physical progress from actual events
    shipment.physicalProgress = calculatePhysicalProgress(shipment.status, shipment.events);

    // Publish to real-time synchronization channels
    RealtimeService.broadcastShipmentUpdate({
      trackingNumber: shipment.trackingNumber,
      shipmentId: shipment.id,
      status: shipment.status,
      statusCode: shipment.statusCode,
      statusLabel: shipment.statusLabel,
      paymentStatus: shipment.paymentStatus,
      version: shipment.eventVersion,
      updatedAt: shipment.updatedAt,
      latestEvent: {
        id: newEvent.id,
        statusCode: newEvent.statusCode,
        statusLabel: newEvent.statusLabel,
        title: newEvent.title,
        description: newEvent.description,
        locationName: newEvent.locationName,
        eventTime: newEvent.eventTime
      }
    }).catch((err) => {
      console.warn('[ShipmentService] Realtime broadcast error:', err.message);
    });

    return shipment;
  }

  /**
   * Legacy wrapper: Add event
   */
  static async addEvent(
    shipmentId: string,
    eventData: {
      status: string;
      title: string;
      description: string;
      locationName: string;
      lat?: number;
      lng?: number;
      source?: 'warehouse' | 'admin' | 'carrier_api';
      eventTime?: string;
    }
  ): Promise<ShipmentRecord | null> {
    return this.updateStatus(shipmentId, eventData);
  }

  /**
   * Delete a shipment (Admin function)
   */
  static async deleteShipment(id: string): Promise<boolean> {
    const index = initialShipments.findIndex((s) => s.id === id || s.trackingNumber === id);
    if (index === -1) return false;
    initialShipments.splice(index, 1);
    return true;
  }

  /**
   * Update shipment details (Admin function)
   */
  static async updateShipment(
    id: string,
    updates: Partial<ShipmentRecord>
  ): Promise<ShipmentRecord | null> {
    const shipment = initialShipments.find((s) => s.id === id || s.trackingNumber === id);
    if (!shipment) return null;

    Object.assign(shipment, updates, { updatedAt: new Date().toISOString() });
    shipment.lastUpdatedBst = formatBstDateTime(shipment.updatedAt);
    return shipment;
  }

  /**
   * Delete tracking event
   */
  static async deleteEvent(shipmentId: string, eventId: string): Promise<boolean> {
    const shipment = initialShipments.find((s) => s.id === shipmentId || s.trackingNumber === shipmentId);
    if (!shipment) return false;

    const eventIndex = shipment.events.findIndex((e) => e.id === eventId);
    if (eventIndex === -1) return false;

    shipment.events.splice(eventIndex, 1);
    shipment.updatedAt = new Date().toISOString();
    shipment.lastUpdatedBst = formatBstDateTime(shipment.updatedAt);
    shipment.physicalProgress = calculatePhysicalProgress(shipment.status, shipment.events);
    return true;
  }
}
