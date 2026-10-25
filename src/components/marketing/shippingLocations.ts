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
      { city: 'Guangzhou', code: 'CAN', badge: 'WAREHOUSE', description: 'GoShipping Primary Air & Sea Consolidation Hub (Baiyun / Huangpu)' },
      { city: 'Yiwu', code: 'YIW', badge: 'WAREHOUSE', description: 'Small Commodities & 1688 Consolidation Depot (Futian Market)' },
      { city: 'Shenzhen', code: 'SZX', badge: 'SEA PORT', description: 'Electronics, Shekou & Yantian Maritime Container Port' },
      { city: 'Shanghai', code: 'PVG', badge: 'AIR HUB', description: 'Pudong International Air & Yangshan Deepwater Seaport' },
      { city: 'Ningbo', code: 'NGB', badge: 'SEA PORT', description: 'Ningbo-Zhoushan Port (FCL & LCL Ocean Freight)' },
      { city: 'Dongguan', code: 'DGG', badge: 'WAREHOUSE', description: 'Hardware, Plastics & Industrial Factory Logistics Center' },
      { city: 'Foshan', code: 'FS', badge: 'WAREHOUSE', description: 'Furniture, Tiles & Machinery Direct Pickup Depot' },
      { city: 'Hangzhou', code: 'HGH', badge: 'AIR HUB', description: 'Cross-Border E-commerce & Textile Distribution Center' },
      { city: 'Qingdao', code: 'TAO', badge: 'SEA PORT', description: 'Northern China Maritime Container Terminal' },
      { city: 'Xiamen', code: 'XMN', badge: 'SEA PORT', description: 'Fujian Provincial Air Cargo & Sea Terminal' },
      { city: 'Shantou', code: 'SWA', badge: 'WAREHOUSE', description: 'Toys, Undergarments & Packaging Manufacturing Hub' },
      { city: 'Zhongshan', code: 'ZS', badge: 'WAREHOUSE', description: 'Lighting & Home Appliances Consolidation Hub' },
      { city: 'Tianjin', code: 'TSN', badge: 'SEA PORT', description: 'Northern Commercial Maritime Port' },
      { city: 'Beijing', code: 'PEK', badge: 'AIR HUB', description: 'Capital Cargo Terminal' },
      { city: 'Chengdu', code: 'CTU', badge: 'AIR HUB', description: 'Western China High-Tech Air Hub' },
      { city: 'Wuhan', code: 'WUH', badge: 'WAREHOUSE', description: 'Central Yangtze River Inland Logistics Hub' }
    ]
  }
];

export const DEST_COUNTRIES: CountryData[] = [
  {
    country: 'Bangladesh',
    code: 'BD',
    popular: true,
    hubs: [
      { city: 'Dhaka', code: 'DAC', badge: 'AIR HUB', description: 'Hazrat Shahjalal International Airport (HSIA Air Cargo Complex)' },
      { city: 'Dhaka — Kamalapur ICD', code: 'DAC-ICD', badge: 'LAND PORT', description: 'Inland Container Depot (Customs Bonded Rail Clearance)' },
      { city: 'Dhaka — Tejgaon & Mohakhali', code: 'DAC-TEJ', badge: 'DOOR DELIVERY', description: 'Central Commercial District Dispatch Hub' },
      { city: 'Dhaka — Uttara & Tongi Hub', code: 'DAC-UTT', badge: 'WAREHOUSE', description: 'GoShipping Airport Regional Express Sorting Warehouse' },
      { city: 'Dhaka — Motijheel & Old Dhaka', code: 'DAC-MOT', badge: 'DOOR DELIVERY', description: 'Chawkbazar, Islampur & Nawabpur Wholesale Market Door Delivery' },
      { city: 'Dhaka — Savar & DEPZ', code: 'DAC-DEPZ', badge: 'EPZ', description: 'Dhaka Export Processing Zone & RMG Industrial Hub' },
      { city: 'Dhaka — Mirpur & Pallabi', code: 'DAC-MIR', badge: 'DOOR DELIVERY', description: 'Residential & Light Manufacturing Delivery Depot' },
      { city: 'Gazipur Industrial Zone', code: 'GZP', badge: 'DOOR DELIVERY', description: 'Joydebpur, Konabari & Chandra Factory Floor Door Delivery' },
      { city: 'Narayanganj & Adamjee EPZ', code: 'NRG', badge: 'EPZ', description: 'River Port, Knitwear Capital & Adamjee EPZ Logistics Hub' },
      { city: 'Chittagong (Chattogram)', code: 'CGP', badge: 'SEA PORT', description: 'Chittagong Port Authority (CPA) Seaport CFS & Container Yard' },
      { city: 'Chittagong — Agrabad & Khatunganj', code: 'CGP-AGR', badge: 'DOOR DELIVERY', description: 'Commercial Trading & Wholesale Commodity Center' },
      { city: 'Chittagong — CEPZ & KEPZ', code: 'CGP-EPZ', badge: 'EPZ', description: 'Chittagong & Karnaphuli Export Processing Zones' },
      { city: 'Sylhet', code: 'ZYL', badge: 'AIR HUB', description: 'Osmani International Airport Hub, Zindabazar & Ambarkhana' },
      { city: 'Khulna & Mongla Port', code: 'MGL', badge: 'SEA PORT', description: 'Mongla Seaport CFS & Khulna Regional Warehouse' },
      { city: 'Benapole Land Port', code: 'BEN', badge: 'LAND PORT', description: 'Jashore-Benapole Land Customs Station Delivery Hub' },
      { city: 'Cumilla & Cumilla EPZ', code: 'CLA', badge: 'EPZ', description: 'Paduar Bazar Highway Depot & Cumilla EPZ' },
      { city: 'Bogura (Bogra)', code: 'BOG', badge: 'DOOR DELIVERY', description: 'Northern Trade Gateway & Industrial Town' },
      { city: 'Rajshahi', code: 'RJH', badge: 'DOOR DELIVERY', description: 'Western Agro & Commercial Regional Hub' },
      { city: 'Barishal', code: 'BZL', badge: 'DOOR DELIVERY', description: 'Southern Riverine Hub & Commercial Center' },
      { city: 'Rangpur & Saidpur', code: 'RNP', badge: 'DOOR DELIVERY', description: 'North Bengal Regional Dispatch Depot' },
      { city: 'Mymensingh', code: 'MYM', badge: 'DOOR DELIVERY', description: 'Central North Regional Delivery Office' },
      { city: 'Cox\'s Bazar & Matarbari', code: 'CXB', badge: 'SEA PORT', description: 'Matarbari Deep Sea Port Logistics Corridor' },
      { city: 'All 64 Districts (Door-to-Door Delivery)', code: 'BD-ALL', badge: 'DOOR DELIVERY', description: 'Direct doorstep delivery across any Upazila/District in Bangladesh' }
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
