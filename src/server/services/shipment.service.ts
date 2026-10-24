import crypto from 'node:crypto';

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  description: string;
  quantity: number;
  packagingType: string;
  weightKg: number;
  cbm: number;
  declaredValue?: number;
  currency?: string;
}

export interface ShipmentEvent {
  id: string;
  shipmentId: string;
  status: string;
  title: string;
  description: string;
  locationName: string;
  eventTime: string;
  lat?: number;
  lng?: number;
  source: 'warehouse' | 'admin' | 'carrier_api';
}

export interface ShipmentRecord {
  id: string;
  trackingNumber: string;
  customerId: string;
  customerName: string;
  originCountry: string;
  originCity: string;
  destCountry: string;
  destCity: string;
  mode: 'air' | 'sea' | 'road';
  serviceLevel: 'standard' | 'express' | 'priority';
  status:
    | 'order_created'
    | 'warehouse_received'
    | 'in_transit'
    | 'customs_clearance'
    | 'out_for_delivery'
    | 'delivered'
    | 'exception';
  currentLocation: string;
  currentLat?: number;
  currentLng?: number;
  totalWeightKg: number;
  totalCbm: number;
  totalPieces: number;
  carrierName?: string;
  carrierWaybillNumber?: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  bookingReference?: string;
  items: ShipmentItem[];
  events: ShipmentEvent[];
  createdAt: string;
  updatedAt: string;
}

