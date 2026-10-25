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
  },
  {
    country: 'Hong Kong',
    code: 'HK',
    popular: true,
    hubs: [
      { city: 'Hong Kong', code: 'HKG', badge: 'AIR HUB', description: 'Global Air Express Terminal & Kwai Tsing Free Port' }
    ]
  },
  {
    country: 'India',
    code: 'IN',
    popular: true,
    hubs: [
      { city: 'Mumbai', code: 'BOM', badge: 'SEA PORT', description: 'Jawaharlal Nehru Port (Nhava Sheva) & Air Cargo Complex' },
      { city: 'Delhi / NCR', code: 'DEL', badge: 'AIR HUB', description: 'Indira Gandhi International Airport Cargo Terminal' },
      { city: 'Kolkata', code: 'CCU', badge: 'SEA PORT', description: 'Syama Prasad Mookerjee Port & Air Freight Station' },
      { city: 'Chennai', code: 'MAA', badge: 'SEA PORT', description: 'Southern Ocean Port & Automotive Logistics Hub' },
      { city: 'Ahmedabad / Mundra', code: 'AMD', badge: 'SEA PORT', description: 'Gujarat Industrial Hub & Mundra Port' },
      { city: 'Surat', code: 'STV', badge: 'WAREHOUSE', description: 'Textiles & Diamond Manufacturing Center' }
    ]
  },
  {
    country: 'United Arab Emirates',
    code: 'AE',
    popular: true,
    hubs: [
      { city: 'Dubai', code: 'DXB', badge: 'AIR HUB', description: 'Jebel Ali Free Zone (JAFZA) & Dubai World Central' },
      { city: 'Sharjah', code: 'SHJ', badge: 'AIR HUB', description: 'SAIF Zone International Freight Station' },
      { city: 'Abu Dhabi', code: 'AUH', badge: 'SEA PORT', description: 'Khalifa Industrial Zone Abu Dhabi (KIZAD)' }
    ]
  },
  {
    country: 'Thailand',
    code: 'TH',
    hubs: [
      { city: 'Bangkok', code: 'BKK', badge: 'AIR HUB', description: 'Suvarnabhumi Airport Cargo Logistics Facility' },
      { city: 'Laem Chabang', code: 'LCB', badge: 'SEA PORT', description: 'Primary Deep Sea Container Port' }
    ]
  },
  {
    country: 'Vietnam',
    code: 'VN',
    hubs: [
      { city: 'Ho Chi Minh City', code: 'SGN', badge: 'SEA PORT', description: 'Cat Lai Container Terminal & Tan Son Nhat Air Cargo' },
      { city: 'Hanoi', code: 'HAN', badge: 'AIR HUB', description: 'Noi Bai International Airport Air Cargo Station' },
      { city: 'Haiphong', code: 'HPH', badge: 'SEA PORT', description: 'Northern Deepwater Container Port' }
    ]
  },
  {
    country: 'Singapore',
    code: 'SG',
    hubs: [
      { city: 'Singapore', code: 'SIN', badge: 'SEA PORT', description: 'PSA Container Terminal & Changi Air Cargo Terminal' }
    ]
  },
  {
    country: 'Malaysia',
    code: 'MY',
    hubs: [
      { city: 'Kuala Lumpur / Port Klang', code: 'KUL', badge: 'SEA PORT', description: 'Port Klang Northport/Westport & KLIA Cargo' },
      { city: 'Penang', code: 'PEN', badge: 'AIR HUB', description: 'Bayan Lepas Free Industrial Zone Air Terminal' }
    ]
  },
  {
    country: 'United States',
    code: 'US',
    hubs: [
      { city: 'New York / New Jersey', code: 'JFK', badge: 'AIR HUB', description: 'JFK Air Cargo Hub & Port Newark Container Terminal' },
      { city: 'Los Angeles / Long Beach', code: 'LAX', badge: 'SEA PORT', description: 'San Pedro Bay Ports & LAX Pacific Gateway' },
      { city: 'Chicago', code: 'ORD', badge: 'AIR HUB', description: "O'Hare Intermodal Cargo Terminal" },
      { city: 'Houston', code: 'IAH', badge: 'SEA PORT', description: 'Port of Houston Industrial & Energy Cargo Terminal' }
    ]
  },
  {
    country: 'United Kingdom',
    code: 'GB',
    hubs: [
      { city: 'London', code: 'LHR', badge: 'AIR HUB', description: 'Heathrow World Cargo Centre & London Gateway Port' },
      { city: 'Felixstowe', code: 'FXT', badge: 'SEA PORT', description: 'UK Largest Container Seaport' },
      { city: 'Manchester', code: 'MAN', badge: 'AIR HUB', description: 'Northern Logistics & Freight Distribution Center' }
    ]
  },
  {
    country: 'Germany',
    code: 'DE',
    hubs: [
      { city: 'Frankfurt', code: 'FRA', badge: 'AIR HUB', description: 'Frankfurt CargoCity (European Air Freight Hub)' },
      { city: 'Hamburg', code: 'HAM', badge: 'SEA PORT', description: 'Port of Hamburg Container Terminals' }
    ]
  },
  {
    country: 'Japan',
    code: 'JP',
    hubs: [
      { city: 'Tokyo / Narita', code: 'NRT', badge: 'AIR HUB', description: 'Narita International Cargo & Tokyo Port' },
      { city: 'Osaka / Kobe', code: 'KIX', badge: 'SEA PORT', description: 'Kansai International Cargo & Hanshin Port' }
    ]
  },
  {
    country: 'South Korea',
    code: 'KR',
    hubs: [
      { city: 'Incheon', code: 'ICN', badge: 'AIR HUB', description: 'Incheon International Free Economic Cargo Zone' },
      { city: 'Busan', code: 'PUS', badge: 'SEA PORT', description: 'Busan New Port Container Terminal' }
    ]
  },
  {
    country: 'Turkey',
    code: 'TR',
    hubs: [
      { city: 'Istanbul', code: 'IST', badge: 'AIR HUB', description: 'Istanbul Airport Mega Cargo Hub & Ambarli Port' },
      { city: 'Izmir', code: 'IZM', badge: 'SEA PORT', description: 'Aegean Maritime Export Center' }
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
  },
  {
    country: 'India',
    code: 'IN',
    popular: true,
    hubs: [
      { city: 'Kolkata', code: 'CCU', badge: 'SEA PORT', description: 'Kolkata Port Trust & Netaji Subhash Chandra Bose Airport' },
      { city: 'Delhi / NCR', code: 'DEL', badge: 'AIR HUB', description: 'Air Cargo Complex & Tughlakabad ICD' },
      { city: 'Mumbai', code: 'BOM', badge: 'SEA PORT', description: 'Nhava Sheva Port & Sahar Air Cargo Terminal' },
      { city: 'Chennai', code: 'MAA', badge: 'SEA PORT', description: 'Chennai Port Trust & Meenambakkam Cargo Terminal' }
    ]
  },
  {
    country: 'United Arab Emirates',
    code: 'AE',
    popular: true,
    hubs: [
      { city: 'Dubai', code: 'DXB', badge: 'AIR HUB', description: 'Jebel Ali Free Zone Authority (JAFZA) & Cargo Village' },
      { city: 'Sharjah', code: 'SHJ', badge: 'AIR HUB', description: 'Sharjah Airport International Free Zone (SAIF)' }
    ]
  },
  {
    country: 'Nepal',
    code: 'NP',
    hubs: [
      { city: 'Kathmandu', code: 'KTM', badge: 'AIR HUB', description: 'Tribhuvan International Air Cargo Complex' },
      { city: 'Birgunj', code: 'BIR', badge: 'LAND PORT', description: 'Inland Clearance Dry Port (ICD Birgunj)' }
    ]
  },
  {
    country: 'Bhutan',
    code: 'BT',
    hubs: [
      { city: 'Thimphu / Paro', code: 'PBH', badge: 'AIR HUB', description: 'Paro International Airport Cargo Terminal' },
      { city: 'Phuntsholing', code: 'PHU', badge: 'LAND PORT', description: 'Border Customs Clearance Station' }
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
