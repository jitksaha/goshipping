import { ShipmentService, ShipmentRecord, ShipmentItem, ShipmentEvent } from './shipment.service';
import { TrackingStatusCode, TRACKING_STATUSES } from './tracking-status';
import { formatBstDateTime } from '../utils/date';

export interface PublicTrackingResponse {
  trackingNumber: string;
  productName: string;
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
  serviceLevel: string;
  status: TrackingStatusCode;
  statusCode: TrackingStatusCode;
  statusLabel: string;
  paymentStatus: 'pending' | 'payment_received';
  eventVersion: number;
  currentLocation: string;
  hasLiveGps: boolean;
  currentLat?: number;
  currentLng?: number;
  carrierName: string;
  voyageOrFlightNumber: string;
  billOfLadingNumber: string;
  departureTime: string;
  totalPieces: number;
  totalWeightKg: number;
  totalCbm: number;
  estimatedDelivery: string;
  actualDelivery?: string;
  recipientName: string;
  recipientAddress: string;
  items: ShipmentItem[];
  updatedAt: string;
  lastUpdatedBst: string;
  lastHash: string;
  physicalProgress: {
    completedStagesCount: number;
    totalStagesCount: number;
    percentage: number;
    currentPhysicalStageIndex: number;
    isComplete: boolean;
  };
  events: Array<{
    id: string;
    status: string;
    statusCode: TrackingStatusCode;
    statusLabel: string;
    title: string;
    description: string;
    locationName: string;
    eventTime: string;
    occurredAtBst: string;
    hasGpsCoordinate: boolean;
    lat?: number;
    lng?: number;
    source: string;
    eventVersion: number;
  }>;
}

export interface MatchingShipmentSummary {
  trackingNumber: string;
  productName: string;
  status: TrackingStatusCode;
  statusCode: TrackingStatusCode;
  statusLabel: string;
  originCity: string;
  destCity: string;
  mode: 'air' | 'sea' | 'road' | 'hand_carry';
  totalWeightKg: number;
  totalPieces: number;
  createdAt: string;
  lastUpdatedBst: string;
}

