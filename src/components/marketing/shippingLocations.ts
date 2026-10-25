export interface LocationHub {
  city: string;
  code?: string;
  badge: 'WAREHOUSE' | 'AIR HUB' | 'SEA PORT' | 'DOOR DELIVERY' | 'EPZ' | 'LAND PORT';
  description?: string;
}

export interface CountryData {
  country: string;
  code: string;
  popular?: boolean;
  hubs: LocationHub[];
}

export const ORIGIN_COUNTRIES: CountryData[] = [
  {
    country: 'China',
    code: 'CN',
    popular: true,
    hubs: [
      {
        city: 'Guangzhou',
        code: 'CAN',
        badge: 'WAREHOUSE',
        description: '765, Sanyuanli Avenue, Baiyun District, Guangzhou'
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

export const DEST_DELIVERY_HUBS: LocationHub[] = [
  { city: 'Dhaka', code: 'DAC', badge: 'DOOR DELIVERY', description: 'Doorstep Delivery to home, office, or shop in Dhaka' },
  { city: 'Chittagong', code: 'CGP', badge: 'DOOR DELIVERY', description: 'Doorstep Delivery to home, office, or shop in Chittagong' }
];

export const DEST_PICKUP_HUBS: LocationHub[] = [
  { city: 'Dhaka', code: 'DAC', badge: 'WAREHOUSE', description: '43/31, Sabujkanon, Dhaka- 1214, Bangladesh' },
  { city: 'Chittagong', code: 'CGP', badge: 'SEA PORT', description: 'Self-pickup at GoShipping Chittagong CFS Seaport Terminal (Agrabad)' }
];

export const DEST_COUNTRIES: CountryData[] = [
  {
    country: 'Bangladesh',
    code: 'BD',
    popular: true,
    hubs: [
      { city: 'Dhaka', code: 'DAC', badge: 'DOOR DELIVERY', description: 'Doorstep Delivery or Depot Pickup in Dhaka' },
      { city: 'Chittagong', code: 'CGP', badge: 'SEA PORT', description: 'Doorstep Delivery or Seaport CFS Pickup in Chittagong' }
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
