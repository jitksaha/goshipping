import crypto from 'node:crypto';
import EventEmitter from 'node:events';

export interface RealtimeTrackingPayload {
  trackingNumber: string;
  shipmentId: string;
  status: string;
  statusCode: string;
  statusLabel: string;
  paymentStatus: 'pending' | 'paid' | 'payment_received';
  version: number;
  updatedAt: string;
  latestEvent?: {
    id: string;
    statusCode: string;
    statusLabel: string;
    title: string;
    description: string;
    locationName: string;
    eventTime: string;
  };
}

class RealtimeBus extends EventEmitter {}
const localBus = new RealtimeBus();

export class RealtimeService {
  /**
   * Determine available realtime provider
   */
  static getProvider(): 'pusher' | 'ably' | 'polling' {
    if (process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_APP_ID) {
      return 'pusher';
    }
    if (process.env.ABLY_API_KEY) {
      return 'ably';
    }
    return 'polling';
  }

  /**
   * Safe public configuration for client tracking islands (ZERO secrets leaked)
   */
  static getClientConfig() {
    const provider = this.getProvider();
    return {
      provider,
      pusherKey: provider === 'pusher' ? process.env.PUSHER_KEY : undefined,
      pusherCluster: provider === 'pusher' ? process.env.PUSHER_CLUSTER || 'ap1' : undefined,
      ablyKey: provider === 'ably' ? (process.env.ABLY_API_KEY ? process.env.ABLY_API_KEY.split(':')[0] : undefined) : undefined,
      pollIntervalMs: Number(process.env.TRACKING_POLL_INTERVAL_MS) || 3000,
      backgroundPollPause: process.env.BACKGROUND_POLL_PAUSE !== 'false'
    };
  }

  /**
   * Broadcast status update to all connected channels and local listeners
   */
  static async broadcastShipmentUpdate(payload: RealtimeTrackingPayload): Promise<void> {
    // 1. Emit locally for SSE / in-process consumers
    localBus.emit(`tracking:${payload.trackingNumber}`, payload);
    localBus.emit('shipment:updated', payload);

    // 2. Broadcast via Pusher REST API if configured
    if (process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_APP_ID) {
      try {
        await this.publishToPusher({
          channel: `tracking-${payload.trackingNumber}`,
          event: 'status-updated',
          data: payload
        });
        // Also publish to general staff operations channel
        await this.publishToPusher({
          channel: 'admin-shipments',
          event: 'status-updated',
          data: payload
        });
      } catch (err: any) {
        console.warn('[RealtimeService] Pusher publish error (fallback active):', err.message);
      }
    }
  }

  /**
   * Native HTTP Pusher event dispatch (zero extra npm packages required)
   */
  private static async publishToPusher({
    channel,
    event,
    data
  }: {
    channel: string;
    event: string;
    data: any;
  }): Promise<void> {
    const appId = process.env.PUSHER_APP_ID!;
    const key = process.env.PUSHER_KEY!;
    const secret = process.env.PUSHER_SECRET!;
    const cluster = process.env.PUSHER_CLUSTER || 'ap1';

    const path = `/apps/${appId}/events`;
    const bodyStr = JSON.stringify({
      name: event,
      channel,
      data: JSON.stringify(data)
    });

    const bodyMd5 = crypto.createHash('md5').update(bodyStr).digest('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const queryString = `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
    const stringToSign = `POST\n${path}\n${queryString}`;
    const authSignature = crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');

    const url = `https://api-${cluster}.pusher.com${path}?${queryString}&auth_signature=${authSignature}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pusher HTTP ${res.status}: ${errText}`);
    }
  }

  /**
   * Subscribe to local tracking updates (for SSE streams)
   */
  static subscribeToLocalTracking(trackingNumber: string, callback: (payload: RealtimeTrackingPayload) => void) {
    const eventName = `tracking:${trackingNumber}`;
    localBus.on(eventName, callback);
    return () => {
      localBus.off(eventName, callback);
    };
  }
}