// In-memory operational store with realistic initial data
let initialShipments: ShipmentRecord[] = [
  {
    id: 'shp-9812-dac',
    trackingNumber: 'GOSH-2026-9812',
    customerId: 'usr-customer-01',
    customerName: 'Apex Textiles Ltd',
    originCountry: 'Bangladesh',
    originCity: 'Dhaka',
    destCountry: 'Germany',
    destCity: 'Frankfurt',
    mode: 'air',
    serviceLevel: 'express',
    status: 'in_transit',
    currentLocation: 'Dubai Cargo Terminal (DXB)',
    currentLat: 25.2532,
    currentLng: 55.3657,
    totalWeightKg: 850.5,
    totalCbm: 4.25,
    totalPieces: 42,
    carrierName: 'Emirates SkyCargo',
    carrierWaybillNumber: 'EK-176-92819382',
    estimatedDelivery: '2026-10-27T14:00:00Z',
    createdAt: '2026-10-22T08:30:00Z',
    updatedAt: '2026-10-24T18:15:00Z',
    items: [
      {
        id: 'itm-01',
        shipmentId: 'shp-9812-dac',
        description: 'Premium Knitwear & Cotton Garments',
        quantity: 42,
        packagingType: 'carton',
        weightKg: 850.5,
        cbm: 4.25,
        declaredValue: 24500,
        currency: 'USD'
      }
    ],
    events: [
      {
        id: 'evt-01',
        shipmentId: 'shp-9812-dac',
        status: 'order_created',
        title: 'Airway Bill Issued & Booking Confirmed',
        description: 'Shipment booking validated with automated export customs manifest.',
        locationName: 'GoShipping Hub, Dhaka (DAC-HUB)',
        eventTime: '2026-10-22T08:30:00Z',
        lat: 23.8511,
        lng: 90.4072,
        source: 'admin'
      },
      {
        id: 'evt-02',
        shipmentId: 'shp-9812-dac',
        status: 'warehouse_received',
        title: 'Consignment Received & Weighed at Warehouse',
        description: 'Cargo received in 42 security-sealed cartons. Gross weight: 850.50 KG.',
        locationName: 'GoShipping Central Hub, Uttara, Dhaka',
        eventTime: '2026-10-22T14:15:00Z',
        lat: 23.8759,
        lng: 90.3795,
        source: 'warehouse'
      },
      {
        id: 'evt-03',
        shipmentId: 'shp-9812-dac',
        status: 'customs_clearance',
        title: 'Export Customs Cleared at Hazrat Shahjalal Int Airport',
        description: 'All inspection declarations and export commercial invoices validated.',
        locationName: 'Dhaka Airport Customs (HSIA)',
        eventTime: '2026-10-23T11:00:00Z',
        lat: 23.8433,
        lng: 90.4029,
        source: 'warehouse'
      },
      {
        id: 'evt-04',
        shipmentId: 'shp-9812-dac',
        status: 'in_transit',
        title: 'Cargo In-Transit via DXB Connecting Flight',
        description: 'Flight EK583 arrived at Dubai SkyCargo Hub. Transfer to connecting flight EK047 to Frankfurt in progress.',
        locationName: 'Dubai Cargo Terminal (DXB)',
        eventTime: '2026-10-24T17:40:00Z',
        lat: 25.2532,
        lng: 55.3657,
        source: 'carrier_api'
      }
    ]
  },
  {
    id: 'shp-4411-ctg',
    trackingNumber: 'GOSH-2026-4411',
    customerId: 'usr-customer-01',
    customerName: 'Apex Textiles Ltd',
    originCountry: 'China',
    originCity: 'Guangzhou',
    destCountry: 'Bangladesh',
    destCity: 'Chittagong',
    mode: 'sea',
    serviceLevel: 'standard',
    status: 'customs_clearance',
    currentLocation: 'Chittagong Port Terminal (CTG)',
    currentLat: 22.3193,
    currentLng: 91.8105,
    totalWeightKg: 14200.0,
    totalCbm: 38.5,
    totalPieces: 120,
    carrierName: 'Maersk Line',
    carrierWaybillNumber: 'MSK-928471928',
    estimatedDelivery: '2026-10-28T16:00:00Z',
    createdAt: '2026-10-10T09:00:00Z',
    updatedAt: '2026-10-24T12:00:00Z',
    items: [
      {
        id: 'itm-02',
        shipmentId: 'shp-4411-ctg',
        description: 'Raw Synthetic Yarn & Fabric Roll Assortment',
        quantity: 120,
        packagingType: 'pallet',
        weightKg: 14200.0,
        cbm: 38.5,
        declaredValue: 68000,
        currency: 'USD'
      }
    ],
    events: [
      {
        id: 'evt-11',
        shipmentId: 'shp-4411-ctg',
        status: 'warehouse_received',
        title: 'Container Loaded at Nansha Port, Guangzhou',
        description: 'Full container load sealed and boarded vessel MSC CLARA.',
        locationName: 'Nansha Port, Guangzhou',
        eventTime: '2026-10-11T10:00:00Z',
        source: 'carrier_api'
      },
      {
        id: 'evt-12',
        shipmentId: 'shp-4411-ctg',
        status: 'in_transit',
        title: 'Vessel Departed South China Sea',
        description: 'Maritime navigation on schedule towards Chittagong Port anchorage.',
        locationName: 'Strait of Malacca Transit',
        eventTime: '2026-10-18T16:00:00Z',
        source: 'carrier_api'
      },
      {
        id: 'evt-13',
        shipmentId: 'shp-4411-ctg',
        status: 'customs_clearance',
        title: 'Berthing & Import Customs Processing',
        description: 'Container discharged from vessel. Bill of entry filed with Chittagong Customs House.',
        locationName: 'Chittagong Port Terminal (CTG)',
        eventTime: '2026-10-24T10:30:00Z',
        lat: 22.3193,
        lng: 91.8105,
        source: 'warehouse'
      }
    ]
  }
];

