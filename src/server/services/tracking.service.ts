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

export class TrackingService {
  /**
   * Public tracking lookup: strictly sanitizes confidential customer info
   */
  static async getPublicTracking(trackingNumber: string, clientHash?: string): Promise<{
    modified: boolean;
    data: PublicTrackingResponse | null;
  }> {
    const shipment = await ShipmentService.getByTrackingNumber(trackingNumber);
    if (!shipment) {
      return { modified: false, data: null };
    }

    // Generate lightweight content hash for conditional 304/unchanged responses
    const latestEventId = shipment.events[0]?.id || 'none';
    const contentHash = `${shipment.status}-${shipment.paymentStatus}-${shipment.eventVersion}-${shipment.updatedAt}-${latestEventId}`;

    if (clientHash && clientHash.replace(/"/g, '') === contentHash) {
      return { modified: false, data: null };
    }

    // GPS/map is only presented when verified coordinates exist from a capable carrier or warehouse
    const hasLiveGps = Boolean(shipment.currentLat && shipment.currentLng);

    const publicData: PublicTrackingResponse = {
      trackingNumber: shipment.trackingNumber,
      productName: shipment.productName || 'Commercial Cargo Consignment',
      originCountry: shipment.originCountry,
      originCity: shipment.originCity,
      originAddress: shipment.originAddress,
      originLat: shipment.originLat,
      originLng: shipment.originLng,
      destCountry: shipment.destCountry,
      destCity: shipment.destCity,
      destAddress: shipment.destAddress,
      destLat: shipment.destLat,
      destLng: shipment.destLng,
      mode: shipment.mode,
      serviceLevel: shipment.serviceLevel,
      status: shipment.status,
      statusCode: shipment.statusCode || shipment.status,
      statusLabel: shipment.statusLabel || TRACKING_STATUSES[shipment.status]?.label || shipment.status.toUpperCase(),
      paymentStatus: shipment.paymentStatus || 'pending',
      eventVersion: shipment.eventVersion || 1,
      currentLocation: shipment.currentLocation,
      hasLiveGps,
      currentLat: hasLiveGps ? shipment.currentLat : undefined,
      currentLng: hasLiveGps ? shipment.currentLng : undefined,
      carrierName: shipment.carrierName,
      voyageOrFlightNumber: shipment.voyageOrFlightNumber,
      billOfLadingNumber: shipment.billOfLadingNumber,
      departureTime: shipment.departureTime,
      totalPieces: shipment.totalPieces,
      totalWeightKg: shipment.totalWeightKg,
      totalCbm: shipment.totalCbm,
      estimatedDelivery: shipment.estimatedDelivery,
      actualDelivery: shipment.actualDelivery,
      recipientName: shipment.recipientName,
      recipientAddress: shipment.recipientAddress,
      items: shipment.items,
      updatedAt: shipment.updatedAt,
      lastUpdatedBst: shipment.lastUpdatedBst || formatBstDateTime(shipment.updatedAt),
      lastHash: contentHash,
      physicalProgress: shipment.physicalProgress,
      events: shipment.events.map((evt) => ({
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

    return { modified: true, data: publicData };
  }
}
