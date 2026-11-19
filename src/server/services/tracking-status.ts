/**
 * GoShipping — Standard Order Tracking Statuses & Progress Specification
 * 
 * Exact 9 status labels required:
 * 1. PURCHASED
 * 2. CN WAREHOUSE RECEIVED
 * 3. DISPATCHED FROM CHINA
 * 4. ARRIVED DHAKA AIRPORT
 * 5. AWAITING CUSTOMS CLEARANCE
 * 6. BD WAREHOUSE RECEIVED
 * 7. PAYMENT RECEIVED (Independent payment milestone)
 * 8. OUT FOR DELIVERY
 * 9. DELIVERED
 */

export type TrackingStatusCode =
  | 'purchased'
  | 'cn_warehouse_received'
  | 'dispatched_from_china'
  | 'arrived_dhaka_airport'
  | 'awaiting_customs'
  | 'bd_warehouse_received'
  | 'payment_received'
  | 'out_for_delivery'
  | 'delivered';

export interface StatusDefinition {
  code: TrackingStatusCode;
  label: string; // Exact uppercase label
  shortLabel: string;
  isPhysicalStage: boolean;
  physicalOrder?: number; // 1 to 8
  defaultDescription: string;
  defaultLocation: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconName: string;
}

export const TRACKING_STATUSES: Record<TrackingStatusCode, StatusDefinition> = {
  purchased: {
    code: 'purchased',
    label: 'PURCHASED CHINA WAREHOUSE',
    shortLabel: 'Purchased China Warehouse',
    isPhysicalStage: true,
    physicalOrder: 1,
    defaultDescription: 'Goods purchased from supplier and assigned to consolidation manifest.',
    defaultLocation: 'China Supplier / Merchant',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-300',
    iconName: 'shopping-cart'
  },
  cn_warehouse_received: {
    code: 'cn_warehouse_received',
    label: 'CN WAREHOUSE RECEIVED',
    shortLabel: 'CN Received',
    isPhysicalStage: true,
    physicalOrder: 2,
    defaultDescription: 'Cargo received, weighed, measured, and palletized at China receiving hub.',
    defaultLocation: 'Guangzhou / Yiwu Receiving Hub, China',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-200',
    iconName: 'warehouse'
  },
  dispatched_from_china: {
    code: 'dispatched_from_china',
    label: 'DISPATCHED FROM CHINA',
    shortLabel: 'Dispatched CN',
    isPhysicalStage: true,
    physicalOrder: 3,
    defaultDescription: 'Export customs cleared and departed origin hub via international linehaul carrier.',
    defaultLocation: 'Guangzhou Baiyun Airport / Shenzhen Maritime Port',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-200',
    iconName: 'plane-takeoff'
  },
  arrived_dhaka_airport: {
    code: 'arrived_dhaka_airport',
    label: 'ARRIVED DHAKA AIRPORT',
    shortLabel: 'Arrived HSIA',
    isPhysicalStage: true,
    physicalOrder: 4,
    defaultDescription: 'Carrier touched down at Dhaka Hazrat Shahjalal International Airport (HSIA) Cargo Village.',
    defaultLocation: 'HSIA Cargo Village, Dhaka, Bangladesh',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    iconName: 'plane-landing'
  },
  awaiting_customs: {
    code: 'awaiting_customs',
    label: 'AWAITING CUSTOMS CLEARANCE',
    shortLabel: 'Customs Clearance',
    isPhysicalStage: true,
    physicalOrder: 5,
    defaultDescription: 'Bill of Entry submitted to NBR. Undergoing customs appraisal, valuation, and duty assessment.',
    defaultLocation: 'Dhaka Custom House, HSIA / Chittagong Port Authority',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    iconName: 'shield-check'
  },
  bd_warehouse_received: {
    code: 'bd_warehouse_received',
    label: 'BD WAREHOUSE RECEIVED',
    shortLabel: 'BD Received',
    isPhysicalStage: true,
    physicalOrder: 6,
    defaultDescription: 'Released from bonded customs and securely received at GoShipping Dhaka sorting terminal.',
    defaultLocation: 'GoShipping Central Sorting Hub, Uttara / Tejgaon, Dhaka',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-800',
    badgeBorder: 'border-sky-200',
    iconName: 'building-warehouse'
  },
  payment_received: {
    code: 'payment_received',
    label: 'PAYMENT RECEIVED',
    shortLabel: 'Paid',
    isPhysicalStage: false, // CRITICAL: Independent payment milestone
    defaultDescription: 'Freight tariffs, duty reimbursements, and local handling fees cleared in full.',
    defaultLocation: 'GoShipping Corporate Finance & Billing Desk',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    iconName: 'credit-card'
  },
  out_for_delivery: {
    code: 'out_for_delivery',
    label: 'OUT FOR DELIVERY',
    shortLabel: 'Out for Delivery',
    isPhysicalStage: true,
    physicalOrder: 7,
    defaultDescription: 'Assigned to GoShipping dedicated last-mile transport fleet for direct recipient delivery.',
    defaultLocation: 'Dhaka Metropolitan Urban Dispatch Unit',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-200',
    iconName: 'truck'
  },
  delivered: {
    code: 'delivered',
    label: 'DELIVERED',
    shortLabel: 'Delivered',
    isPhysicalStage: true,
    physicalOrder: 8,
    defaultDescription: 'Consignment successfully handed over and signed with recipient proof-of-delivery (POD).',
    defaultLocation: 'Consignee Verified Delivery Address, Bangladesh',
    badgeBg: 'bg-green-50',
    badgeText: 'text-green-800',
    badgeBorder: 'border-green-200',
    iconName: 'check-circle'
  }
};

