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
  // BANGLADESH HUBS
  {
    id: 'wh-dac-01',
    code: 'DAC-HUB',
    name: 'Dhaka Central Hub & Pickup Point',
    country: 'Bangladesh',
    city: 'Dhaka',
    address: '43/31, Sabujkanon, Dhaka- 1214, Bangladesh',
    contactPerson: 'Kamal Hossain',
    phone: '+880 1711 223344',
    email: 'dhaka.hub@goshipping.com.bd',
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
    address: 'Port Access Road, Customs Point, Chittagong 4100, Bangladesh',
    contactPerson: 'Zakir Ahmed',
    phone: '+880 1819 556677',
    email: 'ctg.cfs@goshipping.com.bd',
    capacitySqft: 60000,
    currentOccupancyPct: 82,
    isActive: true
  },
  // CHINA HUBS
  {
    id: 'wh-can-01',
    code: 'CAN-GZ',
    name: 'Guangzhou Pearl River Logistics Facility',
    country: 'China',
    city: 'Guangzhou',
    address: 'Baiyun International Logistics Park, Guangzhou, Guangdong, China',
    contactPerson: 'Li Wei',
    phone: '+86 20 8888 1234',
    email: 'gz.ops@goshipping.com.bd',
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
    address: 'Chouzhou North Road, International Trade City Zone 4, Yiwu, Zhejiang, China',
    contactPerson: 'Chen Gang',
    phone: '+86 579 8555 6789',
    email: 'yiw.cfs@goshipping.com.bd',
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
    address: 'Baoan Airport Logistics Park & Qianhai Port CFS, Shenzhen, Guangdong, China',
    contactPerson: 'Zhang Ming',
    phone: '+86 755 2345 8899',
    email: 'szx.gateway@goshipping.com.bd',
    capacitySqft: 45000,
    currentOccupancyPct: 62,
    isActive: true
  },
  // MALAYSIA HUB
  {
    id: 'wh-my-01',
    code: 'MY-KUL',
    name: 'Malaysia Receiving & Logistics Hub',
    country: 'Malaysia',
    city: 'Selangor',
    address: 'Lot 2720-B, Jalan Industri 12, Kampung Baru Sungai Buloh, 47000, Selangor, Malaysia',
    contactPerson: 'GoShipping Malaysia Ops',
    phone: '+60 11-1234 5678',
    email: 'my.ops@goshipping.com.bd',
    capacitySqft: 35000,
    currentOccupancyPct: 42,
    isActive: true
  }
];

export class WarehouseService {
  static async listWarehouses(): Promise<WarehouseRecord[]> {
    return [...initialWarehouses];
  }

  static async getById(id: string): Promise<WarehouseRecord | null> {
    return initialWarehouses.find((w) => w.id === id || w.code.toUpperCase() === id.toUpperCase()) || null;
  }

  static async createWarehouse(data: Omit<WarehouseRecord, 'id'>): Promise<WarehouseRecord> {
    const id = `wh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newRecord: WarehouseRecord = {
      id,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      country: data.country.trim(),
      city: data.city.trim(),
      address: data.address.trim(),
      contactPerson: data.contactPerson?.trim() || 'Operations Manager',
      phone: data.phone?.trim() || '+880 1711 000000',
      email: data.email?.trim().toLowerCase() || 'ops@goshipping.com.bd',
      capacitySqft: Number(data.capacitySqft) || 20000,
      currentOccupancyPct: Math.min(100, Math.max(0, Number(data.currentOccupancyPct) || 0)),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
    };
    initialWarehouses.push(newRecord);
    return newRecord;
  }

  static async updateWarehouse(id: string, data: Partial<WarehouseRecord>): Promise<WarehouseRecord | null> {
    const idx = initialWarehouses.findIndex((w) => w.id === id || w.code.toUpperCase() === id.toUpperCase());
    if (idx === -1) return null;

    const existing = initialWarehouses[idx];
    const updated: WarehouseRecord = {
      ...existing,
      ...data,
      code: data.code ? data.code.trim().toUpperCase() : existing.code,
      name: data.name ? data.name.trim() : existing.name,
      country: data.country ? data.country.trim() : existing.country,
      city: data.city ? data.city.trim() : existing.city,
      address: data.address ? data.address.trim() : existing.address,
      contactPerson: data.contactPerson !== undefined ? data.contactPerson.trim() : existing.contactPerson,
      phone: data.phone !== undefined ? data.phone.trim() : existing.phone,
      email: data.email !== undefined ? data.email.trim().toLowerCase() : existing.email,
      capacitySqft: data.capacitySqft !== undefined ? Number(data.capacitySqft) : existing.capacitySqft,
      currentOccupancyPct: data.currentOccupancyPct !== undefined ? Math.min(100, Math.max(0, Number(data.currentOccupancyPct))) : existing.currentOccupancyPct,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive
    };
    initialWarehouses[idx] = updated;
    return updated;
  }

  static async deleteWarehouse(id: string): Promise<boolean> {
    const idx = initialWarehouses.findIndex((w) => w.id === id || w.code.toUpperCase() === id.toUpperCase());
    if (idx === -1) return false;
    initialWarehouses.splice(idx, 1);
    return true;
  }
}
