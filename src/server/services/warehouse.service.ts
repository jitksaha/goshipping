export interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
  country: string;
  city: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
  capacitySqft: number;
  currentOccupancyPct: number;
  isActive: boolean;
}

let initialWarehouses: WarehouseRecord[] = [
  {
    id: 'wh-dac-01',
    code: 'DAC-HUB',
    name: 'Dhaka Central Gateway & Air Freight Depot',
    country: 'Bangladesh',
    city: 'Dhaka',
    address: 'Plot 14, Sector 3, Uttara Export Zone, Dhaka 1230',
    contactPerson: 'Kamal Hossain',
    phone: '+880 1711 223344',
    email: 'dhaka.hub@goshipping.com',
    capacitySqft: 25000,
    currentOccupancyPct: 68,
    isActive: true
  },
  {
    id: 'wh-ctg-01',
    code: 'CTG-PORT',
    name: 'Chittagong Maritime Terminal CFS',
    country: 'Bangladesh',
    city: 'Chittagong',
    address: 'Port Access Road, Customs Point, Chittagong 4100',
    contactPerson: 'Zakir Ahmed',
    phone: '+880 1819 556677',
    email: 'ctg.cfs@goshipping.com',
    capacitySqft: 60000,
    currentOccupancyPct: 82,
    isActive: true
  },
  {
    id: 'wh-dxb-01',
    code: 'DXB-CARGO',
    name: 'Dubai SkyCargo Consolidation Center',
    country: 'UAE',
    city: 'Dubai',
    address: 'Dubai South Aviation City, DWC Freezone, Dubai',
    contactPerson: 'Tariq Mansour',
    phone: '+971 4 800 9000',
    email: 'dubai.hub@goshipping.com',
    capacitySqft: 40000,
    currentOccupancyPct: 54,
    isActive: true
  },
  {
    id: 'wh-can-01',
    code: 'CAN-GZ',
    name: 'Guangzhou Pearl River Logistics Facility',
    country: 'China',
    city: 'Guangzhou',
    address: 'Baiyun International Logistics Park, Guangzhou, Guangdong',
    contactPerson: 'Li Wei',
    phone: '+86 20 8888 1234',
    email: 'gz.ops@goshipping.com',
    capacitySqft: 75000,
    currentOccupancyPct: 79,
    isActive: true
  },
  {
    id: 'wh-yiw-01',
    code: 'YIW-01',
    name: 'Yiwu International Commodity CFS Hub',
    country: 'China',
    city: 'Yiwu',
    address: 'Chouzhou North Road, International Trade City Zone 4, Yiwu, Zhejiang',
    contactPerson: 'Chen Gang',
    phone: '+86 579 8555 6789',
    email: 'yiw.cfs@goshipping.com',
    capacitySqft: 50000,
    currentOccupancyPct: 84,
    isActive: true
  },
  {
    id: 'wh-szx-01',
    code: 'SZX-01',
    name: 'Shenzhen Qianhai Air-Ocean Gateway',
    country: 'China',
    city: 'Shenzhen',
    address: 'Baoan Airport Logistics Park & Qianhai Port CFS, Shenzhen',
    contactPerson: 'Zhang Ming',
    phone: '+86 755 2345 8899',
    email: 'szx.gateway@goshipping.com',
    capacitySqft: 45000,
    currentOccupancyPct: 62,
    isActive: true
  }
];

export class WarehouseService {
  static async listWarehouses(): Promise<WarehouseRecord[]> {
    return initialWarehouses;
  }

  static async getById(id: string): Promise<WarehouseRecord | null> {
    return initialWarehouses.find((w) => w.id === id || w.code === id) || null;
  }
}