export class ShipmentService {
  /**
   * Get all shipments with filtering & search
   */
  static async listShipments(params?: {
    customerId?: string;
    status?: string;
    mode?: string;
    query?: string;
  }): Promise<ShipmentRecord[]> {
    let results = [...initialShipments];

    if (params?.customerId) {
      results = results.filter((s) => s.customerId === params.customerId);
    }
    if (params?.status && params.status !== 'all') {
      results = results.filter((s) => s.status === params.status);
    }
    if (params?.mode && params.mode !== 'all') {
      results = results.filter((s) => s.mode === params.mode);
    }
    if (params?.query) {
      const q = params.query.toLowerCase().trim();
      results = results.filter(
        (s) =>
          s.trackingNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.originCity.toLowerCase().includes(q) ||
          s.destCity.toLowerCase().includes(q) ||
          (s.carrierWaybillNumber && s.carrierWaybillNumber.toLowerCase().includes(q))
      );
    }

    return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Get single shipment by ID or Tracking number
   */
  static async getByTrackingNumber(trackingNumber: string): Promise<ShipmentRecord | null> {
    const formatted = trackingNumber.trim().toUpperCase();
    const found = initialShipments.find(
      (s) => s.trackingNumber.toUpperCase() === formatted || s.id === formatted
    );
    return found || null;
  }

  /**
   * Create a new shipment
   */
  static async createShipment(data: {
    customerId: string;
    customerName: string;
    originCountry: string;
    originCity: string;
    destCountry: string;
    destCity: string;
    mode: 'air' | 'sea' | 'road';
    serviceLevel: 'standard' | 'express' | 'priority';
    totalWeightKg: number;
    totalCbm: number;
    totalPieces: number;
    items?: Omit<ShipmentItem, 'id' | 'shipmentId'>[];
    estimatedDelivery?: string;
    carrierName?: string;
  }): Promise<ShipmentRecord> {
    const id = `shp-${Date.now().toString(36)}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingNumber = `GOSH-${new Date().getFullYear()}-${randomSuffix}`;
    const now = new Date().toISOString();

    const newShipment: ShipmentRecord = {
      id,
      trackingNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      originCountry: data.originCountry,
      originCity: data.originCity,
      destCountry: data.destCountry,
      destCity: data.destCity,
      mode: data.mode,
      serviceLevel: data.serviceLevel,
      status: 'order_created',
      currentLocation: `${data.originCity} Hub`,
      totalWeightKg: data.totalWeightKg,
      totalCbm: data.totalCbm,
      totalPieces: data.totalPieces,
      carrierName: data.carrierName || 'GoShipping Express Lines',
      estimatedDelivery: data.estimatedDelivery || new Date(Date.now() + 5 * 86400000).toISOString(),
      createdAt: now,
      updatedAt: now,
      items: (data.items || []).map((it, idx) => ({
        id: `itm-${id}-${idx}`,
        shipmentId: id,
        ...it
      })),
      events: [
        {
          id: `evt-${id}-init`,
          shipmentId: id,
          status: 'order_created',
          title: 'Shipment Created and Booked',
          description: `Consignment booked from ${data.originCity}, ${data.originCountry} to ${data.destCity}, ${data.destCountry}.`,
          locationName: `${data.originCity} Operations Hub`,
          eventTime: now,
          source: 'admin'
        }
      ]
    };

    initialShipments.unshift(newShipment);
    return newShipment;
  }

  /**
   * Add verified tracking event
   */
  static async addEvent(
    shipmentId: string,
    eventData: {
      status: ShipmentRecord['status'];
      title: string;
      description: string;
      locationName: string;
      lat?: number;
      lng?: number;
      source?: 'warehouse' | 'admin' | 'carrier_api';
    }
  ): Promise<ShipmentRecord | null> {
    const shipment = initialShipments.find((s) => s.id === shipmentId || s.trackingNumber === shipmentId);
    if (!shipment) return null;

    const now = new Date().toISOString();
    const newEvent: ShipmentEvent = {
      id: `evt-${crypto.randomBytes(4).toString('hex')}`,
      shipmentId: shipment.id,
      status: eventData.status,
      title: eventData.title,
      description: eventData.description,
      locationName: eventData.locationName,
      lat: eventData.lat,
      lng: eventData.lng,
      eventTime: now,
      source: eventData.source || 'warehouse'
    };

    shipment.events.unshift(newEvent);
    shipment.status = eventData.status;
    shipment.currentLocation = eventData.locationName;
    if (eventData.lat) shipment.currentLat = eventData.lat;
    if (eventData.lng) shipment.currentLng = eventData.lng;
    shipment.updatedAt = now;

    return shipment;
  }
}
