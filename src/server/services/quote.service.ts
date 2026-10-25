import { ShipmentService } from './shipment.service';

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

let initialQuotes: QuoteRecord[] = [
  {
    id: 'qte-4401',
    quoteNumber: 'QTE-2026-4401',
    customerId: 'usr-customer-01',
    guestName: 'Apex Textiles Ltd',
    guestEmail: 'client@apextextiles.com',
    guestPhone: '+880 1711 000000',
    originCountry: 'China',
    originCity: 'Guangzhou',
    destCountry: 'Bangladesh',
    destCity: 'Dhaka',
    mode: 'air',
    serviceType: 'door_to_door',
    cargoDescription: '500 Pcs Commercial Electronics & Precision Accessories in Export Cartons',
    packagingType: 'carton',
    quantity: 25,
    totalWeightKg: 480.0,
    totalCbm: 2.8,
    status: 'priced',
    targetShipmentDate: '2026-11-05T00:00:00Z',
    validityDate: '2026-11-01T23:59:59Z',
    assignedStaffName: 'Nafis Chowdhury',
    assignedStaffId: 'usr-sales-01',
    createdAt: '2026-10-23T10:00:00Z',
    updatedAt: '2026-10-24T11:30:00Z',
    revisions: [
      {
        id: 'rev-01',
        quoteId: 'qte-4401',
        revisionNumber: 1,
        baseFreightCharge: 262300.0,
        fuelSurcharge: 34160.0,
        customsClearanceFee: 18300.0,
        handlingFee: 9150.0,
        insuranceFee: 5490.0,
        otherFees: 0.0,
        totalAmount: 329400.0,
        currency: 'BDT',
        validityDate: '2026-11-01T23:59:59Z',
        transitTimeDays: '3 - 5 business days',
        notes: 'Includes airline direct export handling from Guangzhou BAI Hub, customs clearance at HSIA Dhaka, and local bonded delivery.',
        createdAt: '2026-10-24T11:30:00Z'
      }
    ]
  },
  {
    id: 'qte-3920',
    quoteNumber: 'QTE-2026-3920',
    customerId: 'usr-customer-01',
    guestName: 'Beximco Pharma Hub',
    guestEmail: 'supplychain@beximco.org',
    guestPhone: '+880 1819 112233',
    originCountry: 'China',
    originCity: 'Shenzhen',
    destCountry: 'Bangladesh',
    destCity: 'Chittagong',
    mode: 'sea',
    serviceType: 'port_to_port',
    cargoDescription: 'Standard Industrial Machinery Components & Electronic Hardware in Sealed Wooden Crates',
    packagingType: 'drum',
    quantity: 40,
    totalWeightKg: 8200.0,
    totalCbm: 18.0,
    status: 'under_review',
    targetShipmentDate: '2026-11-15T00:00:00Z',
    createdAt: '2026-10-24T09:15:00Z',
    updatedAt: '2026-10-24T09:15:00Z',
    revisions: []
  }
];

export class QuoteService {
  static async listQuotes(params?: { customerId?: string; status?: string }): Promise<QuoteRecord[]> {
    let result = [...initialQuotes];
    if (params?.customerId) {
      result = result.filter((q) => q.customerId === params.customerId);
    }
    if (params?.status && params.status !== 'all') {
      result = result.filter((q) => q.status === params.status);
    }
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  static async getById(quoteIdOrNumber: string): Promise<QuoteRecord | null> {
    const q = initialQuotes.find(
      (item) => item.id === quoteIdOrNumber || item.quoteNumber.toUpperCase() === quoteIdOrNumber.toUpperCase()
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
    cargoDescription: string;
    packagingType?: string;
    quantity?: number;
    totalWeightKg: number;
    totalCbm: number;
    targetShipmentDate?: string;
  }): Promise<QuoteRecord> {
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

    initialQuotes.unshift(newQuote);
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
    const quote = initialQuotes.find((q) => q.id === quoteId);
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
      transitTimeDays: revision.transitTimeDays || '3-7 days',
      notes: revision.notes,
      createdAt: new Date().toISOString()
    };

    quote.revisions.unshift(revObj);
    quote.status = 'priced';
    quote.validityDate = revObj.validityDate;
    if (revision.staffName) quote.assignedStaffName = revision.staffName;
    quote.updatedAt = new Date().toISOString();

    return quote;
  }

  static async convertQuoteToShipment(quoteId: string): Promise<{ quote: QuoteRecord; shipmentId: string } | null> {
    const quote = initialQuotes.find((q) => q.id === quoteId);
    if (!quote) return null;

    const newShipment = await ShipmentService.createShipment({
      customerId: quote.customerId || 'guest-customer',
      customerName: quote.guestName,
      originCountry: quote.originCountry,
      originCity: quote.originCity,
      destCountry: quote.destCountry,
      destCity: quote.destCity,
      mode: quote.mode,
      serviceLevel: 'standard',
      totalWeightKg: quote.totalWeightKg,
      totalCbm: quote.totalCbm,
      totalPieces: quote.quantity,
      items: [
        {
          description: quote.cargoDescription,
          quantity: quote.quantity,
          packagingType: quote.packagingType,
          weightKg: quote.totalWeightKg,
          cbm: quote.totalCbm
        }
      ]
    });

    quote.status = 'converted_to_shipment';
    quote.convertedShipmentId = newShipment.id;
    quote.updatedAt = new Date().toISOString();

    return { quote, shipmentId: newShipment.id };
  }
}
