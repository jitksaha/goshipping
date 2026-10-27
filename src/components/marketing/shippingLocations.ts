export interface ShippingModeOption {
  id: 'air' | 'sea' | 'hand_carry';
  label: string;
  badge: string;
  minDays: number;
  maxDays: number;
}

export const DEFAULT_SHIPPING_MODES: ShippingModeOption[] = [
  { id: 'air', label: 'By Air', badge: '7–14 Days', minDays: 7, maxDays: 14 },
  { id: 'sea', label: 'By Ship', badge: '30–45 Days', minDays: 30, maxDays: 45 },
  { id: 'hand_carry', label: 'Hand Carry', badge: '24–48 Hours', minDays: 1, maxDays: 2 }
];

export interface DynamicFulfillmentOption {
  id: 'doorstep' | 'courier' | 'pickup';
  label: string;
  badge: string;
  cities: string[];
}

export interface DynamicCountryFulfillment {
  country: string;
  flag: string;
  code: string;
  options: DynamicFulfillmentOption[];
}

export const DYNAMIC_FULFILLMENT_BY_COUNTRY: Record<string, DynamicCountryFulfillment> = {
  Bangladesh: {
    country: 'Bangladesh',
    flag: '🇧🇩',
    code: 'BD',
    options: [
      {
        id: 'doorstep',
        label: 'Doorstep Delivery',
        badge: 'Dhaka & Chittagong',
        cities: ['Dhaka', 'Chittagong']
      },
      {
        id: 'courier',
        label: 'Courier Delivery',
        badge: 'All over Bangladesh',
        cities: [
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
        cities: [
          'Dhaka Central Hub (43/31, Sabujkanon, Dhaka-1214)',
          'Chittagong Seaport CFS Depot (Agrabad Seaport Zone)'
        ]
      }
    ]
  },
  Malaysia: {
    country: 'Malaysia',
    flag: '🇲🇾',
    code: 'MY',
    options: [
      {
        id: 'courier',
        label: 'Courier Delivery',
        badge: 'All over Malaysia',
        cities: [
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
        cities: [
          'Selangor Receiving Hub (Lot 2720-B, Sg Buloh, Selangor)'
        ]
      }
    ]
  }
};

export interface LocationHub {
  city: string;
  code?: string;
  badge: 'WAREHOUSE' | 'AIR HUB' | 'SEA PORT' | 'DOOR DELIVERY' | 'EPZ' | 'LAND PORT';
  description?: string;
}

export interface CountryData {
  country: string;
  code: string;
  flag?: string;
  popular?: boolean;
  hubs: LocationHub[];
}

export const ORIGIN_COUNTRIES: CountryData[] = [
  {
    country: 'China',
    code: 'CN',
    flag: '🇨🇳',
    popular: true,
    hubs: [
      {
        city: 'Guangzhou',
        code: 'CAN',
        badge: 'WAREHOUSE',
        description: '765, Sanyuanli Avenue, Baiyun District, Guangzhou'
      },
      {
        city: 'Yiwu',
        code: 'YIW',
        badge: 'WAREHOUSE',
        description: 'Chouzhou North Road, International Trade City Zone 4, Yiwu, Zhejiang'
      },
      {
        city: 'Shenzhen',
        code: 'SZX',
        badge: 'AIR HUB',
        description: 'Baoan Airport Logistics Park & Qianhai Port CFS, Shenzhen'
      }
    ]
  }
];

export const CHINA_ORIGIN_HUB = {
  country: 'China',
  city: 'Guangzhou',
  code: 'CAN',
  address: '765, Sanyuanli Avenue, Baiyun District, Guangzhou',
  chineseAddress: '广州市白云区三元里大道765号'
};

export const BANGLADESH_PICKUP_HUB = {
  country: 'Bangladesh',
  city: 'Dhaka',
  code: 'DAC',
  address: '43/31, Sabujkanon, Dhaka- 1214, Bangladesh'
};

export const MALAYSIA_PICKUP_HUB = {
  country: 'Malaysia',
  city: 'Selangor',
  code: 'SGR',
  address: 'Lot 2720-B, Jalan Industri 12, Kampung Baru Sungai Buloh, 47000, Selangor.'
};

export const DEST_DELIVERY_HUBS: LocationHub[] = [
  { city: 'Dhaka', code: 'DAC', badge: 'DOOR DELIVERY', description: 'Doorstep Delivery to home, office, or shop in Dhaka' },
  { city: 'Chittagong', code: 'CGP', badge: 'DOOR DELIVERY', description: 'Doorstep Delivery to home, office, or shop in Chittagong' }
];

export const DEST_PICKUP_HUBS: LocationHub[] = [
  { city: 'Dhaka', code: 'DAC', badge: 'WAREHOUSE', description: '43/31, Sabujkanon, Dhaka- 1214, Bangladesh' },
  { city: 'Chittagong', code: 'CGP', badge: 'SEA PORT', description: 'Self-pickup at GoShipping Chittagong CFS Seaport Terminal (Agrabad)' }
];

export const MALAYSIA_DELIVERY_HUBS: LocationHub[] = [
  { city: 'Selangor', code: 'SGR', badge: 'DOOR DELIVERY', description: 'Doorstep Delivery across Selangor & Klang Valley' },
  { city: 'Kuala Lumpur', code: 'KUL', badge: 'DOOR DELIVERY', description: 'Doorstep Delivery in Kuala Lumpur Federal Territory' }
];

export const MALAYSIA_PICKUP_HUBS: LocationHub[] = [
  { city: 'Selangor', code: 'SGR', badge: 'WAREHOUSE', description: 'Lot 2720-B, Jalan Industri 12, Kampung Baru Sungai Buloh, 47000, Selangor.' }
];

export const DEST_COUNTRIES: CountryData[] = [
  {
    country: 'Bangladesh',
    code: 'BD',
    flag: '🇧🇩',
    popular: true,
    hubs: [
      { city: 'Dhaka', code: 'DAC', badge: 'DOOR DELIVERY', description: 'Doorstep Delivery or Depot Pickup in Dhaka' },
      { city: 'Chittagong', code: 'CGP', badge: 'SEA PORT', description: 'Doorstep Delivery or Seaport CFS Pickup in Chittagong' }
    ]
  },
  {
    country: 'Malaysia',
    code: 'MY',
    flag: '🇲🇾',
    popular: true,
    hubs: [
      {
        city: 'Selangor',
        code: 'SGR',
        badge: 'WAREHOUSE',
        description: 'Lot 2720-B, Jalan Industri 12, Kampung Baru Sungai Buloh, 47000, Selangor.'
      },
      {
        city: 'Kuala Lumpur',
        code: 'KUL',
        badge: 'DOOR DELIVERY',
        description: 'Doorstep Delivery across Kuala Lumpur and Klang Valley'
      }
    ]
  }
];

export function getCountryData(countries: CountryData[], countryName: string): CountryData | undefined {
  return countries.find((c) => c.country.toLowerCase() === countryName.toLowerCase());
}

export function getCitiesForCountry(countries: CountryData[], countryName: string): LocationHub[] {
  const match = getCountryData(countries, countryName);
  return match ? match.hubs : [];
}

export interface CountryAddressConfig {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
  stateLabel: string;
  defaultPostcode: string;
  defaultAddress1: string;
  defaultAddress2: string;
  states: {
    name: string;
    cities: string[];
  }[];
}

export const PHONE_DIAL_CODES = [
  { country: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { country: 'Malaysia', code: '+60', flag: '🇲🇾' },
  { country: 'China', code: '+86', flag: '🇨🇳' },
  { country: 'Singapore', code: '+65', flag: '🇸🇬' },
  { country: 'UAE', code: '+971', flag: '🇦🇪' },
  { country: 'United States', code: '+1', flag: '🇺🇸' },
  { country: 'United Kingdom', code: '+44', flag: '🇬🇧' }
];

export const DESTINATION_ADDRESS_CONFIGS: Record<string, CountryAddressConfig> = {
  Bangladesh: {
    name: 'Bangladesh',
    code: 'BD',
    flag: '🇧🇩',
    dialCode: '+880',
    stateLabel: 'Division',
    defaultPostcode: '1204',
    defaultAddress1: 'Flat 2/B, 16, 16/1 Basubazar Lane, Dayaganj',
    defaultAddress2: '',
    states: [
      {
        name: 'Dhaka Division',
        cities: ['Dhaka', 'Gazipur', 'Narayanganj', 'Savar', 'Keraniganj', 'Tongi', 'Narsingdi', 'Tangail', 'Manikganj', 'Munshiganj', 'Faridpur']
      },
      {
        name: 'Chittagong Division',
        cities: ['Chittagong', 'Agrabad (CFS)', 'Cox\'s Bazar', 'Comilla', 'Feni', 'Brahmanbaria', 'Noakhali', 'Chandpur', 'Rangamati']
      },
      {
        name: 'Sylhet Division',
        cities: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj', 'Sreemangal', 'Beanibazar']
      },
      {
        name: 'Rajshahi Division',
        cities: ['Rajshahi', 'Bogra', 'Pabna', 'Sirajganj', 'Naogaon', 'Natore', 'Joypurhat']
      },
      {
        name: 'Khulna Division',
        cities: ['Khulna', 'Jessore', 'Kushtia', 'Satkhira', 'Jhenaidah', 'Bagerhat (Mongla Port)']
      },
      {
        name: 'Barisal Division',
        cities: ['Barisal', 'Patuakhali', 'Bhola', 'Pirojpur', 'Jhalokati', 'Barguna']
      },
      {
        name: 'Rangpur Division',
        cities: ['Rangpur', 'Dinajpur', 'Saidpur', 'Thakurgaon', 'Kurigram', 'Gaibandha']
      },
      {
        name: 'Mymensingh Division',
        cities: ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur', 'Bhaluka']
      }
    ]
  },
  Malaysia: {
    name: 'Malaysia',
    code: 'MY',
    flag: '🇲🇾',
    dialCode: '+60',
    stateLabel: 'State / Territory',
    defaultPostcode: '47000',
    defaultAddress1: 'Lot 2720-B, Jalan Industri 12',
    defaultAddress2: 'Kampung Baru Sungai Buloh',
    states: [
      {
        name: 'Selangor',
        cities: ['Sungai Buloh', 'Petaling Jaya', 'Shah Alam', 'Subang Jaya', 'Klang', 'Puchong', 'Rawang', 'Ampang', 'Kajang', 'Cyberjaya', 'Sepang']
      },
      {
        name: 'Kuala Lumpur',
        cities: ['Kuala Lumpur City', 'Cheras', 'Kepong', 'Bukit Bintang', 'Mont Kiara', 'Wangsa Maju', 'Setapak', 'Bangsar']
      },
      {
        name: 'Johor',
        cities: ['Johor Bahru', 'Iskandar Puteri', 'Batu Pahat', 'Muar', 'Kluang', 'Pasir Gudang', 'Kulai', 'Segamat']
      },
      {
        name: 'Penang (Pulau Pinang)',
        cities: ['George Town', 'Bayan Lepas', 'Butterworth', 'Bukit Mertajam', 'Seberang Perai', 'Batu Kawan']
      },
      {
        name: 'Perak',
        cities: ['Ipoh', 'Taiping', 'Teluk Intan', 'Manjung', 'Kuala Kangsar', 'Kampar']
      },
      {
        name: 'Kedah',
        cities: ['Alor Setar', 'Sungai Petani', 'Kulim', 'Langkawi', 'Jitra']
      },
      {
        name: 'Melaka',
        cities: ['Melaka City', 'Ayer Keroh', 'Alor Gajah', 'Jasin', 'Batu Berendam']
      },
      {
        name: 'Negeri Sembilan',
        cities: ['Seremban', 'Port Dickson', 'Nilai', 'Senawang', 'Bahau']
      },
      {
        name: 'Pahang',
        cities: ['Kuantan', 'Bentong', 'Temerloh', 'Cameron Highlands', 'Raub']
      },
      {
        name: 'Sabah',
        cities: ['Kota Kinabalu', 'Sandakan', 'Tawau', 'Lahad Datu', 'Penampang']
      },
      {
        name: 'Sarawak',
        cities: ['Kuching', 'Miri', 'Sibu', 'Bintulu', 'Samarahan']
      },
      {
        name: 'Terengganu',
        cities: ['Kuala Terengganu', 'Chukai', 'Dungun', 'Kerteh']
      },
      {
        name: 'Kelantan',
        cities: ['Kota Bharu', 'Pasir Mas', 'Tumpat', 'Tanah Merah']
      },
      {
        name: 'Putrajaya',
        cities: ['Putrajaya Central', 'Precinct 1-20']
      }
    ]
  }
};
