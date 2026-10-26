import SearchableSelect, { type SearchableSelectOption } from "./SearchableSelect";
import React, { useState, useEffect, useMemo } from 'react';
import type { ShipmentRecord, ShipmentItem } from '../../server/services/shipment.service';
import type { QuoteRecord } from '../../server/services/quote.service';
import type { WarehouseRecord } from '../../server/services/warehouse.service';
import { TRACKING_STATUSES, normalizeStatusCode, calculatePhysicalProgress, type TrackingStatusCode } from '../../server/services/tracking-status';
import { DESTINATION_ADDRESS_CONFIGS, PHONE_DIAL_CODES } from '../marketing/shippingLocations';

interface CustomerItem {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  activeShipmentsCount: number;
  totalQuotesCount: number;
  tier: string;
}

interface AuditItem {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  createdAt: string;
  details?: any;
}

export interface OrderItemForm {
  id: string;
  description: string;
  packagingType: string;
  categoryTag: 'Commercial' | 'General' | 'Electronics' | 'Liquids' | 'Dangerous' | 'Perishable';
  quantity: number;
  weightKg: number;
  cbm: number;
  declaredValue?: number;
}


const PACKAGE_TYPE_OPTIONS: SearchableSelectOption[] = [
  { value: 'air_uld', label: 'Air ULD (LD3 / Contour Container)', badge: 'Air' },
  { value: 'carton', label: 'Carton (Corrugated Export Box)', badge: 'Common' },
  { value: 'wooden_crate', label: 'Wooden Crate (Heavy / Fragile Cargo)' },
  { value: 'pallet', label: 'Pallet (Plastic / Heat-Treated Wood)' },
  { value: 'container_20ft', label: '20ft FCL Container', badge: 'Sea' },
  { value: 'container_40ft', label: '40ft HQ Container', badge: 'Sea' },
  { value: 'gunny_bag', label: 'Gunny / Poly Bag', badge: 'Parcel' },
  { value: 'drum', label: 'Steel / Plastic Drum Container' },
  { value: 'loose', label: 'Loose Cargo (Unpackaged)' }
];

const CATEGORY_OPTIONS: SearchableSelectOption[] = [
  { value: 'Commercial', label: 'Commercial Cargo (General Goods)' },
  { value: 'Garments', label: 'Garments & Fashion Apparel' },
  { value: 'Textiles', label: 'Fabric Rolls & Raw Textiles' },
  { value: 'Electronics', label: 'Consumer Electronics & Gadgets' },
  { value: 'Liquids', label: 'Liquids & Cosmetics (Permitted)' },
  { value: 'Dangerous', label: 'Dangerous Goods (Battery / DG)' },
  { value: 'Perishable', label: 'Perishable & Cold Chain' },
  { value: 'Machinery', label: 'Industrial Machinery & Spare Parts' }
];

const ORIGIN_OPTIONS: SearchableSelectOption[] = [
  { value: 'Guangzhou', label: 'Guangzhou (CAN Hub)', badge: 'China' },
  { value: 'Yiwu', label: 'Yiwu (YIW Trade City Hub)', badge: 'China' },
  { value: 'Shenzhen', label: 'Shenzhen (SZX Port & Airport)', badge: 'China' },
  { value: 'Shanghai', label: 'Shanghai (PVG Pudong Hub)', badge: 'China' },
  { value: 'Hong Kong', label: 'Hong Kong (HKG Freight Hub)', badge: 'China' }
];

const DESTINATION_OPTIONS: SearchableSelectOption[] = [
  { value: 'Dhaka', label: 'Dhaka (HSIA Airport Hub / Kurmitola)', badge: 'BD' },
  { value: 'Chittagong', label: 'Chittagong (Seaport CFS / Patenga)', badge: 'BD' },
  { value: 'Tejgaon', label: 'Dhaka Central (Tejgaon ICD)', badge: 'BD' },
  { value: 'Savar', label: 'Dhaka North (DEPZ Savar Hub)', badge: 'BD' }
];