/**
 * The 8 sequential physical stages for progress calculation
 */
export const PHYSICAL_STAGES: TrackingStatusCode[] = [
  'purchased',
  'cn_warehouse_received',
  'dispatched_from_china',
  'arrived_dhaka_airport',
  'awaiting_customs',
  'bd_warehouse_received',
  'out_for_delivery',
  'delivered'
];

/**
 * Calculate physical stage progress (0 to 100%) from current shipment status
 */
export function calculatePhysicalProgress(
  currentStatus: TrackingStatusCode | string,
  events: Array<{ status: string; statusCode?: string }>
): {
  completedStagesCount: number;
  totalStagesCount: number;
  percentage: number;
  currentPhysicalStageIndex: number;
  isComplete: boolean;
} {
  const totalStagesCount = PHYSICAL_STAGES.length; // 8
  const normalized = normalizeStatusCode(currentStatus);

  // Directly determine active physical stage index from current status
  let activeIndex = -1;
  if (normalized === 'payment_received') {
    // Payment received corresponds to Stage 6 (BD Warehouse Received) physically
    activeIndex = PHYSICAL_STAGES.indexOf('bd_warehouse_received');
  } else {
    activeIndex = PHYSICAL_STAGES.indexOf(normalized);
  }

  // Fallback if not found directly in PHYSICAL_STAGES
  if (activeIndex < 0) {
    for (let i = PHYSICAL_STAGES.length - 1; i >= 0; i--) {
      const stageCode = PHYSICAL_STAGES[i];
      if (events && events.some(e => (e.statusCode || e.status).toLowerCase() === stageCode)) {
        activeIndex = i;
        break;
      }
    }
  }

  const finalIndex = activeIndex >= 0 ? activeIndex : 0;
  const completedCount = finalIndex + 1;
  const percentage = Math.round((completedCount / totalStagesCount) * 100);
  const isComplete = finalIndex === totalStagesCount - 1;

  return {
    completedStagesCount: completedCount,
    totalStagesCount,
    percentage: Math.min(percentage, 100),
    currentPhysicalStageIndex: finalIndex,
    isComplete
  };
}

/**
 * Normalize any legacy status string to an official 9-status code
 */
export function normalizeStatusCode(input: string | undefined): TrackingStatusCode {
  if (!input) return 'purchased';
  const clean = input.toLowerCase().trim().replace(/[\s-]+/g, '_');

  if (clean in TRACKING_STATUSES) {
    return clean as TrackingStatusCode;
  }

  // 1. Delivered / Completed
  if (clean.includes('delivered') || clean.includes('completed') || clean.includes('pod_received')) {
    return 'delivered';
  }

  // 2. Out for delivery / Courier dispatch
  if (clean.includes('out_for_delivery') || clean.includes('courier') || clean.includes('last_mile') || clean.includes('dispatch_unit')) {
    return 'out_for_delivery';
  }

  // 3. Payment received
  if (clean.includes('payment_received') || clean === 'paid') {
    return 'payment_received';
  }

  // 4. BD Warehouse / Dhaka Sorting Hub
  if (
    clean.includes('bd_warehouse') ||
    clean.includes('bd_hub') ||
    clean.includes('dhaka_warehouse') ||
    clean.includes('sorting_hub') ||
    clean.includes('received_in_bd')
  ) {
    return 'bd_warehouse_received';
  }

  // 5. Customs Clearance / HSIA / Awaiting Customs / Port Inspection
  if (
    clean.includes('customs') ||
    clean.includes('clearance') ||
    clean.includes('appraisal') ||
    clean.includes('exception')
  ) {
    return 'awaiting_customs';
  }

  // 6. Arrived Airport / DAC / Flight Touchdown
  if (
    clean.includes('arrived') &&
    (clean.includes('airport') || clean.includes('dac') || clean.includes('hsia') || clean.includes('dhaka'))
  ) {
    return 'arrived_dhaka_airport';
  }

  // 7. Dispatched from China / In Transit / International Freight / Cargo Flight
  if (
    clean.includes('dispatched') ||
    clean.includes('in_transit') ||
    clean.includes('flight') ||
    clean.includes('vessel') ||
    clean.includes('shipped') ||
    clean.includes('linehaul')
  ) {
    return 'dispatched_from_china';
  }

  // 8. CN Warehouse Received / China Hub
  if (
    clean.includes('cn_warehouse') ||
    clean.includes('cn_hub') ||
    clean.includes('received_in_cn') ||
    clean.includes('guangzhou_hub') ||
    clean.includes('warehouse_received') ||
    clean.includes('cn_received')
  ) {
    return 'cn_warehouse_received';
  }

  // 9. Purchased / Processing / Order Created
  if (
    clean.includes('purchased') ||
    clean.includes('processing') ||
    clean.includes('order_created') ||
    clean.includes('pending') ||
    clean.includes('booked')
  ) {
    return 'purchased';
  }

  return 'purchased';
}