export class TrackingService {
  /**
   * Unified public tracking lookup: search by tracking number, customer/recipient email, or phone.
   * Strictly sanitizes confidential customer info according to public tracking privacy rules.
   */
  static async searchPublicTracking(query: string, clientHash?: string): Promise<{
    modified: boolean;
    data: PublicTrackingResponse | null;
    matchingShipments: MatchingShipmentSummary[];
    totalFound: number;
    searchType: 'tracking_code' | 'email' | 'phone';
  }> {
    const { shipments, searchType } = await ShipmentService.searchShipmentsUnified(query);
    if (!shipments || shipments.length === 0) {
      return { modified: false, data: null, matchingShipments: [], totalFound: 0, searchType };
    }

    const primaryShipment = shipments[0];

    // Generate lightweight content hash for conditional 304/unchanged responses
    const latestEventId = primaryShipment.events[0]?.id || 'none';
    const contentHash = `${primaryShipment.status}-${primaryShipment.paymentStatus}-${primaryShipment.eventVersion}-${primaryShipment.updatedAt}-${latestEventId}`;

    if (clientHash && clientHash.replace(/"/g, '') === contentHash) {
      return {
        modified: false,
        data: null,
        matchingShipments: [],
        totalFound: shipments.length,
        searchType
      };
    }

    // GPS/map is only presented when verified coordinates exist from a capable carrier or warehouse
    const hasLiveGps = Boolean(primaryShipment.currentLat && primaryShipment.currentLng);

    const publicData: PublicTrackingResponse = {
      trackingNumber: primaryShipment.trackingNumber,
      productName: primaryShipment.productName || 'Commercial Cargo Consignment',
      originCountry: primaryShipment.originCountry,
      originCity: primaryShipment.originCity,
      originAddress: primaryShipment.originAddress,
      originLat: primaryShipment.originLat,
      originLng: primaryShipment.originLng,
      destCountry: primaryShipment.destCountry,
      destCity: primaryShipment.destCity,
      destAddress: primaryShipment.destAddress,
      destLat: primaryShipment.destLat,
      destLng: primaryShipment.destLng,
      mode: primaryShipment.mode,
      serviceLevel: primaryShipment.serviceLevel,
      status: primaryShipment.status,
      statusCode: primaryShipment.statusCode || primaryShipment.status,
      statusLabel: primaryShipment.statusLabel || TRACKING_STATUSES[primaryShipment.status]?.label || primaryShipment.status.toUpperCase(),
      paymentStatus: primaryShipment.paymentStatus || 'pending',
      eventVersion: primaryShipment.eventVersion || 1,
      currentLocation: primaryShipment.currentLocation,
      hasLiveGps,
      currentLat: hasLiveGps ? primaryShipment.currentLat : undefined,
      currentLng: hasLiveGps ? primaryShipment.currentLng : undefined,
      carrierName: primaryShipment.carrierName,
      voyageOrFlightNumber: primaryShipment.voyageOrFlightNumber,
      billOfLadingNumber: primaryShipment.billOfLadingNumber,
      departureTime: primaryShipment.departureTime,
      totalPieces: primaryShipment.totalPieces,
      totalWeightKg: primaryShipment.totalWeightKg,
      totalCbm: primaryShipment.totalCbm,
      estimatedDelivery: primaryShipment.estimatedDelivery,
      actualDelivery: primaryShipment.actualDelivery,
      recipientName: primaryShipment.recipientName,
      recipientAddress: primaryShipment.recipientAddress,
      items: primaryShipment.items,
      updatedAt: primaryShipment.updatedAt,
      lastUpdatedBst: primaryShipment.lastUpdatedBst || formatBstDateTime(primaryShipment.updatedAt),
      lastHash: contentHash,
      physicalProgress: primaryShipment.physicalProgress,
      events: primaryShipment.events.map((evt) => ({
        id: evt.id,
        status: evt.status,
        statusCode: evt.statusCode || (evt.status as TrackingStatusCode),
        statusLabel: evt.statusLabel || TRACKING_STATUSES[evt.status as TrackingStatusCode]?.label || evt.title,
        title: evt.title,
        description: evt.description,
        locationName: evt.locationName,
        eventTime: evt.eventTime,
        occurredAtBst: evt.occurredAtBst || formatBstDateTime(evt.eventTime),
        hasGpsCoordinate: Boolean(evt.lat && evt.lng),
        lat: evt.lat,
        lng: evt.lng,
        source: evt.source,
        eventVersion: evt.eventVersion || 1
      }))
    };

    const matchingShipments: MatchingShipmentSummary[] = shipments.map((s) => ({
      trackingNumber: s.trackingNumber,
      productName: s.productName,
      status: s.status,
      statusCode: s.statusCode || s.status,
      statusLabel: s.statusLabel || TRACKING_STATUSES[s.status]?.label || s.status.toUpperCase(),
      originCity: s.originCity,
      destCity: s.destCity,
      mode: s.mode,
      totalWeightKg: s.totalWeightKg,
      totalPieces: s.totalPieces,
      createdAt: s.createdAt,
      lastUpdatedBst: s.lastUpdatedBst || formatBstDateTime(s.updatedAt)
    }));

    return {
      modified: true,
      data: publicData,
      matchingShipments,
      totalFound: shipments.length,
      searchType
    };
  }

  /**
   * Legacy method for direct tracking number queries
   */
  static async getPublicTracking(trackingNumber: string, clientHash?: string): Promise<{
    modified: boolean;
    data: PublicTrackingResponse | null;
  }> {
    const res = await this.searchPublicTracking(trackingNumber, clientHash);
    return { modified: res.modified, data: res.data };
  }
}
