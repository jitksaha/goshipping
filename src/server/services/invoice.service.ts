import fs from 'node:fs';
import path from 'node:path';
import { ShipmentService, ShipmentRecord } from './shipment.service';

const INVOICE_STORE_PATH = path.resolve(process.cwd(), '.invoices_store.json');

declare global {
  var __goshipping_invoices: InvoiceRecord[] | undefined;
}

export interface InvoiceItem {
  itemId: string;
  itemCode?: string;
  description: string;
  packagingType?: string;
  arrivedQuantity: number;
  totalQuantity: number;
  weightKg: number;
  cbm?: number;
  ratePerKg?: number;
  amountBDT: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  shipmentId: string;
  trackingNumber: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  recipientName: string;
  recipientPhone?: string;
  recipientAddress: string;
  origin: string;
  destination: string;
  mode: 'air' | 'sea' | 'road' | 'hand_carry';
  totalWeightKg: number;
  items: InvoiceItem[];
  baseFreight: number;
  terminalHandling: number;
  customsDuty: number;
  fuelSurcharge: number;
  subtotal: number;
  vatTax: number;
  totalBDT: number;
  totalUSD: number;
  shippingCharges?: number;
  discount?: number;
  advancePaid?: number;
  balanceDue?: number;
  status: 'pending' | 'paid';
  issueDate: string;
  dueDate: string;
  paymentMethod: string;
  bankId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Live operational invoices store
let initialInvoices: InvoiceRecord[] = [];

function loadInvoicesFromDisk(): InvoiceRecord[] {
  if (globalThis.__goshipping_invoices) {
    return globalThis.__goshipping_invoices;
  }
  try {
    if (fs.existsSync(INVOICE_STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(INVOICE_STORE_PATH, 'utf-8'));
      if (Array.isArray(data)) {
        globalThis.__goshipping_invoices = data;
        return data;
      }
    }
  } catch (err) {
    console.error('Failed reading .invoices_store.json:', err);
  }
  globalThis.__goshipping_invoices = [];
  return globalThis.__goshipping_invoices;
}

function saveInvoicesToDisk(records: InvoiceRecord[]) {
  globalThis.__goshipping_invoices = records;
  try {
    fs.writeFileSync(INVOICE_STORE_PATH, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing .invoices_store.json:', err);
  }
}

export class InvoiceService {
  static async listInvoices(params?: {
    shipmentId?: string;
    customerId?: string;
    status?: string;
    search?: string;
  }): Promise<InvoiceRecord[]> {
    let list = [...loadInvoicesFromDisk()];

    if (params?.shipmentId) {
      list = list.filter((i) => i.shipmentId === params.shipmentId);
    }
    if (params?.customerId) {
      list = list.filter((i) => i.customerId === params.customerId);
    }
    if (params?.status && params.status !== 'all') {
      list = list.filter((i) => i.status === params.status);
    }
    if (params?.search) {
      const q = params.search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.trackingNumber.toLowerCase().includes(q) ||
          i.destination.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async getById(idOrNumber: string): Promise<InvoiceRecord | null> {
    const list = loadInvoicesFromDisk();
    const inv = list.find(
      (i) => i.id === idOrNumber || i.invoiceNumber.toUpperCase() === idOrNumber.toUpperCase()
    );
    return inv || null;
  }

  /**
   * Helper to generate next sequential Invoice number in GOS-INV-XXXXX brand format (e.g. GOS-INV-00001, GOS-INV-00023)
   */
  static generateNextInvoiceNumber(): string {
    const list = loadInvoicesFromDisk();
    let maxSeq = 0;
    for (const inv of list) {
      if (!inv.invoiceNumber) continue;
      const match = inv.invoiceNumber.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    const nextSeq = maxSeq + 1;
    return `GOS-INV-${String(nextSeq).padStart(5, '0')}`;
  }

  /**
   * Creates a consolidated commercial invoice for multiple selected orders/consignments
   */
  static async createCommercialInvoice(data: {
    invoiceNumber?: string;
    customerName: string;
    companyName?: string;
    customerPhone?: string;
    customerAddress?: string;
    shippingMark?: string;
    mode?: 'air' | 'sea' | 'road' | 'hand_carry';
    orderIds?: string[];
    trackingNumber?: string;
    totalWeightKg?: number;
    items?: Array<{
      itemId?: string;
      itemCode?: string;
      description: string;
      packagingType?: string;
      arrivedQuantity: number;
      totalQuantity: number;
      weightKg: number;
      cbm?: number;
      ratePerKg?: number;
      amountBDT: number;
    }>;
    baseFreight?: number;
    terminalHandling?: number;
    customsDuty?: number;
    fuelSurcharge?: number;
    subtotal?: number;
    vatTax?: number;
    totalBDT: number;
    shippingCharges?: number;
    discount?: number;
    advancePaid?: number;
    balanceDue?: number;
    status?: 'pending' | 'paid';
    issueDate?: string;
    dueDate?: string;
    paymentMethod?: string;
    notes?: string;
  }): Promise<InvoiceRecord> {
    const invoices = loadInvoicesFromDisk();
    const id = `inv-${Date.now().toString(36)}`;
    const invoiceNumber = data.invoiceNumber?.trim() ? data.invoiceNumber.trim().toUpperCase() : InvoiceService.generateNextInvoiceNumber();
    const now = new Date();
    const issueDate = data.issueDate || now.toLocaleDateString('en-GB');
    const dueDate = data.dueDate || new Date(now.getTime() + 7 * 86400000).toLocaleDateString('en-GB');

    const totalWeightKg = Number(data.totalWeightKg) || 10;
    const baseFreight = Number(data.baseFreight) || (data.items?.reduce((a, b) => a + (b.amountBDT || 0), 0) || 0);
    const subtotal = data.subtotal !== undefined ? Number(data.subtotal) : baseFreight;
    const totalBDT = Number(data.totalBDT) || subtotal;
    const totalUSD = Math.round(totalBDT / 118);

    const displayName = data.companyName && data.companyName !== data.customerName
      ? `${data.customerName} (${data.companyName})`
      : data.customerName;

    const newInvoice: InvoiceRecord = {
      id,
      invoiceNumber,
      shipmentId: data.orderIds?.length ? data.orderIds.join(', ') : 'combined-consignments',
      trackingNumber: data.trackingNumber || (data.orderIds?.length ? data.orderIds.join(', ') : invoiceNumber),
      customerId: 'usr-customer-combined',
      customerName: displayName,
      customerPhone: data.customerPhone || '',
      recipientName: data.customerName,
      recipientPhone: data.customerPhone || '',
      recipientAddress: data.customerAddress || 'Dhaka, Bangladesh',
      origin: 'China (Guangzhou / Yiwu)',
      destination: 'Dhaka, Bangladesh',
      mode: data.mode || 'air',
      totalWeightKg,
      items: (data.items || []).map((it, idx) => ({
        itemId: it.itemId || `itm-${idx + 1}`,
        itemCode: it.itemCode,
        description: it.description,
        packagingType: it.packagingType || 'air_cargo',
        arrivedQuantity: it.arrivedQuantity,
        totalQuantity: it.totalQuantity,
        weightKg: it.weightKg,
        cbm: it.cbm,
        ratePerKg: it.ratePerKg,
        amountBDT: it.amountBDT
      })),
      baseFreight,
      terminalHandling: Number(data.terminalHandling) || 0,
      customsDuty: Number(data.customsDuty) || 0,
      fuelSurcharge: Number(data.fuelSurcharge) || 0,
      subtotal,
      vatTax: Number(data.vatTax) || 0,
      totalBDT,
      totalUSD,
      shippingCharges: data.shippingCharges,
      discount: data.discount,
      advancePaid: data.advancePaid,
      balanceDue: data.balanceDue,
      status: data.status || 'pending',
      issueDate,
      dueDate,
      paymentMethod: data.paymentMethod || 'Bank Wire / bKash',
      bankId: 'scb-bd',
      notes: data.notes || (data.orderIds?.length ? `Combined commercial invoice for orders: ${data.orderIds.join(', ')}` : ''),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    invoices.unshift(newInvoice);
    saveInvoicesToDisk(invoices);
    return newInvoice;
  }

  static async createInvoice(data: {
    shipmentId: string;
    invoiceNumber?: string;
    issueDate?: string;
    dueDate?: string;
    paymentMethod?: string;
    bankId?: string;
    notes?: string;
    status?: 'pending' | 'paid';
    shippingCharges?: number;
    discount?: number;
    advancePaid?: number;
    balanceDue?: number;
    ratePerKg?: number;
    baseFreightOverride?: number;
    terminalHandlingOverride?: number;
    customsDutyOverride?: number;
    fuelSurchargeOverride?: number;
    vatTaxOverride?: number;
    selectedItems: Array<{
      itemId: string;
      itemCode?: string;
      description: string;
      packagingType?: string;
      arrivedQuantity: number;
      totalQuantity: number;
      weightKg: number;
      cbm?: number;
      ratePerKg?: number;
    }>;
  }): Promise<InvoiceRecord | null> {
    const shipment = await ShipmentService.getById(data.shipmentId);
    if (!shipment) return null;

    const id = `inv-${Date.now().toString(36)}`;
    const invoiceNumber = data.invoiceNumber?.trim() ? data.invoiceNumber.trim().toUpperCase() : InvoiceService.generateNextInvoiceNumber();
    const now = new Date();
    const issueDate = data.issueDate || now.toLocaleDateString('en-GB');
    const dueDate = data.dueDate || new Date(now.getTime() + 7 * 86400000).toLocaleDateString('en-GB');

    // Default rate per KG according to mode if not specified
    const isAir = shipment.mode === 'air';
    const isSea = shipment.mode === 'sea';
    const isHandCarry = shipment.mode === 'hand_carry';
    const defaultRate = data.ratePerKg || (isAir ? 750 : isSea ? 240 : isHandCarry ? 1450 : 500);

    // Compute arrived total weight and item line costs
    let totalArrivedWeight = 0;
    const computedItems: InvoiceItem[] = data.selectedItems.map((it) => {
      const itemRate = it.ratePerKg || defaultRate;
      const weight = Number(it.weightKg) || 1;
      totalArrivedWeight += weight;
      const amountBDT = Math.round(weight * itemRate);
      return {
        itemId: it.itemId,
        itemCode: it.itemCode,
        description: it.description,
        packagingType: it.packagingType,
        arrivedQuantity: it.arrivedQuantity,
        totalQuantity: it.totalQuantity,
        weightKg: weight,
        cbm: it.cbm,
        ratePerKg: itemRate,
        amountBDT
      };
    });

    const baseFreight =
      data.baseFreightOverride !== undefined
        ? data.baseFreightOverride
        : computedItems.reduce((acc, it) => acc + it.amountBDT, 0);

    const customsDuty =
      data.customsDutyOverride !== undefined
        ? data.customsDutyOverride
        : Math.round(baseFreight * 0.05);

    const terminalHandling =
      data.terminalHandlingOverride !== undefined
        ? data.terminalHandlingOverride
        : isSea
        ? 8500
        : 2500;

    const fuelSurcharge =
      data.fuelSurchargeOverride !== undefined
        ? data.fuelSurchargeOverride
        : isAir
        ? 2200
        : 1500;

    const subtotal = baseFreight + customsDuty + terminalHandling + fuelSurcharge;
    const vatTax = data.vatTaxOverride !== undefined ? data.vatTaxOverride : Math.round(subtotal * 0.15);
    const totalBDT = subtotal + vatTax;
    const totalUSD = Math.round(totalBDT / 118);

    const newInvoice: InvoiceRecord = {
      id,
      invoiceNumber,
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      customerId: shipment.customerId,
      customerName: shipment.customerName,
      customerEmail: shipment.customerEmail,
      customerPhone: shipment.customerPhone,
      recipientName: shipment.recipientName,
      recipientPhone: shipment.recipientPhone,
      recipientAddress: shipment.recipientAddress,
      origin: `${shipment.originCity}, ${shipment.originCountry}`,
      destination: `${shipment.destCity}, ${shipment.destCountry}`,
      mode: shipment.mode,
      totalWeightKg: totalArrivedWeight > 0 ? totalArrivedWeight : shipment.totalWeightKg,
      items: computedItems,
      baseFreight,
      terminalHandling,
      customsDuty,
      fuelSurcharge,
      subtotal,
      vatTax,
      totalBDT,
      totalUSD,
      shippingCharges: data.shippingCharges,
      discount: data.discount,
      advancePaid: data.advancePaid,
      balanceDue: data.balanceDue,
      status: data.status || 'pending',
      issueDate,
      dueDate,
      paymentMethod: data.paymentMethod || 'Bank Wire (EFT / RTGS)',
      bankId: data.bankId || 'scb-bd',
      notes: data.notes || `Commercial tax invoice for ${computedItems.length} arrived products under ${shipment.trackingNumber}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    const invoices = loadInvoicesFromDisk();
    invoices.unshift(newInvoice);
    saveInvoicesToDisk(invoices);

    // Update the shipment's items to reflect their arrived state!
    const arrivedMap = new Map<string, { arrivedQty: number; arrivedWeight: number }>();
    for (const it of data.selectedItems) {
      arrivedMap.set(it.itemId, {
        arrivedQty: it.arrivedQuantity,
        arrivedWeight: it.weightKg
      });
    }

    if (shipment.items) {
      shipment.items = shipment.items.map((si: any) => {
        const arrival = arrivedMap.get(si.id);
        if (arrival) {
          return {
            ...si,
            arrived: true,
            arrivedQuantity: arrival.arrivedQty,
            arrivedWeightKg: arrival.arrivedWeight,
            arrivedAt: now.toISOString(),
            invoiceNumber
          };
        }
        return si;
      });
    }

    // If invoice is marked paid upon creation, sync shipment paymentStatus
    if (newInvoice.status === 'paid') {
      shipment.paymentStatus = 'payment_received';
    }

    return newInvoice;
  }

  static async updatePaymentStatus(
    idOrNumber: string,
    status: 'pending' | 'paid'
  ): Promise<InvoiceRecord | null> {
    const invoices = loadInvoicesFromDisk();
    const inv = invoices.find(
      (i) => i.id === idOrNumber || i.invoiceNumber.toUpperCase() === idOrNumber.toUpperCase()
    );
    if (!inv) return null;

    inv.status = status;
    inv.updatedAt = new Date().toISOString();
    saveInvoicesToDisk(invoices);

    // Sync with shipment payment status
    const shipment = await ShipmentService.getById(inv.shipmentId);
    if (shipment) {
      if (status === 'paid') {
        shipment.paymentStatus = 'payment_received';
      }
    }

    return inv;
  }
}
