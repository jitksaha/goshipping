import { ShipmentService, ShipmentRecord } from './shipment.service';

export interface PublicTrackingResponse {
  trackingNumber: string;
  originCountry: string;
  originCity: string;
  destCountry: string;
  destCity: string;
  mode: 'air' | 'sea' | 'road';
  serviceLevel: string;
  status: ShipmentRecord['status'];
  currentLocation: string;
  hasLiveGps: boolean;
  currentLat?: number;
  currentLng?: number;
  totalPieces: number;
  estimatedDelivery: string;
  actualDelivery?: string;
  updatedAt: string;
  lastHash: string;
  events: Array<{
    id: string;
    status: string;
    title: string;
    description: string;
    locationName: string;
    eventTime: string;
    hasGpsCoordinate: boolean;
    lat?: number;
    lng?: number;
    source: string;
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
    const contentHash = `${shipment.status}-${shipment.updatedAt}-${latestEventId}`;

    if (clientHash && clientHash === contentHash) {
      return { modified: false, data: null };
    }

    // GPS/map is only presented when verified coordinates exist from a capable carrier or warehouse
    const hasLiveGps = Boolean(shipment.currentLat && shipment.currentLng);

    const publicData: PublicTrackingResponse = {
      trackingNumber: shipment.trackingNumber,
      originCountry: shipment.originCountry,
      originCity: shipment.originCity,
      destCountry: shipment.destCountry,
      destCity: shipment.destCity,
      mode: shipment.mode,
      serviceLevel: shipment.serviceLevel,
      status: shipment.status,
      currentLocation: shipment.currentLocation,
      hasLiveGps,
      currentLat: hasLiveGps ? shipment.currentLat : undefined,
      currentLng: hasLiveGps ? shipment.currentLng : undefined,
      totalPieces: shipment.totalPieces,
      estimatedDelivery: shipment.estimatedDelivery,
      actualDelivery: shipment.actualDelivery,
      updatedAt: shipment.updatedAt,
      lastHash: contentHash,
      events: shipment.events.map((evt) => ({
        id: evt.id,
        status: evt.status,
        title: evt.title,
        description: evt.description,
        locationName: evt.locationName,
        eventTime: evt.eventTime,
        hasGpsCoordinate: Boolean(evt.lat && evt.lng),
        lat: evt.lat,
        lng: evt.lng,
        source: evt.source
      }))
    };

    return { modified: true, data: publicData };
  }
}
