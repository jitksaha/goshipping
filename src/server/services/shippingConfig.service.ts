export interface ShippingModeConfig {
  id: 'air' | 'sea' | 'hand_carry';
  label: string;
  badge: string;
  minDays: number;
  maxDays: number;
  active: boolean;
}

export interface FulfillmentOptionConfig {
  id: 'doorstep' | 'courier' | 'pickup';
  label: string;
  badge: string;
  availableCities: string[];
}

export interface DestinationCountryConfig {
  country: string;
  code: string;
  flag: string;
  active: boolean;
  fulfillmentOptions: FulfillmentOptionConfig[];
}

export interface ShippingConfigData {
  modes: ShippingModeConfig[];
  destinations: DestinationCountryConfig[];
}

let activeShippingConfig: ShippingConfigData = {
  modes: [
    {
      id: 'air',
      label: 'By Air',
      badge: '7–14 Days',
      minDays: 7,
      maxDays: 14,
      active: true
    },
    {
      id: 'sea',
      label: 'By Ship',
      badge: '30–45 Days',
      minDays: 30,
      maxDays: 45,
      active: true
    },
    {
      id: 'hand_carry',
      label: 'Hand Carry',
      badge: '24–48 Hours',
      minDays: 1,
      maxDays: 2,
      active: true
    }
  ],
  destinations: [
    {
      country: 'Bangladesh',
      code: 'BD',
      flag: '🇧🇩',
      active: true,
      fulfillmentOptions: [
        {
          id: 'doorstep',
          label: 'Doorstep Delivery',
          badge: 'Dhaka & Chittagong',
          availableCities: ['Dhaka', 'Chittagong']
        },
        {
          id: 'courier',
          label: 'Courier Delivery',
          badge: 'All over Bangladesh',
          availableCities: [
            'Dhaka',
            'Chittagong',
            'Gazipur',
            'Narayanganj',
            'Savar',
            'Keraniganj',
            'Sylhet',
            'Rajshahi',
            'Khulna',
            'Barisal',
            'Rangpur',
            'Mymensingh',
            'Bogra',
            'Comilla',
            'Cox\'s Bazar',
            'Feni',
            'Brahmanbaria',
            'Tangail',
            'Narsingdi',
            'Manikganj',
            'Munshiganj',
            'Faridpur',
            'Jessore',
            'Kushtia',
            'Dinajpur',
            'Saidpur',
            'Pabna',
            'Sirajganj',
            'Naogaon',
            'Natore',
            'Joypurhat',
            'Satkhira',
            'Jhenaidah',
            'Bagerhat (Mongla)',
            'Patuakhali',
            'Bhola',
            'Kurigram',
            'Gaibandha',
            'Jamalpur',
            'Netrokona',
            'Sherpur',
            'Moulvibazar',
            'Habiganj',
            'Sunamganj'
          ]
        },
        {
          id: 'pickup',
          label: 'Pickup Options',
          badge: 'Warehouse / Depot Self-Pickup',
          availableCities: [
            'Dhaka Central Hub (43/31, Sabujkanon, Dhaka-1214)',
            'Chittagong Seaport CFS Depot (Agrabad Seaport Zone)'
          ]
        }
      ]
    },
    {
      country: 'Malaysia',
      code: 'MY',
      flag: '🇲🇾',
      active: true,
      fulfillmentOptions: [
        {
          id: 'courier',
          label: 'Courier Delivery',
          badge: 'All over Malaysia',
          availableCities: [
            'Selangor',
            'Kuala Lumpur',
            'Johor',
            'Penang (Pulau Pinang)',
            'Perak',
            'Kedah',
            'Melaka',
            'Negeri Sembilan',
            'Pahang',
            'Sabah',
            'Sarawak',
            'Terengganu',
            'Kelantan',
            'Putrajaya'
          ]
        },
        {
          id: 'pickup',
          label: 'Pickup Options',
          badge: 'Warehouse Self-Pickup',
          availableCities: [
            'Selangor Receiving Hub (Lot 2720-B, Sg Buloh, Selangor)'
          ]
        }
      ]
    }
  ]
};

export class ShippingConfigService {
  static async getConfig(): Promise<ShippingConfigData> {
    return { ...activeShippingConfig };
  }

  static async updateConfig(newConfig: Partial<ShippingConfigData>): Promise<ShippingConfigData> {
    if (newConfig.modes) {
      activeShippingConfig.modes = newConfig.modes;
    }
    if (newConfig.destinations) {
      activeShippingConfig.destinations = newConfig.destinations;
    }
    return { ...activeShippingConfig };
  }

  static async toggleMode(id: 'air' | 'sea' | 'hand_carry', active: boolean): Promise<ShippingModeConfig | null> {
    const mode = activeShippingConfig.modes.find((m) => m.id === id);
    if (!mode) return null;
    mode.active = active;
    return mode;
  }

  static async getDestination(country: string): Promise<DestinationCountryConfig | null> {
    return (
      activeShippingConfig.destinations.find(
        (d) => d.country.toLowerCase() === country.toLowerCase()
      ) || null
    );
  }
}