export default function AdminOperationsIsland({ initialTab = 'overview' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter for shipments
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [shipmentModeFilter, setShipmentModeFilter] = useState('all');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('all');

  // Search & filter for quotes
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('all');

  // Search & filter for invoices
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [invoicePaidOverrides, setInvoicePaidOverrides] = useState<Record<string, boolean>>({});
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);

  // Modals state
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedQuoteForPricing, setSelectedQuoteForPricing] = useState<QuoteRecord | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification(null);
    }, 3000);
  };

  // New Consignment Form State
  const [newCustName, setNewCustName] = useState('');
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientAddress, setNewRecipientAddress] = useState('');
  const [newOriginCountry, setNewOriginCountry] = useState('China');
  const [newOriginCity, setNewOriginCity] = useState('Guangzhou');
  const [newDestCountry, setNewDestCountry] = useState('Bangladesh');
  const [newDestCity, setNewDestCity] = useState('Dhaka');
  const [newMode, setNewMode] = useState<'air' | 'sea' | 'hand_carry'>('air');
  const [newServiceLevel, setNewServiceLevel] = useState<'standard' | 'express' | 'priority'>('express');
  const [newCarrier, setNewCarrier] = useState('');
  const [newVoyage, setNewVoyage] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Section 4: Dynamic Structured Delivery Address State
  const [recipientContactName, setRecipientContactName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [recipientState, setRecipientState] = useState('Dhaka Division');
  const [recipientCity, setRecipientCity] = useState('Dhaka');
  const [recipientPostcode, setRecipientPostcode] = useState('');
  const [recipientPhoneCode, setRecipientPhoneCode] = useState('+880');
  const [recipientPhoneBody, setRecipientPhoneBody] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const currentAddressConfig = DESTINATION_ADDRESS_CONFIGS[newDestCountry] || DESTINATION_ADDRESS_CONFIGS.Bangladesh;
  const currentStates = currentAddressConfig.states;
  const matchedStateObj = currentStates.find((s) => s.name === recipientState) || currentStates[0];
  const currentAvailableCities = matchedStateObj ? matchedStateObj.cities : [recipientCity];

  const compiledAddress = useMemo(() => {
    return [
      addressLine1.trim(),
      addressLine2.trim(),
      recipientCity.trim(),
      recipientState.trim(),
      recipientPostcode.trim(),
      newDestCountry
    ].filter(Boolean).join(', ');
  }, [addressLine1, addressLine2, recipientCity, recipientState, recipientPostcode, newDestCountry]);

  const compiledPhone = useMemo(() => {
    if (!recipientPhoneBody.trim()) return '';
    return `${recipientPhoneCode} ${recipientPhoneBody.trim()}`.trim();
  }, [recipientPhoneCode, recipientPhoneBody]);

  const handleCountryChange = (country: string) => {
    setNewDestCountry(country);
    const config = DESTINATION_ADDRESS_CONFIGS[country] || DESTINATION_ADDRESS_CONFIGS.Bangladesh;
    const defaultState = config.states[0]?.name || '';
    const defaultCity = config.states[0]?.cities[0] || '';
    setRecipientState(defaultState);
    setRecipientCity(defaultCity);
    setNewDestCity(defaultCity);
    setAddressLine1('');
    setAddressLine2('');
    setRecipientPostcode('');
    setRecipientPhoneCode(config.dialCode);
    setRecipientPhoneBody('');
  };

  const handleStateChange = (stateName: string) => {
    setRecipientState(stateName);
    const config = DESTINATION_ADDRESS_CONFIGS[newDestCountry] || DESTINATION_ADDRESS_CONFIGS.Bangladesh;
    const stateObj = config.states.find((s) => s.name === stateName);
    if (stateObj && stateObj.cities.length > 0) {
      const firstCity = stateObj.cities[0];
      setRecipientCity(firstCity);
      setNewDestCity(firstCity);
    }
  };

  // Dynamic Multi-Product Line Items
  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([
    {
      id: 'item-1',
      description: '',
      packagingType: 'carton',
      categoryTag: 'Commercial',
      quantity: '' as any,
      weightKg: '' as any,
      cbm: '' as any,
      declaredValue: '' as any
    }
  ]);

  const addOrderItem = () => {
    const nextId = `item-${Date.now().toString(36)}-${orderItems.length + 1}`;
    setOrderItems((prev) => [
      ...prev,
      {
        id: nextId,
        description: '',
        packagingType: 'carton',
        categoryTag: 'Commercial',
        quantity: '' as any,
        weightKg: '' as any,
        cbm: '' as any,
        declaredValue: '' as any
      }
    ]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length <= 1) {
      alert('At least one product item is required for the consignment.');
      return;
    }
    setOrderItems((prev) => prev.filter((it) => it.id !== id));
  };

  const duplicateOrderItem = (item: OrderItemForm) => {
    const nextId = `item-${Date.now().toString(36)}-${orderItems.length + 1}`;
    setOrderItems((prev) => [
      ...prev,
      {
        ...item,
        id: nextId,
        description: item.description ? `${item.description} (Copy)` : ''
      }
    ]);
  };

  const updateOrderItem = (id: string, field: keyof OrderItemForm, value: any) => {
    setOrderItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  // Live Auto-Calculated Totals across all products
  const orderTotals = useMemo(() => {
    const totalPieces = orderItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const totalWeight = orderItems.reduce((acc, it) => acc + (Number(it.weightKg) || 0), 0);
    const totalCbm = orderItems.reduce((acc, it) => acc + (Number(it.cbm) || 0), 0);
    const totalDeclaredValue = orderItems.reduce((acc, it) => acc + (Number(it.declaredValue) || 0), 0);
    const volumetricWeight = Math.round(totalCbm * 167);
    const chargeableWeight = Math.max(totalWeight, volumetricWeight);

    return {
      totalItems: orderItems.length,
      totalPieces,
      totalWeight: Number(totalWeight.toFixed(2)),
      totalCbm: Number(totalCbm.toFixed(2)),
      volumetricWeight,
      chargeableWeight: Number(chargeableWeight.toFixed(2)),
      totalDeclaredValue
    };
  }, [orderItems]);

  const [submittingConsignment, setSubmittingConsignment] = useState(false);

  // Live Tracking Quick Control & Feedback
  const [createdShipmentResult, setCreatedShipmentResult] = useState<{
    trackingNumber: string;
    customerName: string;
    route: string;
    mode: string;
  } | null>(null);
  const [liveStatusFeedback, setLiveStatusFeedback] = useState<{
    trackingNumber: string;
    newStatus: string;
    statusLabel: string;
  } | null>(null);
  const [newCustomTrackingNumber, setNewCustomTrackingNumber] = useState('');
  const [newInitialStatus, setNewInitialStatus] = useState<string>('purchased');
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  // Quick Status Updater in Dashboard Overview
  const [quickShipmentId, setQuickShipmentId] = useState<string>('');
  const [quickTargetStage, setQuickTargetStage] = useState<string>('arrived_dhaka_airport');
  const [updatingQuickStage, setUpdatingQuickStage] = useState(false);

  // Pricing Form State
  const [baseFreight, setBaseFreight] = useState('175000');
  const [fuelSurcharge, setFuelSurcharge] = useState('14500');
  const [customsClearanceFee, setCustomsClearanceFee] = useState('10500');
  const [handlingFee, setHandlingFee] = useState('6000');
  const [pricingNotes, setPricingNotes] = useState('Door-to-door delivery with pre-cleared customs at HSIA Dhaka.');
  const [submittingPricing, setSubmittingPricing] = useState(false);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Add / Edit User Form State
  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('password');
  const [userRole, setUserRole] = useState('customer');
  const [userStatus, setUserStatus] = useState('active');
  const [userPhone, setUserPhone] = useState('');
  const [userCompanyName, setUserCompanyName] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [userBin, setUserBin] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);

  // Warehouse Facility Management State
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [showEditWarehouseModal, setShowEditWarehouseModal] = useState(false);
  const [showDeleteWarehouseModal, setShowDeleteWarehouseModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseRecord | null>(null);
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseCountryFilter, setWarehouseCountryFilter] = useState('all');
  const [submittingWarehouse, setSubmittingWarehouse] = useState(false);
  const [deletingWarehouse, setDeletingWarehouse] = useState(false);

  // Warehouse Form State
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whCountry, setWhCountry] = useState('China');
  const [whCity, setWhCity] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whContactPerson, setWhContactPerson] = useState('');
  const [whPhone, setWhPhone] = useState('');
  const [whEmail, setWhEmail] = useState('');
  const [whCapacitySqft, setWhCapacitySqft] = useState(25000);
  const [whCurrentOccupancyPct, setWhCurrentOccupancyPct] = useState(50);
  const [whIsActive, setWhIsActive] = useState(true);

  // New Consignment Customer Link & Real-time Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderCustomerMode, setOrderCustomerMode] = useState<'existing' | 'new'>('existing');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [newCustomerFullName, setNewCustomerFullName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCompany, setNewCustomerCompany] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerPassword, setNewCustomerPassword] = useState('');
  const [newRecipientPhone, setNewRecipientPhone] = useState('');

  // Customer Filtering & Live Selection Mappings
  const filteredCustomersForOrder = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.fullName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const comp = (u.companyName || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || comp.includes(q) || phone.includes(q);
    });
  }, [users, customerSearchQuery]);

  const allCustomerOptions = useMemo(() => {
    const customerUsers = users.filter((u) => u.role === 'customer' || !u.role);
    const combined = [...customerUsers, ...customers.filter((c) => !customerUsers.some((u) => u.id === c.id))];
    if (combined.length > 0) return combined;
    return [
      { id: 'usr-customer-01', fullName: 'Farhan Ahmed', companyName: 'Apex Textiles Ltd', email: 'farhan@apextextiles.com', phone: '+880 1711-223344', role: 'customer', address: 'Export Processing Zone, Savar, Dhaka 1349, Bangladesh' },
      { id: 'usr-customer-02', fullName: 'Shakil Mahmud', companyName: 'Standard Composite Mills', email: 'shakil@standardcomposite.com', phone: '+880 1819-334455', role: 'customer', address: 'Industrial Area, Baizid Bostami Road, Chittagong, Bangladesh' },
      { id: 'usr-customer-03', fullName: 'Tasnim Hasan', companyName: 'Meghna Knitwear Cargo', email: 'tasnim@meghnaknit.com', phone: '+880 1912-445566', role: 'customer', address: 'Plot 14, Sector 7, Uttara Model Town, Dhaka 1230, Bangladesh' }
    ];
  }, [users, customers]);

  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((wh) => {
      if (warehouseCountryFilter !== 'all' && wh.country.toLowerCase() !== warehouseCountryFilter.toLowerCase()) {
        return false;
      }
      if (!warehouseSearch.trim()) return true;
      const q = warehouseSearch.trim().toLowerCase();
      return (
        wh.code.toLowerCase().includes(q) ||
        wh.name.toLowerCase().includes(q) ||
        wh.city.toLowerCase().includes(q) ||
        wh.country.toLowerCase().includes(q) ||
        wh.address.toLowerCase().includes(q) ||
        (wh.contactPerson && wh.contactPerson.toLowerCase().includes(q))
      );
    });
  }, [warehouses, warehouseCountryFilter, warehouseSearch]);

  const activeChinaWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.country.toLowerCase() === 'china' && w.isActive);
  }, [warehouses]);

  const originWarehouseList = useMemo(() => {
    if (activeChinaWarehouses.length > 0) return activeChinaWarehouses;
    return [
      {
        id: 'wh-can-01',
        code: 'CAN-GZ',
        name: 'Guangzhou Central Receiving & Intake Hub',
        country: 'China',
        city: 'Guangzhou',
        address: '765, Sanyuanli Avenue, Baiyun District, Guangzhou (广州市白云区三元里大道765号)',
        contactPerson: 'Warehouse Intake Lead',
        phone: '+86 20 8888 1234',
        email: 'gz.ops@goshipping.com.bd',
        capacitySqft: 50000,
        currentOccupancyPct: 65,
        isActive: true
      }
    ];
  }, [activeChinaWarehouses]);

  const selectedOriginWarehouse = useMemo(() => {
    return (
      originWarehouseList.find((w) => w.city.toLowerCase() === newOriginCity.toLowerCase()) ||
      originWarehouseList[0]
    );
  }, [originWarehouseList, newOriginCity]);

  const destinationHubList = useMemo(() => {
    const list: { key: string; label: string; country: string; city: string; warehouse: WarehouseRecord }[] = [];

    // Bangladesh
    const bdWhs = warehouses.filter((w) => w.country.toLowerCase() === 'bangladesh' && w.isActive);
    if (bdWhs.length > 0) {
      bdWhs.forEach((w) => {
        list.push({
          key: `Bangladesh:${w.city}`,
          label: w.city === 'Dhaka' ? 'Dhaka' : w.city,
          country: 'Bangladesh',
          city: w.city,
          warehouse: w
        });
      });
    } else {
      list.push({
        key: 'Bangladesh:Dhaka',
        label: 'Dhaka',
        country: 'Bangladesh',
        city: 'Dhaka',
        warehouse: {
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
        }
      });
    }

    // Malaysia
    const myWhs = warehouses.filter((w) => w.country.toLowerCase() === 'malaysia' && w.isActive);
    if (myWhs.length > 0) {
      myWhs.forEach((w) => {
        list.push({
          key: `Malaysia:${w.city}`,
          label: 'Malaysia',
          country: 'Malaysia',
          city: w.city,
          warehouse: w
        });
      });
    } else {
      list.push({
        key: 'Malaysia:Selangor',
        label: 'Malaysia',
        country: 'Malaysia',
        city: 'Selangor',
        warehouse: {
          id: 'wh-my-01',
          code: 'MY-KUL',
          name: 'Malaysia Receiving & Logistics Hub',
          country: 'Malaysia',
          city: 'Selangor',
          address: 'Lot 2720-B, Jalan Industri 12, Kampung Baru Sungai Buloh, 47000, Selangor.',
          contactPerson: 'GoShipping Malaysia Ops',
          phone: '+60 11-1234 5678',
          email: 'my.ops@goshipping.com.bd',
          capacitySqft: 35000,
          currentOccupancyPct: 42,
          isActive: true
        }
      });
    }

    return list;
  }, [warehouses]);

  const selectedDestWarehouse = useMemo(() => {
    const matched = destinationHubList.find(
      (opt) =>
        opt.country.toLowerCase() === newDestCountry.toLowerCase() &&
        (opt.city.toLowerCase() === newDestCity.toLowerCase() || opt.country.toLowerCase() === 'malaysia')
    );
    return matched?.warehouse || destinationHubList[0]?.warehouse;
  }, [destinationHubList, newDestCountry, newDestCity]);

  const activeDestWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.country.toLowerCase() === newDestCountry.toLowerCase() && w.isActive);
  }, [warehouses, newDestCountry]);

  const customerSelectOptions = useMemo<SearchableSelectOption[]>(() => {
    return allCustomerOptions.map((cust) => ({
      value: cust.id,
      label: cust.companyName ? `${cust.companyName} (${cust.fullName})` : cust.fullName,
      sublabel: `${cust.email} · ${cust.phone || 'No phone recorded'}`,
      badge: cust.role || 'customer'
    }));
  }, [allCustomerOptions]);

  const currentSelectedCustomer = useMemo(() => {
    return (
      users.find((u) => u.id === selectedCustomerId) ||
      customers.find((c) => c.id === selectedCustomerId) ||
      allCustomerOptions.find((c) => c.id === selectedCustomerId)
    );
  }, [users, customers, selectedCustomerId, allCustomerOptions]);

  const selectCustomerForOrder = (target: any) => {
    setSelectedCustomerId(target.id);
    setNewCustName(target.companyName || target.fullName || '');
    setNewRecipientName(target.fullName || '');
    setRecipientContactName(target.fullName || target.companyName || '');
    if (target.phone) {
      setNewRecipientPhone(target.phone);
      const cleaned = target.phone.replace(/\s+/g, '');
      if (cleaned.startsWith('+880')) {
        setRecipientPhoneCode('+880');
        setRecipientPhoneBody(cleaned.slice(4));
      } else if (cleaned.startsWith('+60')) {
        setRecipientPhoneCode('+60');
        setRecipientPhoneBody(cleaned.slice(3));
      } else if (cleaned.startsWith('+86')) {
        setRecipientPhoneCode('+86');
        setRecipientPhoneBody(cleaned.slice(3));
      } else {
        setRecipientPhoneBody(target.phone);
      }
    }
    if (target.address) {
      setNewRecipientAddress(target.address);
      setAddressLine1(target.address);
    }
    setIsCustomerDropdownOpen(false);
  };

  // Email Diagnostics State
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [loadingEmailStatus, setLoadingEmailStatus] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('ops@goshipping.com.bd');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  // Sync tab with URL
  useEffect(() => {
    const handleUrlChange = () => {
      const url = new URL(window.location.href);
      const tabParam = url.searchParams.get('tab');
      if (tabParam && tabParam !== activeTab) {
        setActiveTab(tabParam);
      }
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);

    const handleCustomSwitch = (e: any) => {
      if (e.detail && e.detail !== activeTab) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('switch-dashboard-tab', handleCustomSwitch);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('switch-dashboard-tab', handleCustomSwitch);
    };
  }, [activeTab]);

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new CustomEvent('dashboard-tab-changed', { detail: tab }));
  };

  const loadData = async (manualSync = false) => {
    setLoading(true);
    if (manualSync) setSyncState('syncing');
    try {
      const t = Date.now();
      const fetchOpts: RequestInit = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      };

      const [resShip, resQte, resWh, resCust, resAudit, resUsers] = await Promise.all([
        fetch(`/api/shipments?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, shipments: [] })),
        fetch(`/api/quotes?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, quotes: [] })),
        fetch(`/api/warehouses?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, warehouses: [] })),
        fetch(`/api/admin/customers?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, customers: [] })),
        fetch(`/api/admin/audit-logs?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, logs: [] })),
        fetch(`/api/admin/users?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, users: [] }))
      ]);

      if (resShip.success && resShip.shipments) {
        setShipments(resShip.shipments);
        
      }
      if (resQte.success && resQte.quotes) setQuotes(resQte.quotes);
      if (resWh.success && resWh.warehouses) setWarehouses(resWh.warehouses);
      if (resCust.success && resCust.customers) setCustomers(resCust.customers);
      if (resAudit.success && resAudit.logs) setAuditLogs(resAudit.logs);
      if (resUsers.success && resUsers.users) setUsers(resUsers.users);

      if (manualSync) {
        setSyncState('synced');
        showToast('All operational records synchronized', 'success');
        setTimeout(() => setSyncState('idle'), 2500);
      }
    } catch (err) {
      console.error('Failed to load operational data:', err);
      if (manualSync) {
        setSyncState('error');
        showToast('Failed to sync records with server', 'error');
        setTimeout(() => setSyncState('idle'), 2500);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadEmailStatus = async () => {
    setLoadingEmailStatus(true);
    try {
      const res = await fetch('/api/admin/email/status');
      const data = await res.json();
      if (data.success) {
        setEmailStatus(data);
      }
    } catch (e) {
      console.error('Failed to load email status', e);
    } finally {
      setLoadingEmailStatus(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'email') {
      loadEmailStatus();
    }
  }, [activeTab]);

  const handleVerifyDomain = async () => {
    setVerifyingDomain(true);
    setVerifyMessage(null);
    try {
      const res = await fetch('/api/admin/email/verify', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setVerifyMessage('Domain verification check requested from Resend.');
        await loadEmailStatus();
      } else {
        setVerifyMessage(data.error || 'Verification check failed.');
      }
    } catch (err: any) {
      setVerifyMessage(err.message || 'Network error triggering verification.');
    } finally {
      setVerifyingDomain(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient) return;
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmailRecipient })
      });
      const data = await res.json();
      if (data.success) {
        setTestEmailResult({
          success: true,
          message: `Test email dispatched successfully! ID: ${data.emailId || 'OK'}`
        });
      } else {
        setTestEmailResult({
          success: false,
          message: `Error: ${data.error || data.message || 'Dispatch failed'}`
        });
      }
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: `Network error: ${err.message}`
      });
    } finally {
      setSendingTestEmail(false);
    }
  };



  // Handler: Create Master Consignment & Tracking Order
  const handleCreateConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingConsignment(true);
    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustName = newCustName.trim();
      let finalRecipientName = recipientContactName.trim() || newRecipientName.trim();
      let finalRecipientPhone = compiledPhone || newRecipientPhone.trim();
      let finalRecipientAddress = compiledAddress || newRecipientAddress.trim();

      // If Admin opted to Register New Customer Account on the fly
      if (orderCustomerMode === 'new') {
        if (!newCustomerFullName.trim()) {
          throw new Error('Please enter customer full name.');
        }
        if (!newCustomerEmail.trim() || !newCustomerEmail.includes('@')) {
          throw new Error('Please enter a valid customer email address.');
        }
        if (!newCustomerPhone.trim()) {
          throw new Error('Please enter customer phone/WhatsApp number.');
        }

        const existingAcc = users.find(
          (u) => u.email.toLowerCase() === newCustomerEmail.trim().toLowerCase()
        );

        if (existingAcc) {
          finalCustomerId = existingAcc.id;
          finalCustName = newCustomerCompany.trim() || existingAcc.companyName || existingAcc.fullName;
          finalRecipientName = newCustomerFullName.trim() || existingAcc.fullName;
          finalRecipientPhone = newCustomerPhone.trim() || existingAcc.phone;
          finalRecipientAddress = newCustomerAddress.trim() || existingAcc.address || `${newDestCity}, Bangladesh`;
        } else {
          // Register new user account via API
          const userRes = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: newCustomerFullName.trim(),
              email: newCustomerEmail.trim().toLowerCase(),
              password: newCustomerPassword.trim() || 'password123',
              role: 'customer',
              status: 'active',
              phone: newCustomerPhone.trim(),
              companyName: newCustomerCompany.trim() || newCustomerFullName.trim(),
              address: newCustomerAddress.trim() || `${newDestCity}, Bangladesh`
            })
          });

          if (!userRes.ok) {
            const errData = await userRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to create new customer user account.');
          }

          const createdUser = await userRes.json();
          finalCustomerId = createdUser.user?.id || `usr-${Date.now()}`;
          finalCustName = newCustomerCompany.trim() || newCustomerFullName.trim();
          finalRecipientName = newCustomerFullName.trim();
          finalRecipientPhone = newCustomerPhone.trim();
          finalRecipientAddress = newCustomerAddress.trim() || `${newDestCity}, Bangladesh`;
        }
      } else {
        if (!finalCustomerId) {
          throw new Error('Please select an existing customer account or switch to "Register New Client".');
        }
        if (!finalCustName) {
          finalCustName = currentSelectedCustomer?.companyName || currentSelectedCustomer?.fullName || 'Valued Customer';
        }
        if (!finalRecipientName) {
          finalRecipientName = currentSelectedCustomer?.fullName || finalCustName;
        }
      }

      const invalidItems = orderItems.filter((it) => !it.description.trim() || !(Number(it.weightKg) > 0));
      if (invalidItems.length > 0) {
        throw new Error('Please fill in product description and weight (KG) for all cargo items.');
      }

      if (!newCustomTrackingNumber.trim()) {
        throw new Error('Please enter a tracking number manually for this consignment.');
      }
      const trackingCodeToUse = newCustomTrackingNumber.trim().toUpperCase();

      const finalCustomerEmail =
        orderCustomerMode === 'new'
          ? newCustomerEmail.trim().toLowerCase()
          : currentSelectedCustomer?.email;
      const finalCustomerPhone =
        orderCustomerMode === 'new'
          ? newCustomerPhone.trim()
          : currentSelectedCustomer?.phone;

      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: trackingCodeToUse,
          customerId: finalCustomerId || 'usr-customer-01',
          customerName: finalCustName,
          customerEmail: finalCustomerEmail,
          customerPhone: finalCustomerPhone,
          recipientName: finalRecipientName,
          recipientPhone: finalRecipientPhone,
          recipientAddress: finalRecipientAddress,
          originCountry: newOriginCountry,
          originCity: newOriginCity,
          destCountry: newDestCountry,
          destCity: newDestCity,
          destAddress: finalRecipientAddress,
          mode: newMode,
          serviceLevel: newServiceLevel,
          carrierName: newCarrier,
          voyageOrFlightNumber: newVoyage,
          totalWeightKg: orderTotals.totalWeight || 500,
          totalCbm: orderTotals.totalCbm || 2.5,
          totalPieces: orderTotals.totalPieces || 1,
          notes: deliveryNotes.trim() || deliveryInstructions.trim(),
          items: orderItems.map((it, idx) => ({
            itemCode: `#ITM-${1000 + idx}`,
            description: it.description.trim() || 'Commercial Cargo Item',
            packagingType: it.packagingType,
            quantity: Number(it.quantity) || 1,
            weightKg: Number(it.weightKg) || 10,
            cbm: Number(it.cbm) || 0.05,
            categoryTag: it.categoryTag,
            declaredValue: Number(it.declaredValue) || undefined,
            currency: 'BDT'
          }))
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to create consignment');
      }

      const data = await res.json();

      // If initial status is not purchased, advance status immediately
      if (newInitialStatus && newInitialStatus !== 'purchased') {
        await fetch(`/api/shipments/${data.shipment.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newInitialStatus })
        });
      }

      setCreatedShipmentResult({
        trackingNumber: data.shipment.trackingNumber,
        customerName: finalCustName,
        route: `${newOriginCity} → ${newDestCity}`,
        mode: newMode.toUpperCase()
      });

      setShowConsignmentModal(false);
      setCustomerSearchQuery('');
      setNewCustomerFullName('');
      setNewCustomerEmail('');
      setNewCustomerPhone('');
      setNewCustomerCompany('');
      setNewCustomerAddress('');
      setNewInitialStatus('purchased');
      showToast(`Order ${data.shipment.trackingNumber} created with ${orderItems.length} products!`, 'success');
      loadData(false);
      switchTab('orders');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingConsignment(false);
    }
  };

  // Handler: Quick Status Update with Immediate Feedback & Optimistic UI
  const handleQuickStatusUpdate = async (id: string, newStatus: string) => {
    const norm = normalizeStatusCode(newStatus);
    const statusDef = TRACKING_STATUSES[norm];
    const newLabel = statusDef ? statusDef.label : norm.toUpperCase();

    // 1. Optimistic Instant UI Update - 0ms response
    setShipments((prev) =>
      prev.map((s) => {
        if (s.id === id || s.trackingNumber === id) {
          const updatedEvents = [
            {
              id: `evt-opt-${Date.now()}`,
              shipmentId: s.id,
              status: norm,
              statusCode: norm,
              statusLabel: newLabel,
              title: newLabel,
              description: statusDef?.defaultDescription || 'Status updated',
              locationName: statusDef?.defaultLocation || s.currentLocation,
              eventTime: new Date().toISOString(),
              occurredAtBst: 'Just now',
              source: 'admin' as const,
              visibility: 'public' as const,
              eventVersion: (s.eventVersion || 1) + 1
            },
            ...s.events
          ];
          return {
            ...s,
            status: norm,
            statusCode: norm,
            statusLabel: newLabel,
            currentLocation: statusDef?.defaultLocation || s.currentLocation,
            events: updatedEvents,
            physicalProgress: calculatePhysicalProgress(norm, updatedEvents)
          };
        }
        return s;
      })
    );

    // Immediate notification banner
    const target = shipments.find((s) => s.id === id || s.trackingNumber === id);
    if (target) {
      setLiveStatusFeedback({
        trackingNumber: target.trackingNumber,
        newStatus: norm,
        statusLabel: newLabel
      });

      // Cross-tab & in-window 0ms instant synchronizations
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('goshipping-status-updated', {
            detail: { trackingNumber: target.trackingNumber, newStatus: norm, statusLabel: newLabel }
          })
        );
        try {
          const bc = new BroadcastChannel('goshipping_tracking_sync');
          bc.postMessage({
            type: 'SHIPMENT_STATUS_UPDATED',
            trackingNumber: target.trackingNumber,
            newStatus: norm,
            statusLabel: newLabel,
            timestamp: Date.now()
          });
          bc.close();
        } catch (e) {}

        try {
          localStorage.setItem(
            'goshipping_live_sync',
            JSON.stringify({ code: target.trackingNumber, status: norm, time: Date.now() })
          );
        } catch (e) {}
      }
    }

    // 2. Persist to API
    try {
      const res = await fetch(`/api/shipments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: norm })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Status update failed');
      }
      const data = await res.json();
      if (data.shipment) {
        setShipments((prev) =>
          prev.map((s) => (s.id === data.shipment.id || s.trackingNumber === data.shipment.trackingNumber ? data.shipment : s))
        );
      }
    } catch (err: any) {
      alert(`Status update error: ${err.message}`);
      loadData(); // Revert on network failure
    }
  };

  // Handler: Instant Overview Stage Update
  const handleInstantOverviewStatusUpdate = async () => {
    const targetShipment = shipments.find((s) => s.id === quickShipmentId || s.trackingNumber === quickShipmentId) || shipments[0];
    if (!targetShipment) return;
    setUpdatingQuickStage(true);
    try {
      await handleQuickStatusUpdate(targetShipment.id, quickTargetStage);
    } finally {
      setUpdatingQuickStage(false);
    }
  };

  // Handler: Delete Shipment
  const handleDeleteShipment = async (id: string, trackingNumber: string) => {
    if (!confirm(`Are you sure you want to permanently delete order ${trackingNumber}?`)) return;
    try {
      const res = await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handler: Price Quote
  const handlePriceQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuoteForPricing) return;
    setSubmittingPricing(true);
    try {
      const res = await fetch(`/api/quotes/${selectedQuoteForPricing.id}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseFreightCharge: parseFloat(baseFreight) || 150000,
          fuelSurcharge: parseFloat(fuelSurcharge) || 12000,
          customsClearanceFee: parseFloat(customsClearanceFee) || 10000,
          handlingFee: parseFloat(handlingFee) || 5000,
          currency: 'BDT',
          notes: pricingNotes
        })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to price quote');
      }
      alert(`Quote ${selectedQuoteForPricing.quoteNumber} priced successfully!`);
      setShowPricingModal(false);
      setSelectedQuoteForPricing(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingPricing(false);
    }
  };

  // Handler: Convert Quote to Shipment
  const handleConvertQuote = async (quoteId: string, quoteNumber: string) => {
    if (!confirm(`Convert quote ${quoteNumber} into an active operational shipment?`)) return;
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert`, { method: 'POST' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to convert quote');
      }
      const data = await res.json();
      alert(`Quote converted into shipment: ${data.shipmentId}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // =========================================================
  // USER MANAGEMENT HANDLERS (Ghost Login, Suspend, CRUD)
  // =========================================================
  const handleImpersonateUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to log in as "${userName}"? You will view the portal directly through this user's profile without needing their password.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/impersonate/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to impersonate user');
      window.location.href = data.redirectUrl || '/dashboard';
    } catch (err: any) {
      alert(err.message || 'Impersonation failed');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const actionName = currentStatus === 'active' ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${actionName} this user account?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user status');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Status toggle failed');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to permanently delete user "${userName}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      loadData();
    } catch (err: any) {
      alert(err.message || 'User deletion failed');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUser(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: userFullName,
          email: userEmail,
          password: userPassword || 'password',
          role: userRole,
          status: userStatus,
          phone: userPhone,
          companyName: userCompanyName || userFullName,
          address: userAddress,
          binNumber: userBin
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      alert(`User profile created successfully for ${data.user.fullName}!`);
      setShowAddUserModal(false);
      resetUserForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating user');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    setSubmittingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: userFullName,
          email: userEmail,
          role: userRole,
          status: userStatus,
          phone: userPhone,
          companyName: userCompanyName,
          address: userAddress,
          binNumber: userBin
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      alert('User profile updated successfully!');
      setShowEditUserModal(false);
      resetUserForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating user');
    } finally {
      setSubmittingUser(false);
    }
  };

  const openEditUserModal = (u: any) => {
    setEditingUserId(u.id);
    setUserFullName(u.fullName || '');
    setUserEmail(u.email || '');
    setUserRole(u.role || 'customer');
    setUserStatus(u.status || 'active');
    setUserPhone(u.phone || '');
    setUserCompanyName(u.companyName || '');
    setUserAddress(u.address || '');
    setUserBin(u.binNumber || '');
    setShowEditUserModal(true);
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserFullName('');
    setUserEmail('');
    setUserPassword('password');
    setUserRole('customer');
    setUserStatus('active');
    setUserPhone('');
    setUserCompanyName('');
    setUserAddress('');
    setUserBin('');
  };

  // Warehouse Facility Management Handlers
  const openAddWarehouseModal = () => {
    setWhCode('');
    setWhName('');
    setWhCountry('China');
    setWhCity('Guangzhou');
    setWhAddress('');
    setWhContactPerson('');
    setWhPhone('+86 20 8888 0000');
    setWhEmail('ops@goshipping.com.bd');
    setWhCapacitySqft(35000);
    setWhCurrentOccupancyPct(50);
    setWhIsActive(true);
    setShowAddWarehouseModal(true);
  };

  const openEditWarehouseModal = (wh: WarehouseRecord) => {
    setSelectedWarehouse(wh);
    setWhCode(wh.code);
    setWhName(wh.name);
    setWhCountry(wh.country);
    setWhCity(wh.city);
    setWhAddress(wh.address);
    setWhContactPerson(wh.contactPerson || '');
    setWhPhone(wh.phone || '');
    setWhEmail(wh.email || '');
    setWhCapacitySqft(wh.capacitySqft || 25000);
    setWhCurrentOccupancyPct(wh.currentOccupancyPct || 50);
    setWhIsActive(wh.isActive !== undefined ? wh.isActive : true);
    setShowEditWarehouseModal(true);
  };

  const openDeleteWarehouseModal = (wh: WarehouseRecord) => {
    setSelectedWarehouse(wh);
    setShowDeleteWarehouseModal(true);
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWarehouse(true);
    try {
      const res = await fetch('/api/admin/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: whCode.trim().toUpperCase(),
          name: whName.trim(),
          country: whCountry.trim(),
          city: whCity.trim(),
          address: whAddress.trim(),
          contactPerson: whContactPerson.trim(),
          phone: whPhone.trim(),
          email: whEmail.trim(),
          capacitySqft: Number(whCapacitySqft) || 20000,
          currentOccupancyPct: Number(whCurrentOccupancyPct) || 0,
          isActive: whIsActive
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create warehouse');
      }

      const data = await res.json();
      showToast(`Warehouse facility ${data.warehouse.code} created successfully.`);
      setShowAddWarehouseModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Error creating warehouse: ${err.message}`);
    } finally {
      setSubmittingWarehouse(false);
    }
  };

  const handleUpdateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    setSubmittingWarehouse(true);
    try {
      const res = await fetch(`/api/admin/warehouses/${selectedWarehouse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: whCode.trim().toUpperCase(),
          name: whName.trim(),
          country: whCountry.trim(),
          city: whCity.trim(),
          address: whAddress.trim(),
          contactPerson: whContactPerson.trim(),
          phone: whPhone.trim(),
          email: whEmail.trim(),
          capacitySqft: Number(whCapacitySqft) || 20000,
          currentOccupancyPct: Number(whCurrentOccupancyPct) || 0,
          isActive: whIsActive
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update warehouse');
      }

      showToast(`Warehouse facility ${whCode.toUpperCase()} updated successfully.`);
      setShowEditWarehouseModal(false);
      setSelectedWarehouse(null);
      await loadData();
    } catch (err: any) {
      alert(`Error updating warehouse: ${err.message}`);
    } finally {
      setSubmittingWarehouse(false);
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!selectedWarehouse) return;
    setDeletingWarehouse(true);
    try {
      const res = await fetch(`/api/admin/warehouses/${selectedWarehouse.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete warehouse');
      }

      showToast(`Warehouse facility ${selectedWarehouse.code} deleted successfully.`);
      setShowDeleteWarehouseModal(false);
      setSelectedWarehouse(null);
      await loadData();
    } catch (err: any) {
      alert(`Error deleting warehouse: ${err.message}`);
    } finally {
      setDeletingWarehouse(false);
    }
  };

  // Filtered shipments
  const filteredShipments = shipments.filter((s) => {
    const q = shipmentSearch.toLowerCase();
    const matchesQ =
      !q ||
      s.trackingNumber.toLowerCase().includes(q) ||
      s.customerName.toLowerCase().includes(q) ||
      s.originCity.toLowerCase().includes(q) ||
      s.destCity.toLowerCase().includes(q) ||
      s.voyageOrFlightNumber.toLowerCase().includes(q);

    const matchesMode = shipmentModeFilter === 'all' || s.mode === shipmentModeFilter;
    const matchesStatus = shipmentStatusFilter === 'all' || s.status === shipmentStatusFilter;

    return matchesQ && matchesMode && matchesStatus;
  });

  // Filtered quotes
  const filteredQuotes = quotes.filter((q) => {
    const query = quoteSearch.toLowerCase();
    const matchesQuery =
      !query ||
      q.quoteNumber.toLowerCase().includes(query) ||
      q.guestName.toLowerCase().includes(query) ||
      q.guestEmail.toLowerCase().includes(query) ||
      q.originCity.toLowerCase().includes(query) ||
      q.destCity.toLowerCase().includes(query);

    const matchesStatus = quoteStatusFilter === 'all' || q.status === quoteStatusFilter;
    return matchesQuery && matchesStatus;
  });

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const query = userSearch.toLowerCase();
    const matchesQuery =
      !query ||
      u.fullName?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.companyName?.toLowerCase().includes(query) ||
      u.phone?.toLowerCase().includes(query);

    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'all' || u.status === userStatusFilter;

    return matchesQuery && matchesRole && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-50 text-green-700 border-green-300';
      case 'out_for_delivery':
        return 'bg-orange-50 text-orange-700 border-orange-300';
      case 'payment_received':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'bd_warehouse_received':
        return 'bg-sky-50 text-sky-700 border-sky-300';
      case 'awaiting_customs':
      case 'customs_clearance':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'arrived_dhaka_airport':
        return 'bg-purple-50 text-purple-700 border-purple-300';
      case 'dispatched_from_china':
      case 'in_transit':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
      case 'cn_warehouse_received':
      case 'warehouse_received':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'purchased':
      case 'order_created':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getQuoteBadge = (status: string) => {
    switch (status) {
      case 'priced':
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'converted':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
      case 'under_review':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  // KPIs
  const activeConsignmentsCount = shipments.filter((s) => s.status !== 'delivered').length;
  const inTransitAirCount = shipments.filter((s) => s.mode === 'air' && s.status === 'in_transit').length;
  const seaContainersCount = shipments.filter((s) => s.mode === 'sea').length;
  const pendingQuotesCount = quotes.filter((q) => q.status === 'submitted' || q.status === 'under_review').length;

  const getAdminHeaderDetails = (tab: string) => {
    switch (tab) {
      case 'shipments':
      case 'tracking':
      case 'orders':
        return {
          title: 'Orders & Live Tracking',
          subtitle: 'Manage shipments, update delivery status, and view routes'
        };
      case 'quotes':
        return {
          title: 'Price Quotes',
          subtitle: 'Review customer quote requests and update pricing'
        };
      case 'invoices':
      case 'invoice':
        return {
          title: 'Invoices & Billing',
          subtitle: 'Manage client invoices, payment status, and tax receipts'
        };
      case 'warehouses':
        return {
          title: 'Warehouse Locations',
          subtitle: 'Addresses and contact info for China and Bangladesh warehouses'
        };
      case 'users':
        return {
          title: 'Users & Staff',
          subtitle: 'Manage user accounts, roles, and admin permissions'
        };
      case 'customers':
        return {
          title: 'Customers',
          subtitle: 'Customer accounts, contact details, and order history'
        };
      case 'audit':
        return {
          title: 'Activity Logs',
          subtitle: 'History of admin actions, logins, and status updates'
        };
      case 'email':
        return {
          title: 'Email Service & Status',
          subtitle: 'Email delivery status, notification logs, and settings'
        };
      case 'new_order':
        return {
          title: 'Create Consignment Order',
          subtitle: 'Add multiple cargo products, configure linehaul route, and initialize live tracking'
        };
      case 'overview':
      default:
        return {
          title: 'Admin Dashboard',
          subtitle: 'Overview of shipments, warehouse activity, and delivery status'
        };
    }
  };

  const headerDetails = getAdminHeaderDetails(activeTab);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-['Inter',sans-serif]">
      {/* Top Application Header Bar - Left-Hand Centric with Title, Status & Actions */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Sidebar Hamburger Toggle */}
          <button
            type="button"
            id="admin-mobile-menu-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-none cursor-pointer"
            aria-label="Open navigation sidebar"
          >
            <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-['Manrope',sans-serif] truncate">
            {headerDetails.title}
          </h1>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">



          {/* 3. + New Order Button / Back to Orders Button */}
          {activeTab === 'new_order' ? (
            <button
              type="button"
              onClick={() => switchTab('orders')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-none shadow-2xs cursor-pointer"
              title="Return to Orders list"
            >
              <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to Orders</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewCustomTrackingNumber('');
                switchTab('new_order');
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--color-brand-primary)] text-white text-xs font-bold hover:opacity-90 transition-none shadow-xs cursor-pointer"
              title="Create New Consignment Order"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Order</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
        {/* KPI COUNTER CARDS (Visible across overview, orders, quotes, etc.) */}
        {activeTab !== 'new_order' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Shipments</span>
              <div className="text-2xl font-bold text-slate-900 font-['Manrope',sans-serif] tabular-nums">
                {activeConsignmentsCount || shipments.length}
              </div>
              <p className="text-xs text-slate-500">China ⇄ Bangladesh shipments</p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Air Freight in Transit</span>
              <div className="text-2xl font-bold text-sky-600 font-['Manrope',sans-serif] tabular-nums">
                {inTransitAirCount || 1}
              </div>
              <p className="text-xs text-slate-500">Active flights with tracking</p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sea Freight in Transit</span>
              <div className="text-2xl font-bold text-indigo-600 font-['Manrope',sans-serif] tabular-nums">
                {seaContainersCount || 2}
              </div>
              <p className="text-xs text-slate-500">Cargo ships & port arrivals</p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Quotes</span>
              <div className="text-2xl font-bold text-amber-600 font-['Manrope',sans-serif] tabular-nums">
                {pendingQuotesCount}
              </div>
              <p className="text-xs text-slate-500">Waiting for price review</p>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: OVERVIEW (Default Dashboard Command Center)           */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* SUPER ADMIN LIVE TRACKER CONTROL CENTER */}
            <div className="bg-gradient-to-r from-red-50/90 via-rose-50/40 to-slate-50 border-2 border-red-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#EA1D2C] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                        Quick Tracking &amp; Orders
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EA1D2C] text-white uppercase tracking-wider font-mono">
                        Super Admin
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Create tracking orders, assign tracking codes, and update delivery status in real time.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomTrackingNumber('');
                      switchTab('new_order');
                    }}
                    className="px-4 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-none"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Create Tracking Order</span>
                  </button>
                </div>
              </div>

              {/* 3 Quick Action Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Block 1: Create Order */}
                <div className="p-4 rounded-xl bg-white border border-red-100 shadow-2xs space-y-2 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#EA1D2C] uppercase tracking-wider">Order Creation</span>
                    <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif] mt-0.5">
                      Create New Order
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      Register goods from China supplier, set receiver info, and generate a tracking number (e.g. <code className="font-mono text-[#EA1D2C]">GOSH-2026-XXXX</code>).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomTrackingNumber('');
                      switchTab('new_order');
                    }}
                    className="w-full py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[#EA1D2C] text-xs font-bold transition-none cursor-pointer text-center"
                  >
                    + Open Order Form
                  </button>
                </div>

                {/* Block 2: 1-Click Instant Live Status Changer */}
                <div className="p-4 rounded-xl bg-white border border-indigo-100 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider">Status Update</span>
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Update Shipment Status
                  </h3>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Select Shipment</label>
                      <select
                        value={quickShipmentId || (shipments[0]?.id || '')}
                        onChange={(e) => {
                          const newId = e.target.value;
                          setQuickShipmentId(newId);
                          const found = shipments.find((s) => s.id === newId || s.trackingNumber === newId);
                          if (found) {
                            setQuickTargetStage(normalizeStatusCode(found.status));
                          }
                        }}
                        className="w-full h-8 px-2 text-[11px] font-mono font-bold rounded-md border border-slate-300 bg-slate-50 text-slate-900"
                      >
                        {shipments.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.trackingNumber} — {s.customerName} ({s.status.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">New Status</label>
                      <select
                        value={quickTargetStage}
                        onChange={(e) => setQuickTargetStage(e.target.value)}
                        className="w-full h-8 px-2 text-[11px] font-semibold rounded-md border border-indigo-300 bg-indigo-50/60 text-indigo-900"
                      >
                        <option value="purchased">PURCHASED</option>
                        <option value="cn_warehouse_received">CN WAREHOUSE RECEIVED</option>
                        <option value="dispatched_from_china">DISPATCHED FROM CHINA</option>
                        <option value="arrived_dhaka_airport">ARRIVED DHAKA AIRPORT</option>
                        <option value="awaiting_customs">AWAITING CUSTOMS</option>
                        <option value="bd_warehouse_received">BD WAREHOUSE RECEIVED</option>
                        <option value="payment_received">PAYMENT RECEIVED</option>
                        <option value="out_for_delivery">OUT FOR DELIVERY</option>
                        <option value="delivered">DELIVERED</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={updatingQuickStage || shipments.length === 0}
                      onClick={handleInstantOverviewStatusUpdate}
                      className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-none cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {updatingQuickStage ? 'Updating Status…' : 'Update Status'}
                    </button>
                  </div>
                </div>

                {/* Block 3: Public Tracker Preview */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Verification</span>
                    <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif] mt-0.5">
                      View Public Tracker
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      Check how customers see the physical progress bar and live updates on the tracking portal.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {shipments.length > 0 && (
                      <a
                        href={`/tracking?code=${encodeURIComponent(shipments[0]?.trackingNumber || 'GOSH-2026-9812')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 rounded-lg border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-none cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Open {shipments[0]?.trackingNumber} Tracker</span>
                        <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Update Feedback Banner */}
              {liveStatusFeedback && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>
                      Tracker for <strong>{liveStatusFeedback.trackingNumber}</strong> updated to <strong>{liveStatusFeedback.statusLabel}</strong>!
                    </span>
                  </div>
                  <a
                    href={`/tracking?code=${encodeURIComponent(liveStatusFeedback.trackingNumber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 shrink-0 inline-flex items-center gap-1"
                  >
                    <span>View Public Tracker</span>
                    <span>↗</span>
                  </a>
                </div>
              )}
            </div>

            {/* Corridor Status Notification Banner */}
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></div>
                <div>
                  <h3 className="text-xs font-bold text-emerald-950 font-['Manrope',sans-serif]">
                    China to Bangladesh &amp; Malaysia Shipping Routes are Active
                  </h3>
                  <p className="text-[11px] text-emerald-700">
                    Guangzhou, Dhaka, and Selangor facilities are receiving and dispatching packages normally.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => switchTab('shipments')}
                  className="px-3 py-1.5 rounded-md bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-colors"
                >
                  View All Orders →
                </button>
              </div>
            </div>

            {/* Split Grid: Recent Consignments & Pending Quotations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Recent Consignments */}
              <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Recent Orders
                    </h2>
                    <p className="text-xs text-slate-500">Latest shipments and live tracking updates</p>
                  </div>
                  <button
                    onClick={() => switchTab('shipments')}
                    className="text-xs font-bold text-[#EA1D2C] hover:underline"
                  >
                    View All ({shipments.length})
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Tracking Code</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Route &amp; Carrier</th>
                        <th className="py-2.5 px-3">Status (Click to update)</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shipments.slice(0, 5).map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            <div>{s.trackingNumber}</div>
                            <a
                              href={`/tracking?code=${encodeURIComponent(s.trackingNumber)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[#EA1D2C] hover:underline flex items-center gap-1 font-sans mt-0.5"
                            >
                              <span>Public View</span>
                              <span>↗</span>
                            </a>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{s.customerName}</div>
                            <div className="text-[10px] text-slate-400">{s.items.length} units · {s.totalWeightKg} KG</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-800">
                              {s.originCity} → {s.destCity}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono uppercase">{s.mode} · {s.voyageOrFlightNumber}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={normalizeStatusCode(s.status)}
                              onChange={(e) => handleQuickStatusUpdate(s.id, e.target.value)}
                              className={`appearance-none px-2 py-1 rounded text-[11px] font-bold border cursor-pointer ${getStatusBadge(normalizeStatusCode(s.status))}`}
                              title="Click to update live tracker status"
                            >
                              <option value="purchased">PURCHASED</option>
                              <option value="cn_warehouse_received">CN WAREHOUSE RECEIVED</option>
                              <option value="dispatched_from_china">DISPATCHED FROM CHINA</option>
                              <option value="arrived_dhaka_airport">ARRIVED DHAKA AIRPORT</option>
                              <option value="awaiting_customs">AWAITING CUSTOMS CLEARANCE</option>
                              <option value="bd_warehouse_received">BD WAREHOUSE RECEIVED</option>
                              <option value="payment_received">PAYMENT RECEIVED</option>
                              <option value="out_for_delivery">OUT FOR DELIVERY</option>
                              <option value="delivered">DELIVERED</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/tracking?code=${encodeURIComponent(s.trackingNumber)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-none inline-flex items-center gap-0.5"
                                title="Open Live Tracker"
                              >
                                <span>Track</span>
                                <span className="text-[10px]">↗</span>
                              </a>

                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Col: Pending Rate Inquiries Queue */}
              <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                        Recent Quotes
                      </h2>
                      <p className="text-xs text-slate-500">Price requests waiting for review</p>
                    </div>
                    <button
                      onClick={() => switchTab('quotes')}
                      className="text-xs font-bold text-[#EA1D2C] hover:underline"
                    >
                      All ({quotes.length})
                    </button>
                  </div>

                  <div className="space-y-3">
                    {quotes.slice(0, 4).map((q) => (
                      <div key={q.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors space-y-2 bg-slate-50/40">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-900">{q.quoteNumber}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getQuoteBadge(q.status)}`}>
                            {q.status}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-800">
                          {q.guestName} ({q.originCity} → {q.destCity})
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{q.totalWeightKg} KG · {q.totalCbm} CBM</span>
                          {q.status === 'submitted' || q.status === 'under_review' ? (
                            <button
                              onClick={() => {
                                setSelectedQuoteForPricing(q);
                                setShowPricingModal(true);
                              }}
                              className="px-2 py-0.5 rounded bg-[#EA1D2C] text-white text-[10px] font-bold hover:bg-[#D41523] transition-colors"
                            >
                              Set Price →
                            </button>
                          ) : (
                            <span className="font-bold text-emerald-700 font-mono">
                              ৳{q.revisions[0]?.totalAmount.toLocaleString()} BDT
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {quotes.length === 0 && (
                      <p className="text-xs text-slate-400 py-4 text-center">No quotation requests found</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => switchTab('quotes')}
                  className="w-full py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors text-center block mt-3"
                >
                  Manage All Quotations & Pricing →
                </button>
              </div>
            </div>

            {/* Warehouse Hubs Summary Section */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                    China &amp; Bangladesh Warehouse Locations
                  </h2>
                  <p className="text-xs text-slate-500">Storage capacity, inbound receiving, and consolidation status</p>
                </div>
                <button
                  onClick={() => switchTab('warehouses')}
                  className="text-xs font-bold text-[#EA1D2C] hover:underline"
                >
                  View Details ({warehouses.length})
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {warehouses.map((wh) => (
                  <div key={wh.id} className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors space-y-3 bg-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                            {wh.code}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate max-w-[160px]">
                            {wh.city}, {wh.country}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium mt-1 truncate">{wh.name}</p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Hub"></span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Capacity Occupancy</span>
                        <span className="font-mono font-bold text-slate-800">{wh.currentOccupancyPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            wh.currentOccupancyPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${wh.currentOccupancyPct}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{wh.capacitySqft.toLocaleString()} sqft</span>
                      <span className="font-medium text-slate-700">{wh.contactPerson}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: CREATE NEW CONSIGNMENT ORDER (DEDICATED FULL PAGE)   */}
        {/* ========================================================= */}
        {activeTab === 'new_order' && (
          <div className="space-y-6 max-w-7xl mx-auto pb-12 font-['Inter',sans-serif]">
            {/* Top Page Header & Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-[#EA1D2C] border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C] animate-pulse"></span>
                    Consignment Dispatch Page
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[11px] font-mono text-slate-500">Live Multi-Product Manifest</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-['Manrope',sans-serif] tracking-tight">
                  Create Consignment Order
                </h2>
                <p className="text-xs text-slate-500">
                  Assign client, configure international shipping route, add multiple cargo products, and generate live tracking code.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => switchTab('orders')}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-none cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Back to Orders</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateConsignment} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: 4 FORM SECTIONS (lg:col-span-8) */}
              <div className="lg:col-span-8 space-y-6">

                {/* 1. CUSTOMER ACCOUNT & CLIENT ASSIGNMENT */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 font-['Manrope',sans-serif]">
                        1. Customer Assignment
                      </h3>
                      <p className="text-xs text-slate-500">
                        Link order to an existing registered customer or onboard a new client
                      </p>
                    </div>

                    {/* Toggle: Existing vs New */}
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setOrderCustomerMode('existing')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-none cursor-pointer ${
                          orderCustomerMode === 'existing'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Existing Client
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderCustomerMode('new')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-none cursor-pointer ${
                          orderCustomerMode === 'new'
                            ? 'bg-white text-[#EA1D2C] shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        + Register New Client
                      </button>
                    </div>
                  </div>

                  {orderCustomerMode === 'existing' ? (
                    <div className="space-y-3 pt-1">
                      <SearchableSelect
                        label="Customer Account"
                        required
                        value={selectedCustomerId}
                        onChange={(newVal) => {
                          const found = allCustomerOptions.find((c) => c.id === newVal);
                          if (found) selectCustomerForOrder(found);
                        }}
                        options={customerSelectOptions}
                        placeholder="Click to select or search customer (e.g. Apex Textiles Ltd)..."
                        searchPlaceholder="Type customer name, company, email, phone or BIN number..."
                      />

                      {/* Display auto-filled customer coordinates badge */}
                      {currentSelectedCustomer && (
                        <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="font-bold text-slate-900">
                              {currentSelectedCustomer.companyName || currentSelectedCustomer.fullName}
                            </span>
                            <span className="text-emerald-800 font-mono text-[11px]">
                              ({currentSelectedCustomer.email} · {currentSelectedCustomer.phone || 'No phone'})
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                            Auto-filled into Delivery Address
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* On-The-Fly New Customer Registration Form */
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            value={newCustomerFullName}
                            onChange={(e) => {
                              setNewCustomerFullName(e.target.value);
                              if (!newRecipientName) setNewRecipientName(e.target.value);
                            }}
                            placeholder="e.g. Tarek Rahman"
                            required={orderCustomerMode === 'new'}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Company Name (Optional)
                          </label>
                          <input
                            type="text"
                            value={newCustomerCompany}
                            onChange={(e) => setNewCustomerCompany(e.target.value)}
                            placeholder="e.g. Prime Apparels BD Ltd"
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Email Address (for Live Status Alerts) *
                          </label>
                          <input
                            type="email"
                            value={newCustomerEmail}
                            onChange={(e) => setNewCustomerEmail(e.target.value)}
                            placeholder="client@company.com"
                            required={orderCustomerMode === 'new'}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Phone / WhatsApp *
                          </label>
                          <input
                            type="tel"
                            value={newCustomerPhone}
                            onChange={(e) => {
                              setNewCustomerPhone(e.target.value);
                              setNewRecipientPhone(e.target.value);
                            }}
                            placeholder="+880 1711-XXXXXX"
                            required={orderCustomerMode === 'new'}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Default Delivery Address
                          </label>
                          <input
                            type="text"
                            value={newCustomerAddress}
                            onChange={(e) => {
                              setNewCustomerAddress(e.target.value);
                              setNewRecipientAddress(e.target.value);
                            }}
                            placeholder="Plot 12, Sector 3, Uttara, Dhaka"
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Initial Portal Password
                          </label>
                          <input
                            type="text"
                            value={newCustomerPassword}
                            onChange={(e) => setNewCustomerPassword(e.target.value)}
                            placeholder="password123"
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. ROUTE & SHIPPING METHOD (Matches Image 1) */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900 font-['Manrope',sans-serif]">
                      2. Route &amp; Shipping Method
                    </h3>
                    <p className="text-xs text-slate-500">
                      Specify origin China hub, destination (Bangladesh / Malaysia), carrier, and flight/voyage details
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Origin Hub (China) */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-slate-800">
                            Origin Hub (China)
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {originWarehouseList.length} Active
                          </span>
                        </div>

                        {/* Radio Buttons for Origin */}
                        <div className="flex flex-wrap gap-2">
                          {originWarehouseList.map((wh) => {
                            const isSelected = newOriginCity.toLowerCase() === wh.city.toLowerCase();
                            return (
                              <label
                                key={wh.id}
                                className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-none ${
                                  isSelected
                                    ? 'border-[#EA1D2C] bg-red-50/60 text-[#EA1D2C] ring-1 ring-[#EA1D2C]'
                                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="originHubRadio"
                                  value={wh.city}
                                  checked={isSelected}
                                  onChange={() => {
                                    setNewOriginCity(wh.city);
                                    setNewOriginCountry('China');
                                  }}
                                  className="w-3.5 h-3.5 text-[#EA1D2C] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#EA1D2C]"
                                />
                                <span>{wh.city}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected Origin Warehouse Address Box */}
                      {selectedOriginWarehouse && (
                        <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-500 mb-0.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
                              <span>📍</span> Warehouse Address
                            </span>
                            <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold text-slate-700">
                              {selectedOriginWarehouse.code}
                            </span>
                          </div>
                          <p className="text-slate-800 font-medium leading-relaxed">
                            {selectedOriginWarehouse.address}
                          </p>
                          {selectedOriginWarehouse.phone && (
                            <div className="pt-1 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
                              <span>Intake Contact</span>
                              <span className="font-mono text-slate-700">{selectedOriginWarehouse.phone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. Destination Hub (BD / MY) */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-slate-800">
                            Destination Hub
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">
                            BD / MY
                          </span>
                        </div>

                        {/* Radio Buttons for Destination Hub */}
                        <div className="flex flex-wrap gap-2">
                          {destinationHubList.map((opt) => {
                            const isSelected =
                              newDestCountry.toLowerCase() === opt.country.toLowerCase() &&
                              (newDestCity.toLowerCase() === opt.city.toLowerCase() || opt.country.toLowerCase() === 'malaysia');
                            return (
                              <label
                                key={opt.key}
                                className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-none ${
                                  isSelected
                                    ? 'border-[#EA1D2C] bg-red-50/60 text-[#EA1D2C] ring-1 ring-[#EA1D2C]'
                                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="destHubRadio"
                                  value={opt.key}
                                  checked={isSelected}
                                  onChange={() => {
                                    if (opt.country !== newDestCountry) {
                                      handleCountryChange(opt.country);
                                    }
                                    setNewDestCity(opt.city);
                                    setRecipientCity(opt.city);
                                  }}
                                  className="w-3.5 h-3.5 text-[#EA1D2C] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#EA1D2C]"
                                />
                                <span>{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected Destination Warehouse Address Box */}
                      {selectedDestWarehouse && (
                        <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-500 mb-0.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
                              <span>📍</span> Warehouse Address
                            </span>
                            <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold text-slate-700">
                              {selectedDestWarehouse.code}
                            </span>
                          </div>
                          <p className="text-slate-800 font-medium leading-relaxed">
                            {selectedDestWarehouse.address}
                          </p>
                          {selectedDestWarehouse.phone && (
                            <div className="pt-1 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
                              <span>Dispatch Hub</span>
                              <span className="font-mono text-slate-700">{selectedDestWarehouse.phone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. Shipping Method */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-slate-800">
                            Shipping Method
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">
                            3 Modes
                          </span>
                        </div>

                        {/* Radio Buttons for Shipping Method */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { mode: 'air', label: 'By Air' },
                            { mode: 'sea', label: 'By Ship' },
                            { mode: 'hand_carry', label: 'Hand Carry' }
                          ].map((m) => {
                            const isSelected = newMode === m.mode;
                            return (
                              <label
                                key={m.mode}
                                className={`flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-none ${
                                  isSelected
                                    ? 'border-[#EA1D2C] bg-red-50/60 text-[#EA1D2C] ring-1 ring-[#EA1D2C]'
                                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="shippingModeRadio"
                                  value={m.mode}
                                  checked={isSelected}
                                  onChange={() => setNewMode(m.mode as any)}
                                  className="w-3.5 h-3.5 text-[#EA1D2C] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#EA1D2C]"
                                />
                                <span className="whitespace-nowrap">{m.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected Shipping Mode SLA Box */}
                      <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-500 mb-0.5">
                          <span className="font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
                            <span>⚡</span> Transit SLA
                          </span>
                          <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold text-[#EA1D2C]">
                            {newMode === 'air' ? '7–14 Days' : newMode === 'sea' ? '30–45 Days' : '24–48 Hours'}
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium leading-relaxed">
                          {newMode === 'air'
                            ? 'Direct scheduled air cargo flight to destination airport hub.'
                            : newMode === 'sea'
                            ? 'Economical sea container freight with full port handling.'
                            : 'Fast personal courier hand-carry transfer directly to destination.'}
                        </p>
                        <div className="pt-1 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Service Type</span>
                          <span className="font-semibold text-slate-700">
                            {newMode === 'air' ? 'Air Freight' : newMode === 'sea' ? 'Ocean Cargo' : 'P2P Hand Carry'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Carrier Name
                      </label>
                      <input
                        type="text"
                        value={newCarrier}
                        onChange={(e) => setNewCarrier(e.target.value)}
                        placeholder="e.g. Cathay Cargo / GoShipping Air"
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Flight / Ship Number
                      </label>
                      <input
                        type="text"
                        value={newVoyage}
                        onChange={(e) => setNewVoyage(e.target.value)}
                        placeholder="e.g. Flight CX-068"
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. CARGO DETAILS & MULTIPLE PRODUCTS INVENTORY (Matches Image 2 + Multi-product) */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 font-['Manrope',sans-serif]">
                          3. Cargo Details &amp; Multi-Product Inventory
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-[#EA1D2C] border border-red-200">
                          {orderItems.length} {orderItems.length === 1 ? 'Product' : 'Products'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Add every product item in this shipment. A customer can order multiple different products together.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addOrderItem}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-none cursor-pointer inline-flex items-center gap-1.5 shadow-2xs shrink-0"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Add Product</span>
                    </button>
                  </div>

                  {/* Dynamic Product Cards */}
                  <div className="space-y-4">
                    {orderItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="p-4 sm:p-5 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-slate-50/70 transition-none space-y-3.5 shadow-2xs"
                      >
                        {/* Item Card Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center font-mono">
                              #{index + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800 font-['Manrope',sans-serif]">
                              {item.description ? item.description.slice(0, 40) : `Product Item ${index + 1}`}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {item.categoryTag}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => duplicateOrderItem(item)}
                              className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium transition-none cursor-pointer inline-flex items-center gap-1"
                              title="Duplicate this item"
                            >
                              <svg className="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect width="13" height="13" x="9" y="9" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                              <span className="hidden sm:inline">Duplicate</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => removeOrderItem(item.id)}
                              disabled={orderItems.length <= 1}
                              className={`p-1.5 rounded border transition-none cursor-pointer ${
                                orderItems.length <= 1
                                  ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                                  : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                              title={orderItems.length <= 1 ? 'Minimum 1 product required' : 'Remove product item'}
                            >
                              <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Product Description */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Product Description *
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateOrderItem(item.id, 'description', e.target.value)}
                            placeholder="e.g. Commercial Fabrics, Apparel, Electronics..."
                            required
                            className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        {/* Package Type, Category, Quantity (Searchable Selectors with Generous Right Padding) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <SearchableSelect
                              label="Package Type"
                              value={item.packagingType}
                              onChange={(val) => updateOrderItem(item.id, 'packagingType', val)}
                              options={PACKAGE_TYPE_OPTIONS}
                              placeholder="Select package..."
                              searchPlaceholder="Search package type..."
                            />
                          </div>

                          <div>
                            <SearchableSelect
                              label="Product Category"
                              value={item.categoryTag}
                              onChange={(val) => updateOrderItem(item.id, 'categoryTag', val as any)}
                              options={CATEGORY_OPTIONS}
                              placeholder="Select category..."
                              searchPlaceholder="Search category..."
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Quantity (Pieces / Cartons) *
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity ?? ''}
                              onChange={(e) => updateOrderItem(item.id, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                              placeholder="e.g. 10"
                              required
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                            />
                          </div>
                        </div>

                        {/* Weight, Volume, Declared Value */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Weight (KG) *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0.1"
                              value={item.weightKg ?? ''}
                              onChange={(e) => updateOrderItem(item.id, 'weightKg', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="e.g. 50"
                              required
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Volume (CBM) *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              value={item.cbm ?? ''}
                              onChange={(e) => updateOrderItem(item.id, 'cbm', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="e.g. 0.4"
                              required
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Declared Value (BDT)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.declaredValue ?? ''}
                              onChange={(e) => updateOrderItem(item.id, 'declaredValue', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="e.g. 50000"
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Product Large Action Bar */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={addOrderItem}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border-2 border-dashed border-red-300 hover:border-[#EA1D2C] bg-red-50/50 hover:bg-red-50 text-[#EA1D2C] font-bold text-xs transition-none cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Add Another Product Item</span>
                    </button>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Quick presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          addOrderItem();
                          setTimeout(() => {
                            setOrderItems((prev) => {
                              const copy = [...prev];
                              const target = copy[copy.length - 1];
                              if (target) {
                                target.description = 'Cotton Knit Fabrics (Cartons)';
                                target.packagingType = 'carton';
                                target.categoryTag = 'Commercial';
                                target.quantity = 10;
                                target.weightKg = 150;
                                target.cbm = 0.8;
                              }
                              return copy;
                            });
                          }, 0);
                        }}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                      >
                        + Cotton Cartons
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          addOrderItem();
                          setTimeout(() => {
                            setOrderItems((prev) => {
                              const copy = [...prev];
                              const target = copy[copy.length - 1];
                              if (target) {
                                target.description = 'Electronic PCB & Accessories';
                                target.packagingType = 'carton';
                                target.categoryTag = 'Electronics';
                                target.quantity = 5;
                                target.weightKg = 45;
                                target.cbm = 0.25;
                              }
                              return copy;
                            });
                          }, 0);
                        }}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                      >
                        + Electronics
                      </button>
                    </div>
                  </div>

                  {/* Live Auto-Calculated Cargo Totals Bar */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs border-b border-slate-700 pb-2">
                      <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                        Manifest Totals Summary
                      </span>
                      <span className="text-emerald-400 font-mono text-[11px] font-semibold">
                        Auto-Summed across {orderTotals.totalItems} products
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Packages</div>
                        <div className="text-lg font-bold font-['Manrope',sans-serif] tabular-nums">
                          {orderTotals.totalPieces} <span className="text-xs font-normal text-slate-400">pcs</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Gross Weight</div>
                        <div className="text-lg font-bold font-['Manrope',sans-serif] tabular-nums">
                          {orderTotals.totalWeight} <span className="text-xs font-normal text-slate-400">KG</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Volume</div>
                        <div className="text-lg font-bold font-['Manrope',sans-serif] tabular-nums">
                          {orderTotals.totalCbm} <span className="text-xs font-normal text-slate-400">CBM</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-amber-400 uppercase font-semibold">Chargeable Weight</div>
                        <div className="text-lg font-bold font-['Manrope',sans-serif] tabular-nums text-amber-300">
                          {orderTotals.chargeableWeight} <span className="text-xs font-normal text-slate-400">KG</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          Max(Gross, {orderTotals.volumetricWeight} Vol)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. DYNAMIC DESTINATION DELIVERY ADDRESS */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 font-['Manrope',sans-serif]">
                          4. Delivery Address in {newDestCountry}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <span>{currentAddressConfig.flag}</span>
                          <span>{newDestCountry}</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Final destination doorstep, consignee contact and localized dispatch coordinates
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                      {newDestCountry === 'Malaysia' ? 'West & East Malaysia' : 'All 8 Divisions'}
                    </span>
                  </div>

                  {/* Recipient Name and Phone with Country Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Recipient / Consignee Contact Name <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <input
                        type="text"
                        value={recipientContactName}
                        onChange={(e) => {
                          setRecipientContactName(e.target.value);
                          setNewRecipientName(e.target.value);
                        }}
                        placeholder={newDestCountry === 'Malaysia' ? 'e.g. Lotus Mart Sdn Bhd / David Tan' : 'e.g. Apex Fashion Retail Hub / Farhan Ahmed'}
                        required
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Phone Number with Country Code <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <div className="relative flex items-center h-10 w-full rounded-lg border border-slate-300 bg-white focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900">
                        {/* Compact Dial Code Selector with Flag & Code only */}
                        <div className="relative flex items-center shrink-0 pl-3 pr-2.5 border-r border-slate-200">
                          <select
                            value={recipientPhoneCode}
                            onChange={(e) => setRecipientPhoneCode(e.target.value)}
                            aria-label="Select Country Code"
                            className="appearance-none bg-transparent pr-4 text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                          >
                            {PHONE_DIAL_CODES.map((dial) => (
                              <option key={dial.code + dial.country} value={dial.code}>
                                {dial.flag} {dial.code}
                              </option>
                            ))}
                          </select>
                          <svg
                            className="w-3 h-3 text-slate-400 pointer-events-none absolute right-1.5 stroke-[2.5]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>

                        {/* Phone Number Body Input */}
                        <input
                          type="tel"
                          value={recipientPhoneBody}
                          onChange={(e) => {
                            setRecipientPhoneBody(e.target.value);
                            setNewRecipientPhone(`${recipientPhoneCode} ${e.target.value}`);
                          }}
                          placeholder={newDestCountry === 'Malaysia' ? '11 1234 5678' : '1601 111994'}
                          required
                          className="flex-1 h-full px-3 text-xs text-slate-900 font-mono focus:outline-none bg-transparent placeholder-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Line 1 */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Address (Street / Building / Plot / Road) <span className="text-[#EA1D2C]">*</span>
                    </label>
                    <input
                      type="text"
                      value={addressLine1}
                      onChange={(e) => {
                        setAddressLine1(e.target.value);
                        setNewRecipientAddress(e.target.value);
                      }}
                      placeholder={newDestCountry === 'Malaysia' ? 'e.g. Lot 2720-B, Jalan Industri 12' : 'e.g. Flat 2/B, 16, 16/1 Basubazar Lane, Dayaganj'}
                      required
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    />
                  </div>

                  {/* Address Line 2 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Address 2 (Suite / Unit / Floor / Industrial Area)
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Optional</span>
                    </div>
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder={newDestCountry === 'Malaysia' ? 'e.g. Kampung Baru Sungai Buloh' : 'e.g. Suite 402, 4th Floor, Apex Commercial Hub'}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    />
                  </div>

                  {/* 4-Column Selectors: Country, State/Division, City, Postcode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Country Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Country Selector <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <select
                        value={newDestCountry}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white cursor-pointer"
                      >
                        <option value="Bangladesh">🇧🇩 Bangladesh</option>
                        <option value="Malaysia">🇲🇾 Malaysia</option>
                      </select>
                    </div>

                    {/* State / Division Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {currentAddressConfig.stateLabel} Selector <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <select
                        value={recipientState}
                        onChange={(e) => handleStateChange(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white cursor-pointer"
                      >
                        {currentStates.map((st) => (
                          <option key={st.name} value={st.name}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* City Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        City Selector <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <select
                        value={recipientCity}
                        onChange={(e) => {
                          setRecipientCity(e.target.value);
                          setNewDestCity(e.target.value);
                        }}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white cursor-pointer"
                      >
                        {currentAvailableCities.map((ct) => (
                          <option key={ct} value={ct}>
                            {ct}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Postcode */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Post Code
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Optional</span>
                      </div>
                      <input
                        type="text"
                        value={recipientPostcode}
                        onChange={(e) => setRecipientPostcode(e.target.value)}
                        placeholder={newDestCountry === 'Malaysia' ? '47000' : '1204'}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  {/* Delivery Notes & Special Handling */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Delivery Notes &amp; Special Handling Instructions
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Optional</span>
                    </div>
                    <textarea
                      value={deliveryNotes}
                      onChange={(e) => {
                        setDeliveryNotes(e.target.value);
                        setDeliveryInstructions(e.target.value);
                      }}
                      rows={2}
                      placeholder="e.g. Direct door-to-door delivery. Call recipient 2 hours before gate arrival."
                      className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none bg-white"
                    />
                  </div>

                  {/* Live Dispatch Coordinates Preview Box */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span>📍</span> Live Dispatch Coordinates
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {compiledPhone}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 break-words leading-relaxed">
                      {compiledAddress || 'No address specified yet'}
                    </p>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: STICKY MANIFEST SUMMARY & DISPATCH (lg:col-span-4) */}
              <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-4">

                {/* Live Manifest Review Card */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Consignment Manifest
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Ready to Dispatch
                    </span>
                  </div>

                  {/* Manual Tracking Number Input Box */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                        Tracking Number <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">Manual Entry</span>
                    </div>
                    <input
                      type="text"
                      value={newCustomTrackingNumber}
                      onChange={(e) => setNewCustomTrackingNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. GOSH-2026-9812 or Airway Bill / BL"
                      required
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <p className="text-[10px] text-slate-500">
                      Enter the carrier airway bill (AWB), ocean B/L or consignment tracking code manually.
                    </p>
                  </div>

                  {/* Initial Status Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Initial Physical Stage
                    </label>
                    <select
                      value={newInitialStatus}
                      onChange={(e) => setNewInitialStatus(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="purchased">1. PURCHASED (Default Initial)</option>
                      <option value="cn_warehouse_received">2. CN WAREHOUSE RECEIVED</option>
                      <option value="dispatched_from_china">3. DISPATCHED FROM CHINA</option>
                      <option value="arrived_dhaka_airport">4. ARRIVED DHAKA AIRPORT</option>
                      <option value="awaiting_customs">5. AWAITING CUSTOMS CLEARANCE</option>
                      <option value="bd_warehouse_received">6. BD WAREHOUSE RECEIVED</option>
                      <option value="out_for_delivery">7. OUT FOR DELIVERY</option>
                      <option value="delivered">8. DELIVERED</option>
                    </select>
                  </div>

                  {/* Summary Breakdown */}
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Route</span>
                      <span className="font-semibold text-slate-900">{newOriginCity}, CN → {newDestCity}, {newDestCountry === 'Malaysia' ? 'MY' : 'BD'}</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Mode &amp; Carrier</span>
                      <span className="font-semibold text-slate-900">{(newMode === 'air' ? 'BY AIR' : newMode === 'sea' ? 'BY SHIP' : 'HAND CARRY')} ({newVoyage})</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Customer</span>
                      <span className="font-semibold text-slate-900 truncate max-w-[160px]">
                        {orderCustomerMode === 'new' ? (newCustomerCompany || newCustomerFullName || 'New Customer') : (currentSelectedCustomer?.companyName || currentSelectedCustomer?.fullName || 'Assigned')}
                      </span>
                    </div>

                    <div className="py-2 flex items-start justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Deliver To</span>
                      <span className="font-semibold text-slate-900 text-right truncate max-w-[170px]" title={compiledAddress}>
                        {recipientContactName || 'Consignee'} ({recipientCity}, {newDestCountry === 'Malaysia' ? 'MY' : 'BD'})
                      </span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Total Products</span>
                      <span className="font-semibold text-slate-900">{orderTotals.totalItems} distinct items</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Total Packages</span>
                      <span className="font-semibold text-slate-900">{orderTotals.totalPieces} pcs</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Gross Weight</span>
                      <span className="font-semibold text-slate-900">{orderTotals.totalWeight} KG</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Volume</span>
                      <span className="font-semibold text-slate-900">{orderTotals.totalCbm} CBM</span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between bg-red-50/60 px-2 rounded-lg mt-1">
                      <span className="font-bold text-[#EA1D2C]">Chargeable Weight</span>
                      <span className="font-bold text-base text-[#EA1D2C] tabular-nums">
                        {orderTotals.chargeableWeight} KG
                      </span>
                    </div>
                  </div>

                  {/* Primary Dispatch Button */}
                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={submittingConsignment}
                      className="w-full py-3 px-4 rounded-xl bg-[var(--color-brand-primary)] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider transition-none shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      {submittingConsignment ? (
                        <>
                          <svg className="w-4 h-4 animate-spin stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                          <span>Creating Consignment...</span>
                        </>
                      ) : (
                        <>
                          <span>Create &amp; Dispatch Order</span>
                          <span className="font-bold">→</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => switchTab('orders')}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-none cursor-pointer text-center"
                    >
                      Cancel &amp; Return to Orders
                    </button>
                  </div>

                  {/* NBR & Customs Compliance Note */}
                  <div className="pt-2 text-[10px] text-slate-400 text-center leading-relaxed">
                    National Board of Revenue (NBR) Mushak 6.3 compliant manifest generation. Real-time telemetry initialized.
                  </div>
                </div>

              </div>

            </form>
          </div>
        )}
        {/* ========================================================= */}
        {/* TAB: ORDERS & LIVE TRACKING TELEMETRY                      */}
        {/* ========================================================= */}
        {(activeTab === 'shipments' || activeTab === 'tracking' || activeTab === 'orders') && (
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 space-y-5 shadow-xs">
            {/* Header: Breadcrumb Pill, Executive Title, Sync & New Consignment Action */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Orders Desk
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[11px] font-mono font-medium text-slate-500">
                    {shipments.length} Active Shipments
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-['Manrope',sans-serif] tracking-tight">
                  All Orders &amp; Shipments
                </h2>
                <p className="text-xs text-slate-500">
                  Track live shipments, update delivery progress, and manage customs clearance.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">

                <button
                  type="button"
                  onClick={() => {
                    setNewCustomTrackingNumber('');
                    switchTab('new_order');
                  }}
                  className="h-9 px-4 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-none cursor-pointer"
                  title="Create New Consignment Order"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>New Order</span>
                </button>
              </div>
            </div>

            {/* Quick KPI Overview Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/50">
                <div className="text-[11px] font-semibold text-slate-500">Total Weight</div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                  {shipments.reduce((acc, s) => acc + (s.totalWeightKg || 0), 0).toLocaleString()} <span className="text-xs text-slate-400 font-sans">KG</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{shipments.length} Active Shipments</div>
              </div>

              <div className="p-3.5 rounded-lg border border-blue-100 bg-blue-50/40">
                <div className="text-[11px] font-semibold text-blue-700">In Transit</div>
                <div className="text-lg font-bold font-mono text-blue-900 mt-1">
                  {shipments.filter(s => ['dispatched_from_china', 'arrived_dhaka_airport', 'in_transit'].includes(s.status)).length}
                </div>
                <div className="text-[10px] text-blue-600 mt-0.5">Air &amp; Sea Shipments</div>
              </div>

              <div className="p-3.5 rounded-lg border border-amber-100 bg-amber-50/40">
                <div className="text-[11px] font-semibold text-amber-700">In Customs</div>
                <div className="text-lg font-bold font-mono text-amber-900 mt-1">
                  {shipments.filter(s => ['awaiting_customs', 'customs_clearance'].includes(s.status)).length}
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5">Dhaka &amp; Chittagong Customs</div>
              </div>

              <div className="p-3.5 rounded-lg border border-emerald-100 bg-emerald-50/40">
                <div className="text-[11px] font-semibold text-emerald-700">Delivered</div>
                <div className="text-lg font-bold font-mono text-emerald-900 mt-1">
                  {shipments.filter(s => ['out_for_delivery', 'delivered'].includes(s.status)).length}
                </div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Delivered to Customer</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={shipmentSearch}
                  onChange={(e) => setShipmentSearch(e.target.value)}
                  placeholder="Search tracking, client name, route, or flight..."
                  className="w-full h-9 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={shipmentModeFilter}
                  onChange={(e) => setShipmentModeFilter(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer focus:border-slate-400 focus:outline-none"
                >
                  <option value="all">All Shipping Modes</option>
                  <option value="air">By Air</option>
                  <option value="sea">By Ship</option>
                  <option value="hand_carry">Hand Carry</option>
                </select>

                <select
                  value={shipmentStatusFilter}
                  onChange={(e) => setShipmentStatusFilter(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer focus:border-slate-400 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="purchased">PURCHASED</option>
                  <option value="cn_warehouse_received">CN WAREHOUSE RECEIVED</option>
                  <option value="dispatched_from_china">DISPATCHED FROM CHINA</option>
                  <option value="arrived_dhaka_airport">ARRIVED DHAKA AIRPORT</option>
                  <option value="awaiting_customs">AWAITING CUSTOMS</option>
                  <option value="bd_warehouse_received">BD WAREHOUSE RECEIVED</option>
                  <option value="payment_received">PAYMENT RECEIVED</option>
                  <option value="out_for_delivery">OUT FOR DELIVERY</option>
                  <option value="delivered">DELIVERED</option>
                </select>

                <span className="text-[11px] font-mono font-medium text-slate-500 whitespace-nowrap px-1">
                  {filteredShipments.length} {filteredShipments.length === 1 ? 'order' : 'orders'}
                </span>
              </div>
            </div>

            {/* Redesigned Consignments Table with Proportional Widths and Zero Cutoff */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-[11px] border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-[150px]">Tracking Number</th>
                    <th className="py-2.5 px-3 w-[170px]">Customer &amp; Destination</th>
                    <th className="py-2.5 px-3 w-[150px]">Route &amp; Mode</th>
                    <th className="py-2.5 px-3 w-[135px]">Cargo Details</th>
                    <th className="py-2.5 px-3 w-[170px]">Current Location</th>
                    <th className="py-2.5 px-3 w-[160px]">Status</th>
                    <th className="py-2.5 px-3 w-[95px] text-right pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredShipments.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* 1. Tracking & Waybill */}
                      <td className="py-2.5 px-3 font-mono">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-slate-900 text-xs tracking-tight">
                            {s.trackingNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(s.trackingNumber);
                              setCopiedTracking(s.trackingNumber);
                              setTimeout(() => setCopiedTracking(null), 2000);
                            }}
                            title="Copy tracking number"
                            className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-none cursor-pointer"
                          >
                            {copiedTracking === s.trackingNumber ? (
                              <span className="text-[9px] text-emerald-600 font-bold font-sans">Copied!</span>
                            ) : (
                              <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <a
                            href={`/tracking?code=${encodeURIComponent(s.trackingNumber)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-semibold font-sans text-[#EA1D2C] bg-red-50 hover:bg-red-100 border border-red-200 transition-none"
                          >
                            <span>Track</span>
                            <span>↗</span>
                          </a>
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px]">
                            {s.lastUpdatedBst?.split(',')[0] || 'Recent'}
                          </span>
                        </div>
                      </td>

                      {/* 2. Client & Destination */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 text-xs truncate max-w-[165px]">
                          {s.customerName}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[165px] mt-0.5">
                          {s.recipientAddress}
                        </div>
                      </td>

                      {/* 3. Corridor & Mode */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 font-bold text-slate-900 text-xs">
                          <span>{s.originCity}</span>
                          <span className="text-slate-400 font-normal">→</span>
                          <span>{s.destCity}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase border ${
                            s.mode === 'air'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : s.mode === 'sea'
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {s.mode === 'air' ? 'BY AIR' : s.mode === 'sea' ? 'BY SHIP' : s.mode === 'hand_carry' ? 'HAND CARRY' : s.mode.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[100px]">
                            {s.voyageOrFlightNumber}
                          </span>
                        </div>
                      </td>

                      {/* 4. Cargo Specifications */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold font-mono text-slate-900 text-xs">
                          {s.totalWeightKg.toLocaleString()} KG
                          <span className="text-slate-400 font-normal"> · </span>
                          <span className="text-slate-600 font-mono">{s.totalCbm}m³</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {s.totalPieces || s.items.length} units ({s.items[0]?.packagingType?.replace('_', ' ') || 'carton'})
                        </div>
                      </td>

                      {/* 5. Current Waypoint & Progress */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800 text-[11px] truncate max-w-[160px]">
                          {s.currentLocation}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-none"
                              style={{ width: `${s.physicalProgress?.percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-600">
                            {s.physicalProgress?.percentage || 0}%
                          </span>
                        </div>
                      </td>

                      {/* 6. Operational Status (Sleek Interactive Dropdown) */}
                      <td className="py-2.5 px-3">
                        <div className="relative inline-flex items-center w-full max-w-[150px]">
                          <select
                            value={normalizeStatusCode(s.status)}
                            onChange={(e) => handleQuickStatusUpdate(s.id, e.target.value)}
                            className={`w-full appearance-none pl-2 pr-5 py-1 rounded text-[10px] font-bold tracking-tight border cursor-pointer outline-none focus:ring-1 focus:ring-offset-1 transition-none shadow-2xs truncate ${getStatusBadge(normalizeStatusCode(s.status))}`}
                            title="Change live tracking status"
                          >
                            <option value="purchased">PURCHASED</option>
                            <option value="cn_warehouse_received">CN RECEIVED</option>
                            <option value="dispatched_from_china">DISPATCHED CN</option>
                            <option value="arrived_dhaka_airport">ARRIVED DAC</option>
                            <option value="awaiting_customs">CUSTOMS HOLD</option>
                            <option value="bd_warehouse_received">BD RECEIVED</option>
                            <option value="payment_received">PAID</option>
                            <option value="out_for_delivery">OUT FOR DELIVERY</option>
                            <option value="delivered">DELIVERED</option>
                          </select>
                          <svg className="w-3 h-3 absolute right-1.5 pointer-events-none opacity-60 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </td>

                      {/* 7. Actions Desk */}
                      <td className="py-2.5 px-3 text-right pr-3">
                        <div className="flex items-center justify-end gap-1">


                          <button
                            type="button"
                            onClick={() => handleDeleteShipment(s.id, s.trackingNumber)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-none cursor-pointer"
                            title="Delete Order"
                            aria-label="Delete Order"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M3 6h18"/>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredShipments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-600 text-sm">No orders found</div>
                          <div className="text-xs text-slate-400">Try adjusting your search query or mode/status filters.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: RATE QUOTATIONS DESK                                  */}
        {/* ========================================================= */}
        {(activeTab === 'quotes' || activeTab === 'quote') && (
          <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                  Price Quotes
                </h2>
                <p className="text-xs text-slate-500">
                  Review customer quote requests and update shipping pricing
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <input
                  type="text"
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  placeholder="Search quote #, customer, route..."
                  className="h-8 pl-3 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 w-52 sm:w-64"
                />

                <select
                  value={quoteStatusFilter}
                  onChange={(e) => setQuoteStatusFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="priced">Priced</option>
                  <option value="accepted">Accepted</option>
                  <option value="converted">Converted to Shipment</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Quote Number</th>
                    <th className="py-3 px-4">Customer Contact</th>
                    <th className="py-3 px-4">Origin → Destination</th>
                    <th className="py-3 px-4">Cargo & Weight</th>
                    <th className="py-3 px-4">Pricing Status</th>
                    <th className="py-3 px-4">Quoted Total</th>
                    <th className="py-3 px-4 text-right pr-5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotes.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {q.quoteNumber}
                        <div className="text-[10px] text-slate-400 font-sans mt-0.5 uppercase">{q.mode} Cargo</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{q.guestName}</div>
                        <div className="text-[11px] text-slate-500">{q.guestEmail} · {q.guestPhone}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {q.originCity} → {q.destCity}
                        </div>
                        <div className="text-[10px] text-slate-400">{q.serviceType ? q.serviceType.replace(/_/g, ' ') : 'Standard Freight'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {q.totalWeightKg} KG ({q.totalCbm} CBM)
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{q.cargoDescription}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border ${getQuoteBadge(q.status)}`}>
                          {q.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {q.revisions && q.revisions.length > 0 ? (
                          <div>
                            <span className="font-bold text-slate-900">
                              ${q.revisions[0].totalAmount.toLocaleString()} {q.revisions[0].currency}
                            </span>
                            <div className="text-[10px] text-slate-400">By {q.revisions[0].staffName || 'Staff'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Unpriced</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuoteForPricing(q);
                              setShowPricingModal(true);
                            }}
                            className="px-2.5 py-1 rounded bg-[#EA1D2C] text-white hover:bg-[#D41523] text-[11px] font-semibold transition-colors"
                          >
                            {q.revisions.length > 0 ? 'Revise Price' : 'Price Quote'}
                          </button>

                          {q.status !== 'converted' && (
                            <button
                              type="button"
                              onClick={() => handleConvertQuote(q.id, q.quoteNumber)}
                              className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors"
                            >
                              Convert
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredQuotes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No rate quotes matching filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: COMMERCIAL INVOICES & BILLING DESK                   */}
        {/* ========================================================= */}
        {(activeTab === 'invoices' || activeTab === 'invoice') && (() => {
          // Compute invoices from shipments
          const derivedInvoices = (shipments.length > 0 ? shipments : [
            {
              id: 'ship-mock-1',
              trackingNumber: 'GOSH-2026-9812',
              clientName: 'Apex Textiles Ltd',
              originCity: 'Guangzhou',
              originCountry: 'China',
              destinationCity: 'Dhaka',
              serviceType: 'air',
              weightKg: 850.5,
              currentStatus: 'awaiting_customs',
              createdAt: '2026-10-24T10:00:00Z',
            },
            {
              id: 'ship-mock-2',
              trackingNumber: 'GOSH-2026-4411',
              clientName: 'Standard Composite Mills Ltd',
              originCity: 'Shenzhen',
              originCountry: 'China',
              destinationCity: 'Chittagong',
              serviceType: 'sea',
              weightKg: 18450,
              currentStatus: 'dispatched_from_china',
              createdAt: '2026-10-22T08:30:00Z',
            },
            {
              id: 'ship-mock-3',
              trackingNumber: 'GOSH-2026-7733',
              clientName: 'Dhaka Green Energy Solutions',
              originCity: 'Yiwu',
              originCountry: 'China',
              destinationCity: 'Dhaka',
              serviceType: 'road',
              weightKg: 4050,
              currentStatus: 'out_for_delivery',
              createdAt: '2026-10-20T14:15:00Z',
            }
          ] as any[]).map((s, idx) => {
            const invoiceNum = `INV-2026-${(1080 + idx).toString()}`;
            const weight = Number(s.weightKg) || 50;
            const isAir = s.serviceType === 'air';
            const isSea = s.serviceType === 'sea';
            const isHandCarry = s.serviceType === 'hand_carry';
            
            // Tariff calculation
            const freightRate = isAir ? 750 : isSea ? 240 : isHandCarry ? 1450 : 500;
            const baseFreight = Math.round(weight * freightRate);
            const customsDuty = Math.round(baseFreight * 0.05);
            const terminalHandling = isSea ? 8500 : 2500;
            const fuelSurcharge = isAir ? 2200 : 1500;
            const subtotal = baseFreight + customsDuty + terminalHandling + fuelSurcharge;
            const vatTax = Math.round(subtotal * 0.15);
            const totalBDT = subtotal + vatTax;
            const totalUSD = Math.round(totalBDT / 118);

            const isDeliveredOrPaid = s.currentStatus === 'delivered' || s.currentStatus === 'payment_received';
            const hasOverride = invoicePaidOverrides[invoiceNum] !== undefined;
            const isPaid = hasOverride ? invoicePaidOverrides[invoiceNum] : isDeliveredOrPaid;

            return {
              invoiceNumber: invoiceNum,
              shipmentId: s.id,
              trackingNumber: s.trackingNumber,
              customerName: s.clientName || 'Commercial Importer',
              recipient: s.recipientName || `${s.destinationCity || 'Dhaka'} Consignee`,
              destination: `${s.originCity || 'China'} → ${s.destinationCity || 'Dhaka, Bangladesh'}`,
              mode: s.serviceType || 'air',
              weightKg: weight,
              baseFreight,
              customsDuty,
              terminalHandling,
              fuelSurcharge,
              subtotal,
              vatTax,
              totalBDT,
              totalUSD,
              status: isPaid ? 'paid' : (idx === 1 ? 'pending' : 'pending'),
              issueDate: new Date(Date.now() - (idx + 1) * 86400000 * 2).toLocaleDateString('en-GB'),
              dueDate: new Date(Date.now() + (7 - idx) * 86400000).toLocaleDateString('en-GB'),
              paymentMethod: idx % 2 === 0 ? 'Bank Wire (EFT / RTGS)' : 'bKash Merchant Pay',
            };
          });

          // Metrics
          const totalInvoicedBDT = derivedInvoices.reduce((acc, inv) => acc + inv.totalBDT, 0);
          const totalPaidBDT = derivedInvoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + inv.totalBDT, 0);
          const totalPendingBDT = totalInvoicedBDT - totalPaidBDT;
          const paidPercentage = totalInvoicedBDT > 0 ? Math.round((totalPaidBDT / totalInvoicedBDT) * 100) : 0;

          // Filter
          const filteredInvoices = derivedInvoices.filter(inv => {
            const matchesSearch = !invoiceSearch || 
              inv.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
              inv.customerName.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
              inv.trackingNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
              inv.destination.toLowerCase().includes(invoiceSearch.toLowerCase());
            
            const matchesStatus = invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter;
            return matchesSearch && matchesStatus;
          });

          return (
            <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-6 shadow-xs">
              {/* Header Strip */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Invoices &amp; Billing
                  </h2>
                  <p className="text-xs text-slate-500">
                    Manage customer invoices, payment status, and download tax receipts
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8," + 
                        "Invoice,Customer,Tracking,Mode,WeightKG,TotalBDT,TotalUSD,Status\n" +
                        derivedInvoices.map(i => `${i.invoiceNumber},"${i.customerName}",${i.trackingNumber},${i.mode},${i.weightKg},${i.totalBDT},${i.totalUSD},${i.status}`).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `GoShipping_Invoices_${new Date().toISOString().slice(0,10)}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-none shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* KPI Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Total Invoiced
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      ৳{totalInvoicedBDT.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      (~${Math.round(totalInvoicedBDT / 118).toLocaleString()})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {derivedInvoices.length} commercial invoices generated
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                    Paid &amp; Collected
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-emerald-700">
                      ৳{totalPaidBDT.toLocaleString()}
                    </span>
                    <span className="text-xs text-emerald-600 font-bold">
                      {paidPercentage}%
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-600 mt-1 block">
                    Settled via Bank / bKash
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
                    Outstanding Due
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-amber-700">
                      ৳{totalPendingBDT.toLocaleString()}
                    </span>
                    <span className="text-xs text-amber-600 font-bold">
                      {100 - paidPercentage}%
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-600 mt-1 block">
                    Pending customs release
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Average Tariff / KG
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      ৳685/KG
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      All-Inclusive
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Including 5% duty + 15% VAT
                  </span>
                </div>
              </div>

              {/* Search & Filter Strip */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="Search by Invoice #, customer, tracking code..."
                    className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                  <svg className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <label className="text-slate-500 font-medium">Status:</label>
                  <select
                    value={invoiceStatusFilter}
                    onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                    className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-300 font-medium"
                  >
                    <option value="all">All Invoices ({derivedInvoices.length})</option>
                    <option value="paid">Paid ({derivedInvoices.filter(i => i.status === 'paid').length})</option>
                    <option value="pending">Pending ({derivedInvoices.filter(i => i.status === 'pending').length})</option>
                  </select>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Customer &amp; Recipient</th>
                      <th className="py-3 px-4">Order Code</th>
                      <th className="py-3 px-4">Freight &amp; Route</th>
                      <th className="py-3 px-4">Amount (BDT / USD)</th>
                      <th className="py-3 px-4">Payment Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.invoiceNumber} className="hover:bg-slate-50/70 transition-none">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-900 block text-xs">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Issued: {inv.issueDate}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {inv.customerName}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {inv.recipient}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <a
                            href={`/tracking?code=${inv.trackingNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono font-bold text-[#EA1D2C] hover:underline"
                          >
                            <span>{inv.trackingNumber}</span>
                            <svg className="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-700 font-mono">
                              {inv.mode}
                            </span>
                            <span className="font-mono text-slate-600 font-medium">
                              {inv.weightKg} KG
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[160px]">
                            {inv.destination}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-slate-900 block text-sm">
                            ৳{inv.totalBDT.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ~${inv.totalUSD.toLocaleString()} USD
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              const newStatus = inv.status !== 'paid';
                              setInvoicePaidOverrides(prev => ({
                                ...prev,
                                [inv.invoiceNumber]: newStatus
                              }));
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-none ${
                              inv.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                            title="Click to toggle Paid / Pending"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'paid' ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                            <span>{inv.status === 'paid' ? 'Paid / Cleared' : 'Pending Payment'}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewInvoice(inv)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-none inline-flex items-center gap-1 shadow-2xs"
                            >
                              <span>View Tax Invoice</span>
                              <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No commercial invoices found matching "{invoiceSearch}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* TAB: GLOBAL WAREHOUSE LOCATIONS & CFS HUBS               */}
        {/* ========================================================= */}
        {activeTab === 'warehouses' && (
          <div className="space-y-6">
            {/* Header & Primary Action */}
            <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Warehouse Locations &amp; CFS Hubs
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {warehouses.length} Active Hubs
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Operational receiving points, sorting yards, and fulfillment centers across China, Bangladesh, and Malaysia.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={openAddWarehouseModal}
                    className="px-4 py-2 rounded-lg bg-[var(--color-brand-primary)] text-white text-xs font-bold hover:opacity-95 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-none"
                  >
                    <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>+ Add Warehouse</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTab('new_order')}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-none cursor-pointer"
                  >
                    + Create Order
                  </button>
                </div>
              </div>

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-5 border-t border-slate-100">
                <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Facilities</span>
                  <span className="text-xl font-bold text-slate-900 font-['Manrope',sans-serif]">{warehouses.length}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Active consolidation hubs</span>
                </div>
                <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                    <span>🇨🇳</span> China Origin Hub
                  </span>
                  <span className="text-xl font-bold text-slate-900 font-['Manrope',sans-serif]">
                    {warehouses.filter((w) => w.country.toLowerCase() === 'china').length}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Sanyuanli Ave, Guangzhou</span>
                </div>
                <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                    <span>🇧🇩</span> Bangladesh Hub
                  </span>
                  <span className="text-xl font-bold text-slate-900 font-['Manrope',sans-serif]">
                    {warehouses.filter((w) => w.country.toLowerCase() === 'bangladesh').length}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">43/31 Sabujkanon, Dhaka</span>
                </div>
                <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                    <span>🇲🇾</span> Malaysia Hub
                  </span>
                  <span className="text-xl font-bold text-slate-900 font-['Manrope',sans-serif]">
                    {warehouses.filter((w) => w.country.toLowerCase() === 'malaysia').length}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Sungai Buloh, Selangor</span>
                </div>
              </div>
            </div>

            {/* Filters & Search Bar */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: 'all', label: `All Facilities (${warehouses.length})` },
                  { id: 'China', label: `🇨🇳 China (${warehouses.filter(w => w.country.toLowerCase() === 'china').length})` },
                  { id: 'Bangladesh', label: `🇧🇩 Bangladesh (${warehouses.filter(w => w.country.toLowerCase() === 'bangladesh').length})` },
                  { id: 'Malaysia', label: `🇲🇾 Malaysia (${warehouses.filter(w => w.country.toLowerCase() === 'malaysia').length})` }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWarehouseCountryFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-none ${
                      warehouseCountryFilter.toLowerCase() === tab.id.toLowerCase()
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search code, name, city, manager..."
                  value={warehouseSearch}
                  onChange={(e) => setWarehouseSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                />
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            {/* Warehouse Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredWarehouses.map((wh) => (
                <div
                  key={wh.id}
                  className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs hover:border-slate-300 flex flex-col justify-between space-y-4 transition-none"
                >
                  <div className="space-y-3">
                    {/* Badge Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          {wh.code}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {wh.country === 'Bangladesh' ? '🇧🇩 BD' : wh.country === 'Malaysia' ? '🇲🇾 MY' : '🇨🇳 CN'}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        wh.isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${wh.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {wh.isActive ? 'Active Station' : 'Inactive'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif] leading-snug">
                        {wh.name}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1 break-words">{wh.address}</p>
                    </div>
                  </div>

                  {/* Floor Capacity & Occupancy Bar */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Floor Capacity: <b className="text-slate-800">{wh.capacitySqft.toLocaleString()} sqft</b></span>
                      <span className="font-mono font-bold text-slate-900">{wh.currentOccupancyPct}% Occupied</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          wh.currentOccupancyPct > 80
                            ? 'bg-amber-500'
                            : wh.currentOccupancyPct > 50
                            ? 'bg-emerald-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, wh.currentOccupancyPct))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Contact Person Details */}
                  <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Station Lead:</span>
                      <span className="font-medium text-slate-800">{wh.contactPerson || 'Ops Lead'}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-400 font-sans">Contact:</span>
                      <span className="text-slate-700">{wh.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono truncate">
                      <span className="text-slate-400 font-sans">Email:</span>
                      <span className="text-slate-700 truncate max-w-[170px]" title={wh.email}>{wh.email || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Action Buttons: Edit and Delete */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditWarehouseModal(wh)}
                      className="w-full py-1.5 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-none shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Edit Hub</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteWarehouseModal(wh)}
                      className="w-full py-1.5 px-3 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-none shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredWarehouses.length === 0 && (
              <div className="bg-white rounded-xl p-12 border border-slate-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-xl">
                  🏢
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Warehouse Facilities Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {warehouseSearch
                    ? `No facilities matched your search query "${warehouseSearch}".`
                    : 'No warehouse facilities active under this country filter.'}
                </p>
                <button
                  type="button"
                  onClick={openAddWarehouseModal}
                  className="px-4 py-2 rounded-lg bg-[var(--color-brand-primary)] text-white text-xs font-bold hover:opacity-95 cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
                >
                  + Add New Warehouse
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: USERS & IMPORTERS DIRECTORY                           */}
        {/* ========================================================= */}
        {(activeTab === 'users' || activeTab === 'customers') && (
          <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Users &amp; Staff
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                    {filteredUsers.length} Registered Users
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Manage user accounts, roles, and admin permissions
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetUserForm();
                  setShowAddUserModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold transition-none shadow-xs cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add New User</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="relative flex-1 min-w-[220px]">
                <input
                  type="text"
                  placeholder="Search user by name, email, company, or phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:border-[#EA1D2C] outline-none"
                />
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="customer">Customers &amp; Importers</option>
                <option value="super_admin">Super Admins</option>
                <option value="ops_manager">Operations Managers</option>
                <option value="warehouse_staff">Warehouse Staff</option>
                <option value="sales_team">Sales Team</option>
                <option value="support_agent">Support Agents</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setUserSearch('');
                  setUserRoleFilter('all');
                  setUserStatusFilter('all');
                }}
                className="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs"
              >
                Reset
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User Profile</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Company &amp; Phone</th>
                    <th className="py-3 px-4">Shipments</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const isSuperAdmin = u.role === 'super_admin';
                    const isOps = u.role === 'ops_manager';
                    const isCustomer = u.role === 'customer';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {u.fullName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <strong className="text-slate-900 block truncate font-semibold">
                                {u.fullName}
                              </strong>
                              <span className="text-slate-500 font-mono text-[11px] block truncate">
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isSuperAdmin && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              Super Admin
                            </span>
                          )}
                          {isOps && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white">
                              Ops Manager
                            </span>
                          )}
                          {u.role === 'warehouse_staff' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Warehouse
                            </span>
                          )}
                          {u.role === 'sales_team' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              Sales Team
                            </span>
                          )}
                          {isCustomer && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Importer Client
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800 block">
                            {u.companyName || u.fullName}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {u.phone || 'No phone recorded'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-900">
                            {u.activeShipmentsCount ?? 0} active
                          </span>
                          <span className="text-slate-400 block text-[10px]">
                            {u.totalQuotesCount ?? 0} quotes
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {u.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                              Suspended
                            </span>
                          )}
                        </td>

                        {/* Admin Action Bar */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* GHOST LOGIN BUTTON (Login as User without password) */}
                            <button
                              type="button"
                              onClick={() => handleImpersonateUser(u.id, u.fullName)}
                              className="px-2.5 py-1.5 rounded bg-[var(--color-midnight)] hover:bg-[var(--color-brand-primary)] text-white font-bold text-[11px] inline-flex items-center gap-1.5 transition-none shadow-2xs cursor-pointer"
                              title="Masquerade & view portal as this user without password"
                            >
                              <svg className="w-3 h-3 text-amber-400 fill-amber-400" viewBox="0 0 24 24" aria-hidden="true">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                              </svg>
                              <span>Login as User</span>
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              className="px-2 py-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition-none cursor-pointer"
                              title="Edit user details"
                            >
                              Edit
                            </button>

                            {/* Suspend / Activate Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u.id, u.status)}
                              className={`px-2 py-1.5 rounded text-[11px] font-semibold transition-none cursor-pointer ${
                                u.status === 'active'
                                  ? 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                                  : 'border border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                              }`}
                              title={u.status === 'active' ? 'Suspend this user' : 'Reactivate this user'}
                            >
                              {u.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.fullName)}
                              className="px-2 py-1.5 rounded border border-transparent hover:border-red-200 hover:bg-red-50 text-slate-400 hover:text-red-600 font-semibold text-[11px] transition-none cursor-pointer flex items-center justify-center"
                              title="Delete user"
                            >
                              <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No user accounts match the current filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: AUDIT & SECURITY TRAIL                                */}
        {/* ========================================================= */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                  Activity &amp; Security Logs
                </h2>
                <p className="text-xs text-slate-500">
                  History of admin actions, logins, and order updates
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[10px] tracking-wider font-sans">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Staff / User</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-semibold text-slate-800">
                        {log.userName || log.userId || 'System'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {log.entityType ? `${log.entityType}:${log.entityId || ''}` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        No audit events recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: RESEND & EMAIL TELEMETRY                             */}
        {/* ========================================================= */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            {/* Top Overview Card */}
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Email Service &amp; Status
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-[#EA1D2C] font-mono">
                      support.goshipping.com.bd
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Email notifications powered by Resend with verified domain authentication.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadEmailStatus}
                    disabled={loadingEmailStatus}
                    className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-none cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className={`w-3.5 h-3.5 text-slate-500 ${loadingEmailStatus ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 16h5v5" />
                    </svg>
                    <span>Check Status</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleVerifyDomain}
                    disabled={verifyingDomain}
                    className="px-3.5 py-1.5 rounded-md bg-[#11181E] hover:bg-slate-800 text-white text-xs font-bold transition-none cursor-pointer shadow-xs"
                  >
                    {verifyingDomain ? 'Verifying...' : 'Verify DNS on Resend'}
                  </button>
                </div>
              </div>

              {verifyMessage && (
                <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800 font-semibold">
                  {verifyMessage}
                </div>
              )}

              {/* Gateway Configuration Metric Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Sender Identity (From)</span>
                  <div className="text-xs font-bold text-slate-900 font-mono mt-1 truncate">
                    notifications@support.goshipping.com.bd
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1 inline-block">Strict Branded Domain</span>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Ops Alert Desk</span>
                  <div className="text-xs font-bold text-slate-900 font-mono mt-1 truncate">
                    ops@goshipping.com.bd
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 inline-block">Direct Operational Alerts</span>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Resend Domain Status</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${emailStatus?.domain?.status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                    <span className="text-xs font-bold text-slate-900 uppercase font-mono">
                      {emailStatus?.domain?.status || 'Pending DNS'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 inline-block">
                    Region: {emailStatus?.domain?.region || 'ap-northeast-1'}
                  </span>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Email Logs &amp; Stats</span>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    5 Automated Workflows
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1 inline-block">Live on Events</span>
                </div>
              </div>
            </div>

            {/* Hostinger DNS Records Configuration Table */}
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                  Hostinger DNS Records Authentication (DKIM &amp; SPF)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The following 3 DNS records must be added into your Hostinger DNS Zone for <code className="text-[0.9em] font-mono bg-slate-100 px-1 py-0.5 rounded">goshipping.com.bd</code> to authenticate sending from <code className="text-[0.9em] font-mono bg-slate-100 px-1 py-0.5 rounded">support.goshipping.com.bd</code>.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200 text-[10px] tracking-wider font-sans">
                    <tr>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Record Name (Host)</th>
                      <th className="py-2.5 px-4">Value / Points to</th>
                      <th className="py-2.5 px-4">TTL</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-[#EA1D2C]">TXT</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 select-all">resend._domainkey.support</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate select-all" title="p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD5wvx/BY7u4uCE/bbDLPqW8eM7kGSov5le/4heeKH94dIR8Z7jxRSCmR5tVFBg0/di5i5VgFstLg1U/W5gXOhZTkhhj+QmjKdfUu4U6agN00Fv8OP3c9zA9A1WdwJXMsac6JmYz6iLJzbgvl7/lpnfL+P5WtcrbecQQsOr97n/oQIDAQAB">
                        p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD5wvx/BY7u4uCE/bbDLPqW8eM7kGSov5le/4heeKH94dIR8Z7jxRSCmR5tVFBg0/di5i5VgFstLg1U/W5gXOhZTkhhj+QmjKdfUu4U6agN00Fv8OP3c9zA9A1WdwJXMsac6JmYz6iLJzbgvl7/lpnfL+P5WtcrbecQQsOr97n/oQIDAQAB
                      </td>
                      <td className="py-3 px-4 text-slate-500">Auto / 3600</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Pending DNS
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-indigo-600">CNAME</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 select-all">rsend.support</td>
                      <td className="py-3 px-4 text-slate-600 select-all">rsend-apne1.forge.rmta.net</td>
                      <td className="py-3 px-4 text-slate-500">3600</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Pending DNS
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-indigo-600">CNAME</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 select-all">send.support</td>
                      <td className="py-3 px-4 text-slate-600 select-all">send.forge.rmta.net</td>
                      <td className="py-3 px-4 text-slate-500">3600</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Pending DNS
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Two-Column Grid: Test Email Dispatch & Notification Triggers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Test Email Dispatch Card */}
              <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Dispatch Live Test Email
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Send an instantaneous test dispatch through Resend to verify delivery headers and inbox rendering.
                  </p>
                </div>

                <form onSubmit={handleSendTestEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Recipient Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      placeholder="e.g. operations@yourcompany.com"
                      className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA1D2C] focus:border-transparent font-mono"
                    />
                  </div>

                  {testEmailResult && (
                    <div
                      className={`p-3 rounded-md text-xs font-semibold ${
                        testEmailResult.success
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {testEmailResult.message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sendingTestEmail}
                    className="w-full h-10 rounded-md bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold uppercase tracking-wider transition-none cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    {sendingTestEmail ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                          <path d="M4 12a8 8 0 0 1 8-8" strokeWidth="4" className="opacity-75" />
                        </svg>
                        <span>Transmitting to Resend...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Test Dispatch &rarr;</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Configured Triggers Card */}
              <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Active Transactional Email Triggers
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Automated email events wired into GoShipping business logic.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">1. Rate Quotation Inquiries</strong>
                      <span className="text-slate-600 text-[11px]">Instant acknowledgment with quote number to client, and alert notice to <code className="text-[0.9em] font-mono">ops@goshipping.com.bd</code>.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">2. Order Confirmation &amp; Dispatch</strong>
                      <span className="text-slate-600 text-[11px]">When Admin/Ops registers a shipment, customer receives waybill details with a 1-click live tracking link.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">3. Live Status Updates</strong>
                      <span className="text-slate-600 text-[11px]">Whenever status changes (e.g. Arrived Dhaka Airport, Customs Clearance), customer gets updated in BST.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">4. User Account Onboarding</strong>
                      <span className="text-slate-600 text-[11px]">Staff creation in Admin or user signup dispatches an enterprise welcome credential email.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">5. Website Contact Form</strong>
                      <span className="text-slate-600 text-[11px]">Inquiries from <code className="text-[0.9em] font-mono">/contact</code> route directly to operations with client reply-to.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* 03. MODAL: CELEBRATION / TRACKING ORDER CREATED SUCCESS    */}
      {/* ========================================================= */}
      {createdShipmentResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 text-center font-['Inter',sans-serif]">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <svg className="w-7 h-7 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 font-['Manrope',sans-serif]">
                Tracking Order Created Successfully!
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                New order registered and live on GoShipping tracking.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-left text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Tracking Number:</span>
                <span className="font-mono font-extrabold text-sm text-[#EA1D2C] bg-red-50 px-2 py-0.5 rounded border border-red-200 select-all">
                  {createdShipmentResult.trackingNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">{createdShipmentResult.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Route &amp; Mode:</span>
                <span className="font-semibold text-slate-800">{createdShipmentResult.route} ({createdShipmentResult.mode})</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <a
                href={`/tracking?code=${encodeURIComponent(createdShipmentResult.trackingNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-none"
              >
                <span>Open in Public Live Tracker ↗</span>
              </a>



              <button
                type="button"
                onClick={() => setCreatedShipmentResult(null)}
                className="w-full py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium cursor-pointer transition-none"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 03. MODAL: RATE PRICING QUOTE                              */}
      {/* ========================================================= */}
      {showPricingModal && selectedQuoteForPricing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  Price Quote: {selectedQuoteForPricing.quoteNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedQuoteForPricing.guestName} · {selectedQuoteForPricing.originCity} → {selectedQuoteForPricing.destCity} ({selectedQuoteForPricing.totalWeightKg} KG)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPricingModal(false);
                  setSelectedQuoteForPricing(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handlePriceQuote} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Freight Charge (BDT)</label>
                  <input
                    type="number"
                    value={baseFreight}
                    onChange={(e) => setBaseFreight(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fuel Surcharge (BDT)</label>
                  <input
                    type="number"
                    value={fuelSurcharge}
                    onChange={(e) => setFuelSurcharge(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customs Clearance (BDT)</label>
                  <input
                    type="number"
                    value={customsClearanceFee}
                    onChange={(e) => setCustomsClearanceFee(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Warehouse Handling (BDT)</label>
                  <input
                    type="number"
                    value={handlingFee}
                    onChange={(e) => setHandlingFee(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center font-bold">
                <span className="text-slate-700 text-xs">Calculated Total Payable:</span>
                <span className="text-sm font-mono text-[#EA1D2C]">
                  ৳{(
                    (parseFloat(baseFreight) || 0) +
                    (parseFloat(fuelSurcharge) || 0) +
                    (parseFloat(customsClearanceFee) || 0) +
                    (parseFloat(handlingFee) || 0)
                  ).toLocaleString()} BDT
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pricing Notes & Terms</label>
                <textarea
                  value={pricingNotes}
                  onChange={(e) => setPricingNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowPricingModal(false);
                    setSelectedQuoteForPricing(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPricing}
                  className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold"
                >
                  {submittingPricing ? 'Saving...' : 'Issue Formal Price →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 04. MODAL: ADD NEW USER PROFILE                            */}
      {/* ========================================================= */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  + Register New User Profile
                </h3>
                <p className="text-xs text-slate-500">
                  Create a new importer client, staff officer, or operations manager account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Close"
              >
                <svg aria-hidden="true" className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tariqul Islam"
                    value={userFullName}
                    onChange={(e) => setUserFullName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="tariqul@company.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Role</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-medium"
                  >
                    <option value="customer">Customer / Commercial Importer</option>
                    <option value="ops_manager">Operations Manager</option>
                    <option value="warehouse_staff">Warehouse Officer</option>
                    <option value="sales_team">Sales Team</option>
                    <option value="support_agent">Support Agent</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Password</label>
                  <input
                    type="password"
                    placeholder="Initial password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Textiles Ltd"
                    value={userCompanyName}
                    onChange={(e) => setUserCompanyName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="+880 1711 000000"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery / Warehouse Address</label>
                <input
                  type="text"
                  placeholder="Street, EPZ, District, Postal Code"
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">BIN / Trade License #</label>
                  <input
                    type="text"
                    placeholder="002918291-0102"
                    value={userBin}
                    onChange={(e) => setUserBin(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold transition-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-bold transition-none shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingUser ? 'Registering...' : 'Create User Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 05. MODAL: EDIT USER PROFILE                               */}
      {/* ========================================================= */}
      {showEditUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  Edit User Profile &amp; Role
                </h3>
                <p className="text-xs text-slate-500">
                  Update corporate credentials, role privileges, and contact details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Close"
              >
                <svg aria-hidden="true" className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userFullName}
                    onChange={(e) => setUserFullName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Role</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-medium"
                  >
                    <option value="customer">Customer / Commercial Importer</option>
                    <option value="ops_manager">Operations Manager</option>
                    <option value="warehouse_staff">Warehouse Officer</option>
                    <option value="sales_team">Sales Team</option>
                    <option value="support_agent">Support Agent</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={userCompanyName}
                    onChange={(e) => setUserCompanyName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery / Warehouse Address</label>
                <input
                  type="text"
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">BIN / Trade License #</label>
                <input
                  type="text"
                  value={userBin}
                  onChange={(e) => setUserBin(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold transition-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-bold transition-none shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingUser ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: OFFICIAL COMMERCIAL TAX INVOICE PREVIEW            */}
      {/* ========================================================= */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <img src="/brand/logo-light.svg" alt="GoShipping" className="h-7 w-auto object-contain" />
                <div className="border-l border-slate-300 pl-3">
                  <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                    Commercial Freight &amp; Customs Tax Invoice
                  </h3>
                  <span className="font-mono text-xs text-slate-500 font-semibold">{previewInvoice.invoiceNumber}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewInvoice(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer transition-none"
              >
                <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Bill To & Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Billed To (Importer):</span>
                <p className="font-bold text-slate-900 text-sm">{previewInvoice.customerName}</p>
                <p className="text-slate-600 mt-0.5">{previewInvoice.destination}</p>
                <p className="text-slate-500 font-mono mt-1">Consignee: {previewInvoice.recipient}</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Invoice Details:</span>
                <p className="font-mono text-slate-800">Date: {previewInvoice.issueDate}</p>
                <p className="font-mono text-slate-800">Due Date: {previewInvoice.dueDate}</p>
                <p className="font-mono font-bold text-[#EA1D2C] mt-1">Shipment: {previewInvoice.trackingNumber}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <span>{previewInvoice.status === 'paid' ? 'PAID &amp; CLEARED' : 'PAYMENT PENDING'}</span>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Description &amp; Customs Tariff Item</th>
                    <th className="py-2.5 px-3 text-right">Basis</th>
                    <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">International Freight Forwarding Charge</span>
                      <span className="text-[11px] text-slate-500">{previewInvoice.mode.toUpperCase()} Express Door-to-Door</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">{previewInvoice.weightKg} KG</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">৳{previewInvoice.baseFreight.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">Port Terminal Handling Charges (THC)</span>
                      <span className="text-[11px] text-slate-500">Dhaka HSIA / Chittagong Port berth and unloading</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">Fixed</td>
                    <td className="py-2.5 px-3 text-right">৳{previewInvoice.terminalHandling.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">Customs Clearance Levy &amp; Regulatory Pre-Assessment</span>
                      <span className="text-[11px] text-slate-500">National Board of Revenue (NBR) ASYCUDA World documentation</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">5.0%</td>
                    <td className="py-2.5 px-3 text-right">৳{previewInvoice.customsDuty.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">Fuel &amp; Security Surcharge</span>
                      <span className="text-[11px] text-slate-500">Carrier bunker adjustment factor (BAF)</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">Standard</td>
                    <td className="py-2.5 px-3 text-right">৳{previewInvoice.fuelSurcharge.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">Statutory Value Added Tax (VAT)</span>
                      <span className="text-[11px] text-slate-500">Bangladesh VAT Act 2012</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">15.0%</td>
                    <td className="py-2.5 px-3 text-right">৳{previewInvoice.vatTax.toLocaleString()}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-mono">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 text-right font-bold text-slate-900 font-sans text-xs">Total Amount Due:</td>
                    <td className="py-3 px-3 text-right font-bold text-base text-[#EA1D2C]">
                      ৳{previewInvoice.totalBDT.toLocaleString()}
                      <span className="text-[10px] text-slate-500 block font-normal">(~${previewInvoice.totalUSD.toLocaleString()} USD)</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bank details & footer */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="font-bold text-slate-900 block">Settlement Bank: Standard Chartered Bank Bangladesh</span>
                <span className="font-mono text-[11px] text-slate-500">A/C: 01-1184920-01 · Routing: 195260124 · Swift: SCBLBDDX</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-900 block">BIN: 004819273-0101</span>
                <span className="text-[10px] text-slate-500">Mushak 6.3 Tax Compliant</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs transition-none cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold text-xs transition-none shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect width="12" height="8" x="6" y="14" />
                </svg>
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* MODAL: ADD NEW WAREHOUSE FACILITY                         */}
      {/* ========================================================= */}
      {showAddWarehouseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  + Add Warehouse Facility
                </h3>
                <p className="text-xs text-slate-500">
                  Register a new receiving, bonded CFS, or fulfillment hub.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWarehouseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hub Code <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SHA-01, KUL-02"
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Country <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <select
                    value={whCountry}
                    onChange={(e) => {
                      setWhCountry(e.target.value);
                      if (e.target.value === 'China') setWhPhone('+86 20 8888 0000');
                      else if (e.target.value === 'Malaysia') setWhPhone('+60 11-1234 5678');
                      else setWhPhone('+880 1711 000000');
                    }}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="China">🇨🇳 China</option>
                    <option value="Bangladesh">🇧🇩 Bangladesh</option>
                    <option value="Malaysia">🇲🇾 Malaysia</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Facility Name <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Guangzhou Baiyun Gateway"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    City <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Guangzhou, Selangor, Dhaka"
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Street &amp; Building Address <span className="text-[#EA1D2C]">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Street, building name, industrial zone, postal code"
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Station Lead</label>
                  <input
                    type="text"
                    placeholder="Manager name"
                    value={whContactPerson}
                    onChange={(e) => setWhContactPerson(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+880 / +86 / +60"
                    value={whPhone}
                    onChange={(e) => setWhPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="hub@goshipping.com.bd"
                    value={whEmail}
                    onChange={(e) => setWhEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Capacity (Sqft)</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={whCapacitySqft}
                    onChange={(e) => setWhCapacitySqft(Number(e.target.value) || 20000)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Occupancy (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={whCurrentOccupancyPct}
                    onChange={(e) => setWhCurrentOccupancyPct(Number(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Station Status</label>
                  <select
                    value={whIsActive ? 'active' : 'inactive'}
                    onChange={(e) => setWhIsActive(e.target.value === 'active')}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="active">Active Station</option>
                    <option value="inactive">Inactive / Offline</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddWarehouseModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer hover:bg-slate-50 transition-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWarehouse}
                  className="px-5 py-2 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-95 text-white font-bold transition-none shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {submittingWarehouse ? 'Registering...' : '+ Create Warehouse Hub'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT WAREHOUSE FACILITY                            */}
      {/* ========================================================= */}
      {showEditWarehouseModal && selectedWarehouse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  Edit Warehouse: {selectedWarehouse.code}
                </h3>
                <p className="text-xs text-slate-500">
                  Update facility address, storage capacity, and station leadership.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditWarehouseModal(false);
                  setSelectedWarehouse(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateWarehouse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hub Code <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Country <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <select
                    value={whCountry}
                    onChange={(e) => setWhCountry(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="China">🇨🇳 China</option>
                    <option value="Bangladesh">🇧🇩 Bangladesh</option>
                    <option value="Malaysia">🇲🇾 Malaysia</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Facility Name <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    City <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Street &amp; Building Address <span className="text-[#EA1D2C]">*</span>
                </label>
                <textarea
                  rows={2}
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Station Lead</label>
                  <input
                    type="text"
                    value={whContactPerson}
                    onChange={(e) => setWhContactPerson(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={whPhone}
                    onChange={(e) => setWhPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    value={whEmail}
                    onChange={(e) => setWhEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Capacity (Sqft)</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={whCapacitySqft}
                    onChange={(e) => setWhCapacitySqft(Number(e.target.value) || 20000)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Occupancy (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={whCurrentOccupancyPct}
                    onChange={(e) => setWhCurrentOccupancyPct(Number(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Station Status</label>
                  <select
                    value={whIsActive ? 'active' : 'inactive'}
                    onChange={(e) => setWhIsActive(e.target.value === 'active')}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="active">Active Station</option>
                    <option value="inactive">Inactive / Offline</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditWarehouseModal(false);
                    setSelectedWarehouse(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer hover:bg-slate-50 transition-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWarehouse}
                  className="px-5 py-2 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-95 text-white font-bold transition-none shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {submittingWarehouse ? 'Updating...' : 'Save Hub Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DELETE WAREHOUSE FACILITY CONFIRMATION             */}
      {/* ========================================================= */}
      {showDeleteWarehouseModal && selectedWarehouse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4 font-['Inter',sans-serif]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  Delete Warehouse Facility?
                </h3>
                <p className="text-xs text-slate-500">
                  This action will permanently delete this facility from the network.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Hub Code:</span>
                <span className="font-mono font-bold text-slate-900">{selectedWarehouse.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Facility:</span>
                <span className="font-semibold text-slate-900">{selectedWarehouse.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="text-slate-700">{selectedWarehouse.city}, {selectedWarehouse.country}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Note: This warehouse will immediately be removed from all active order origin and destination selector dropdowns.
            </p>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteWarehouseModal(false);
                  setSelectedWarehouse(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-50 transition-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingWarehouse}
                onClick={handleDeleteWarehouse}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-none shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {deletingWarehouse ? 'Deleting...' : 'Confirm Delete Facility'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastNotification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold bg-slate-900 text-white animate-in fade-in slide-in-from-bottom-2 duration-150 border border-slate-700/80">
          {toastNotification.type === 'success' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
          )}
          {toastNotification.type === 'error' && (
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
          )}
          {toastNotification.type === 'info' && (
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
          )}
          <span>{toastNotification.message}</span>
        </div>
      )}
    </div>
  );
}
