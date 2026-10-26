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
