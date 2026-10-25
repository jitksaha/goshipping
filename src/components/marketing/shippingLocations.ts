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

export const DEST_DELIVERY_HUBS: LocationHub[] = [
  { city: 'All 64 Districts (Doorstep Delivery)', code: 'BD-ALL', badge: 'DOOR DELIVERY', description: 'Nationwide direct delivery to your home, office, shop, or factory across Bangladesh' },
  { city: 'Dhaka (All Zones: Uttara, Gulshan, Dhanmondi, Motijheel, Mirpur)', code: 'DAC', badge: 'DOOR DELIVERY', description: 'Express doorstep delivery across greater Dhaka metropolitan area' },
  { city: 'Chittagong (Chattogram City & Metro)', code: 'CGP', badge: 'DOOR DELIVERY', description: 'Direct commercial & residential doorstep delivery in Chattogram' },
  { city: 'Gazipur & Tongi Industrial Belt', code: 'GZP', badge: 'DOOR DELIVERY', description: 'Factory floor & commercial delivery in Joydebpur, Konabari & Chandra' },
  { city: 'Narayanganj & Adamjee EPZ', code: 'NRG', badge: 'DOOR DELIVERY', description: 'Knitwear industrial cluster & Adamjee EPZ door delivery' },
  { city: 'Savar & DEPZ (Dhaka Export Processing Zone)', code: 'DAC-DEPZ', badge: 'DOOR DELIVERY', description: 'DEPZ, Baipail, Ashulia & Hemayetpur factory door delivery' },
  { city: 'Sylhet Division', code: 'ZYL', badge: 'DOOR DELIVERY', description: 'Sylhet Sadar, Zindabazar, Moulvibazar & Habiganj delivery' },
  { city: 'Rajshahi Division', code: 'RJH', badge: 'DOOR DELIVERY', description: 'Rajshahi city, Bogura, Pabna & Sirajganj commercial delivery' },
  { city: 'Khulna Division', code: 'KHN', badge: 'DOOR DELIVERY', description: 'Khulna city, Jashore, Kushtia & Mongla regional delivery' },
  { city: 'Barishal Division', code: 'BZL', badge: 'DOOR DELIVERY', description: 'Barishal Sadar, Patuakhali & southern regional delivery' },
  { city: 'Rangpur Division', code: 'RNP', badge: 'DOOR DELIVERY', description: 'Rangpur, Saidpur & Dinajpur commercial delivery' },
  { city: 'Mymensingh Division', code: 'MYM', badge: 'DOOR DELIVERY', description: 'Mymensingh Sadar, Jamalpur & Netrokona regional delivery' },
  { city: 'Cumilla & Cumilla EPZ', code: 'CLA', badge: 'DOOR DELIVERY', description: 'Cumilla city, Paduar Bazar & EPZ commercial delivery' },
  { city: 'Cox\'s Bazar', code: 'CXB', badge: 'DOOR DELIVERY', description: 'Commercial & hotel logistics delivery in Cox\'s Bazar' },
  { city: 'Benapole / Jashore', code: 'BEN', badge: 'DOOR DELIVERY', description: 'Border trading & industrial corridor delivery' }
];

export const DEST_PICKUP_HUBS: LocationHub[] = [
  { city: 'Dhaka Central Hub — Uttara Express Sorting Warehouse & HSIA Cargo Complex', code: 'DAC-UTT', badge: 'WAREHOUSE', description: 'Self-pickup at GoShipping Airport Sorting Depot, Uttara, Dhaka' },
  { city: 'Dhaka — Tejgaon Central Commercial Hub', code: 'DAC-TEJ', badge: 'WAREHOUSE', description: 'Self-pickup at Central Tejgaon Commercial Dispatch Terminal' },
  { city: 'Dhaka — Kamalapur ICD Bonded Clearance Depot', code: 'DAC-ICD', badge: 'LAND PORT', description: 'Customs bonded container rail clearance & self-pickup' },
  { city: 'Chittagong — CPA Seaport CFS & Container Yard Depot', code: 'CGP-CFS', badge: 'SEA PORT', description: 'Self-pickup from Chittagong Port Authority CFS & Agrabad office' }
];

export const DEST_COUNTRIES: CountryData[] = [
  {
    country: 'Bangladesh',
    code: 'BD',
    popular: true,
    hubs: [
      ...DEST_DELIVERY_HUBS,
      ...DEST_PICKUP_HUBS
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
