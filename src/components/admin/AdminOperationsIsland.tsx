import React, { useState, useEffect } from 'react';
import type { ShipmentRecord, ShipmentItem } from '../../server/services/shipment.service';
import type { QuoteRecord } from '../../server/services/quote.service';
import type { WarehouseRecord } from '../../server/services/warehouse.service';
import { TRACKING_STATUSES, type TrackingStatusCode } from '../../server/services/tracking-status';

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

  // Modals state
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showConsignmentModal, setShowConsignmentModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>('');
  const [selectedQuoteForPricing, setSelectedQuoteForPricing] = useState<QuoteRecord | null>(null);

  // Milestone Form State
  const [eventStatus, setEventStatus] = useState<string>('awaiting_customs');
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDateTime, setEventDateTime] = useState('');
  const [eventLat, setEventLat] = useState('');
  const [eventLng, setEventLng] = useState('');
  const [eventSource, setEventSource] = useState<'warehouse' | 'admin' | 'carrier_api' | 'driver'>('admin');
  const [submittingEvent, setSubmittingEvent] = useState(false);

  // New Consignment Form State
  const [newCustName, setNewCustName] = useState('Apex Textiles Ltd');
  const [newRecipientName, setNewRecipientName] = useState('Apex Fashion Retail Hub');
  const [newRecipientAddress, setNewRecipientAddress] = useState('Plot 14, Uttara, Dhaka, Bangladesh');
  const [newOriginCountry, setNewOriginCountry] = useState('China');
  const [newOriginCity, setNewOriginCity] = useState('Guangzhou');
  const [newDestCountry, setNewDestCountry] = useState('Bangladesh');
  const [newDestCity, setNewDestCity] = useState('Dhaka');
  const [newMode, setNewMode] = useState<'air' | 'sea' | 'road' | 'hand_carry'>('air');
  const [newServiceLevel, setNewServiceLevel] = useState<'standard' | 'express' | 'priority'>('express');
  const [newCarrier, setNewCarrier] = useState('Cathay Cargo / GoShipping Air');
  const [newVoyage, setNewVoyage] = useState('Flight CX-068');
  const [newWeight, setNewWeight] = useState('850');
  const [newCbm, setNewCbm] = useState('4.25');
  const [newPieces, setNewPieces] = useState('24');
  const [newItemDesc, setNewItemDesc] = useState('Air Freight LD3 ULD (Commercial Fabrics & Samples)');
  const [newItemType, setNewItemType] = useState('air_uld');
  const [newItemTag, setNewItemTag] = useState<'General' | 'Commercial' | 'Liquids' | 'Dangerous' | 'Perishable' | 'Electronics'>('Commercial');
  const [submittingConsignment, setSubmittingConsignment] = useState(false);

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

  // New Consignment Customer Link State
  const [selectedCustomerId, setSelectedCustomerId] = useState('usr-customer-01');
  const [newRecipientPhone, setNewRecipientPhone] = useState('+880 1711-002233');

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [resShip, resQte, resWh, resCust, resAudit, resUsers] = await Promise.all([
        fetch('/api/shipments').then((r) => r.json()).catch(() => ({ success: false, shipments: [] })),
        fetch('/api/quotes').then((r) => r.json()).catch(() => ({ success: false, quotes: [] })),
        fetch('/api/warehouses').then((r) => r.json()).catch(() => ({ success: false, warehouses: [] })),
        fetch('/api/admin/customers').then((r) => r.json()).catch(() => ({ success: false, customers: [] })),
        fetch('/api/admin/audit-logs').then((r) => r.json()).catch(() => ({ success: false, logs: [] })),
        fetch('/api/admin/users').then((r) => r.json()).catch(() => ({ success: false, users: [] }))
      ]);

      if (resShip.success && resShip.shipments) {
        setShipments(resShip.shipments);
        if (resShip.shipments.length > 0 && !selectedShipmentId) {
          setSelectedShipmentId(resShip.shipments[0].trackingNumber);
        }
      }
      if (resQte.success && resQte.quotes) setQuotes(resQte.quotes);
      if (resWh.success && resWh.warehouses) setWarehouses(resWh.warehouses);
      if (resCust.success && resCust.customers) setCustomers(resCust.customers);
      if (resAudit.success && resAudit.logs) setAuditLogs(resAudit.logs);
      if (resUsers.success && resUsers.users) setUsers(resUsers.users);
    } catch (err) {
      console.error('Failed to load operational data:', err);
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
          message: `✓ Test email dispatched successfully! ID: ${data.emailId || 'OK'}`
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

  // Handler: Add Milestone Event
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentId) {
      alert('Please select a shipment');
      return;
    }
    setSubmittingEvent(true);
    try {
      const res = await fetch(`/api/shipments/${selectedShipmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: eventStatus,
          title: eventTitle || undefined,
          locationName: eventLocation || undefined,
          description: eventDescription || undefined,
          source: eventSource,
          lat: eventLat ? parseFloat(eventLat) : undefined,
          lng: eventLng ? parseFloat(eventLng) : undefined,
          eventTime: eventDateTime ? new Date(eventDateTime).toISOString() : undefined
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to add milestone');
      }

      const data = await res.json();
      setShowMilestoneModal(false);
      setEventTitle('');
      setEventLocation('');
      setEventDescription('');
      setEventDateTime('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingEvent(false);
    }
  };

  // Handler: Create Master Consignment
  const handleCreateConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingConsignment(true);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId || 'usr-customer-01',
          customerName: newCustName,
          recipientName: newRecipientName,
          recipientPhone: newRecipientPhone,
          recipientAddress: newRecipientAddress,
          originCountry: newOriginCountry,
          originCity: newOriginCity,
          destCountry: newDestCountry,
          destCity: newDestCity,
          mode: newMode,
          serviceLevel: newServiceLevel,
          carrierName: newCarrier,
          voyageOrFlightNumber: newVoyage,
          totalWeightKg: parseFloat(newWeight) || 500,
          totalCbm: parseFloat(newCbm) || 2.5,
          totalPieces: parseInt(newPieces, 10) || 1,
          items: [
            {
              itemCode: `#ITM-${Math.floor(1000 + Math.random() * 9000)}`,
              description: newItemDesc,
              packagingType: newItemType,
              quantity: parseInt(newPieces, 10) || 1,
              weightKg: parseFloat(newWeight) || 500,
              cbm: parseFloat(newCbm) || 2.5,
              categoryTag: newItemTag,
              declaredValue: 2440000,
              currency: 'BDT'
            }
          ]
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to create consignment');
      }

      const data = await res.json();
      alert(`Master Consignment created! Reference: ${data.shipment.trackingNumber}`);
      setShowConsignmentModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingConsignment(false);
    }
  };

  // Handler: Quick Status Update
  const handleQuickStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/shipments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Status update failed');
      }
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handler: Delete Shipment
  const handleDeleteShipment = async (id: string, trackingNumber: string) => {
    if (!confirm(`Are you sure you want to permanently delete consignment ${trackingNumber}?`)) return;
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
        return {
          title: 'Master Consignments & Tracking',
          subtitle: 'Air & Ocean freight waybills, carrier telemetry and live tracking'
        };
      case 'quotes':
        return {
          title: 'Commercial Rate Quotations',
          subtitle: 'Inquiries pricing queue, tariff revisions and conversion engine'
        };
      case 'warehouses':
        return {
          title: 'China & Bangladesh Warehouse Hubs',
          subtitle: 'Guangzhou, Shenzhen, Yiwu CFS and Dhaka receiving terminals'
        };
      case 'users':
        return {
          title: 'Enterprise Users & Staff Directory',
          subtitle: 'Access control, role privileges and Super Admin Ghost Login'
        };
      case 'customers':
        return {
          title: 'Commercial Importers & Clients',
          subtitle: 'Corporate accounts, credit limits and historical dispatch records'
        };
      case 'audit':
        return {
          title: 'Audit Trail & Security Logs',
          subtitle: 'Immutable record of staff actions, logins, and status transitions'
        };
      case 'email':
        return {
          title: 'Resend Email Gateway & DNS Diagnostics',
          subtitle: 'Transactional notifications, support.goshipping.com.bd domain status, and DNS telemetry'
        };
      case 'overview':
      default:
        return {
          title: 'Operations & Freight Command Center',
          subtitle: 'Global logistics KPI metrics, warehouse occupancy & fleet status'
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

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-['Manrope',sans-serif] truncate">
                {headerDetails.title}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Active Console</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate hidden md:block">
              {headerDetails.subtitle}
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-none cursor-pointer"
            title="Refresh operational data"
          >
            <svg className={`w-3.5 h-3.5 stroke-[2] text-slate-500 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            <span className="hidden sm:inline">Sync</span>
          </button>

          {/* 1-Click Add Milestone Button */}
          <button
            onClick={() => {
              if (shipments.length > 0 && !selectedShipmentId) {
                setSelectedShipmentId(shipments[0].trackingNumber);
              }
              setShowMilestoneModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-none cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="hidden sm:inline">Milestone</span>
          </button>

          {/* New Master Consignment Button */}
          <button
            onClick={() => setShowConsignmentModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--color-brand-primary)] text-white text-xs font-bold hover:opacity-90 transition-none shadow-xs cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Consignment</span>
          </button>

          <a
            href="/logout"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-none cursor-pointer"
            title="Log out of Admin Portal"
          >
            <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </a>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
        {/* KPI COUNTER CARDS (Visible across all tabs for live context) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Master Consignments</span>
            <div className="text-2xl font-bold text-slate-900 font-['Manrope',sans-serif] tabular-nums">
              {activeConsignmentsCount || shipments.length}
            </div>
            <p className="text-xs text-slate-500">Guangzhou, Yiwu, Shenzhen ⇄ Dhaka</p>
          </div>

          <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">In-Transit Air Freight</span>
            <div className="text-2xl font-bold text-sky-600 font-['Manrope',sans-serif] tabular-nums">
              {inTransitAirCount || 1}
            </div>
            <p className="text-xs text-slate-500">Scheduled cargo flights with telemetry</p>
          </div>

          <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ocean Containers (FCL / LCL)</span>
            <div className="text-2xl font-bold text-indigo-600 font-['Manrope',sans-serif] tabular-nums">
              {seaContainersCount || 2}
            </div>
            <p className="text-xs text-slate-500">Chittagong Port & Nansha berths</p>
          </div>

          <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Rate Inquiries</span>
            <div className="text-2xl font-bold text-amber-600 font-['Manrope',sans-serif] tabular-nums">
              {pendingQuotesCount}
            </div>
            <p className="text-xs text-slate-500">Awaiting tariff calculation & pricing</p>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB: OVERVIEW (Default Dashboard Command Center)           */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Corridor Status Notification Banner */}
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></div>
                <div>
                  <h3 className="text-xs font-bold text-emerald-950 font-['Manrope',sans-serif]">
                    China ⇄ Bangladesh Express Freight Corridors Operational
                  </h3>
                  <p className="text-[11px] text-emerald-700">
                    Guangzhou Baiyun (CAN), Yiwu Trade City, and Shenzhen Qianhai (SZX) CFS stations are actively consolidating and dispatching.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => switchTab('shipments')}
                  className="px-3 py-1.5 rounded-md bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-colors"
                >
                  View All Consignments →
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
                      Recent Master Consignments
                    </h2>
                    <p className="text-xs text-slate-500">Active air and ocean freight tracking across trade lanes</p>
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
                        <th className="py-2.5 px-3">Customer / Importer</th>
                        <th className="py-2.5 px-3">Corridor & Carrier</th>
                        <th className="py-2.5 px-3">Status</th>
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
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(s.status)}`}>
                              {s.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedShipmentId(s.trackingNumber);
                                setShowMilestoneModal(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                            >
                              + Milestone
                            </button>
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
                        Rate Quotations Queue
                      </h2>
                      <p className="text-xs text-slate-500">Customer tariff requests awaiting price</p>
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
                    China & Bangladesh Warehouse CFS Stations
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
        {/* TAB: CONSIGNMENTS & TRACKING TELEMETRY                     */}
        {/* ========================================================= */}
        {(activeTab === 'shipments' || activeTab === 'tracking') && (
          <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-5 shadow-xs">
            {/* Header & Filter Strip */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                  Consignments & Waypoint Telemetry Desk
                </h2>
                <p className="text-xs text-slate-500">
                  Manage master shipments, itemized container goods, and verified milestone events
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={shipmentSearch}
                    onChange={(e) => setShipmentSearch(e.target.value)}
                    placeholder="Search tracking, customer, flight..."
                    className="h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 w-52 sm:w-64"
                  />
                  <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>

                {/* Filter Mode */}
                <select
                  value={shipmentModeFilter}
                  onChange={(e) => setShipmentModeFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 cursor-pointer"
                >
                  <option value="all">All Modes</option>
                  <option value="air">Air Cargo</option>
                  <option value="sea">Ocean Freight</option>
                  <option value="road">Road / D2D</option>
                </select>

                {/* Filter Status */}
                <select
                  value={shipmentStatusFilter}
                  onChange={(e) => setShipmentStatusFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="in_transit">In Transit</option>
                  <option value="warehouse_received">Warehouse Received</option>
                  <option value="customs_clearance">Customs Clearance</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
            </div>

            {/* Consignments Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Tracking Code</th>
                    <th className="py-3 px-4">Customer & Recipient</th>
                    <th className="py-3 px-4">Route & Carrier</th>
                    <th className="py-3 px-4">Goods & Containers</th>
                    <th className="py-3 px-4">Current Waypoint</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right pr-5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShipments.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-900">{s.trackingNumber}</div>
                        <a
                          href={`/tracking?code=${encodeURIComponent(s.trackingNumber)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#EA1D2C] hover:underline flex items-center gap-1 font-sans mt-0.5"
                        >
                          <span>Live Public View</span>
                          <span>↗</span>
                        </a>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{s.customerName}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{s.recipientAddress}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <span>{s.originCity}</span>
                          <span className="text-slate-400">→</span>
                          <span>{s.destCity}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-slate-100 text-slate-600 font-bold">
                            {s.mode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {s.voyageOrFlightNumber}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {s.items.length} units ({s.totalWeightKg} KG)
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {s.items.slice(0, 2).map((it, idx) => (
                            <span key={idx} className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                              {it.packagingType.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 max-w-[200px] truncate">
                          {s.currentLocation}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {s.events.length} verified events
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={s.status}
                          onChange={(e) => handleQuickStatusUpdate(s.id, e.target.value)}
                          className={`appearance-none px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer ${getStatusBadge(s.status)}`}
                        >
                          <option value="purchased">1. PURCHASED</option>
                          <option value="cn_warehouse_received">2. CN WAREHOUSE RECEIVED</option>
                          <option value="dispatched_from_china">3. DISPATCHED FROM CHINA</option>
                          <option value="arrived_dhaka_airport">4. ARRIVED DHAKA AIRPORT</option>
                          <option value="awaiting_customs">5. AWAITING CUSTOMS CLEARANCE</option>
                          <option value="bd_warehouse_received">6. BD WAREHOUSE RECEIVED</option>
                          <option value="payment_received">7. PAYMENT RECEIVED</option>
                          <option value="out_for_delivery">8. OUT FOR DELIVERY</option>
                          <option value="delivered">9. DELIVERED</option>
                        </select>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShipmentId(s.trackingNumber);
                              setShowMilestoneModal(true);
                            }}
                            className="px-2.5 py-1 rounded border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-[11px] font-semibold"
                            title="Add Milestone Event"
                          >
                            + Milestone
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteShipment(s.id, s.trackingNumber)}
                            className="px-2 py-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 text-[11px] flex items-center justify-center"
                            title="Delete Consignment"
                            aria-label="Delete Consignment"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No consignments matching your search filter
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
        {activeTab === 'quotes' && (
          <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                  Rate Quotations & Customer Inquiries Desk
                </h2>
                <p className="text-xs text-slate-500">
                  Review incoming cargo inquiries, issue formal freight pricing, and convert into consignments
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
        {/* TAB: CHINA & BD WAREHOUSE HUBS                             */}
        {/* ========================================================= */}
        {activeTab === 'warehouses' && (
          <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                  China & Bangladesh Warehouse CFS Stations
                </h2>
                <p className="text-xs text-slate-500">
                  Container Freight Stations (CFS), Airport Air Cargo Hubs, and Maritime Receiving Terminals
                </p>
              </div>

              <button
                onClick={() => setShowConsignmentModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#EA1D2C] text-white text-xs font-bold hover:bg-[#D41523] transition-colors"
              >
                + Dispatch Consignment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {warehouses.map((wh) => (
                <div
                  key={wh.id}
                  className="bg-white rounded-lg border border-slate-200 p-5 hover:border-slate-300 transition-colors flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {wh.code}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-800 border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active Station
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif] leading-snug">
                      {wh.name}
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">{wh.address}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Floor Capacity: <b>{wh.capacitySqft.toLocaleString()} sqft</b></span>
                      <span className="font-mono font-bold text-slate-900">{wh.currentOccupancyPct}% Occupied</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          wh.currentOccupancyPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${wh.currentOccupancyPct}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Manager:</span>
                      <span className="font-medium text-slate-800">{wh.contactPerson}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-400 font-sans">Phone:</span>
                      <span>{wh.phone}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono truncate">
                      <span className="text-slate-400 font-sans">Email:</span>
                      <span className="text-slate-700">{wh.email}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                    Enterprise User &amp; Staff Directory
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                    {filteredUsers.length} Registered Accounts
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Manage platform users, importers, administrative staff, role privileges, and Ghost Login masquerade access.
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
                              className="px-2 py-1.5 rounded border border-transparent hover:border-red-200 hover:bg-red-50 text-slate-400 hover:text-red-600 font-semibold text-[11px] transition-none cursor-pointer"
                              title="Delete user"
                            >
                              ✕
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
                  System Operations & Security Audit Trail
                </h2>
                <p className="text-xs text-slate-500">
                  Immutable tamper-evident operational logs for consignment creation, milestone telemetry, and quotations
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
                      Resend Email Gateway &amp; Telemetry
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-[#EA1D2C] font-mono">
                      support.goshipping.com.bd
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Enterprise transactional email infrastructure powered by Resend SDK with custom branded domain authentication.
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
                  <span className="text-[10px] uppercase font-bold text-slate-500">Email Telemetry</span>
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
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">✓</span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">1. Rate Quotation Inquiries</strong>
                      <span className="text-slate-600 text-[11px]">Instant acknowledgment with quote number to client, and alert notice to <code className="text-[0.9em] font-mono">ops@goshipping.com.bd</code>.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">✓</span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">2. Consignment Booking Dispatch</strong>
                      <span className="text-slate-600 text-[11px]">When Admin/Ops registers a shipment, customer receives waybill details with a 1-click live tracking link.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">✓</span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">3. Live Milestone Telemetry Checkpoints</strong>
                      <span className="text-slate-600 text-[11px]">Whenever milestone changes (e.g. Arrived Dhaka Airport, Customs Clearance), customer gets updated in BST.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">✓</span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">4. User Account Onboarding</strong>
                      <span className="text-slate-600 text-[11px]">Staff creation in Admin or user signup dispatches an enterprise welcome credential email.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">✓</span>
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
      {/* 01. MODAL: ADD TRACKING MILESTONE                          */}
      {/* ========================================================= */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                + Add Verified Milestone Event
              </h3>
              <button
                type="button"
                onClick={() => setShowMilestoneModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Consignment</label>
                <select
                  value={selectedShipmentId}
                  onChange={(e) => setSelectedShipmentId(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                >
                  {shipments.map((s) => (
                    <option key={s.id} value={s.trackingNumber}>
                      {s.trackingNumber} — {s.customerName} ({s.originCity} → {s.destCity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Standard Status Stage</label>
                  <select
                    value={eventStatus}
                    onChange={(e) => {
                      const newSt = e.target.value;
                      setEventStatus(newSt);
                      const def = TRACKING_STATUSES[newSt as TrackingStatusCode];
                      if (def) {
                        setEventTitle(def.label);
                        setEventLocation(def.defaultLocation);
                        setEventDescription(def.defaultDescription);
                      }
                    }}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-medium"
                  >
                    <option value="purchased">1. PURCHASED</option>
                    <option value="cn_warehouse_received">2. CN WAREHOUSE RECEIVED</option>
                    <option value="dispatched_from_china">3. DISPATCHED FROM CHINA</option>
                    <option value="arrived_dhaka_airport">4. ARRIVED DHAKA AIRPORT</option>
                    <option value="awaiting_customs">5. AWAITING CUSTOMS CLEARANCE</option>
                    <option value="bd_warehouse_received">6. BD WAREHOUSE RECEIVED</option>
                    <option value="payment_received">7. PAYMENT RECEIVED (Independent)</option>
                    <option value="out_for_delivery">8. OUT FOR DELIVERY</option>
                    <option value="delivered">9. DELIVERED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Verification Source</label>
                  <select
                    value={eventSource}
                    onChange={(e) => setEventSource(e.target.value as any)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="admin">Operations Dispatch / Desk</option>
                    <option value="warehouse">GoShipping Receiving Hub</option>
                    <option value="carrier_api">Carrier Telemetry API</option>
                    <option value="driver">Fleet Courier Driver</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Milestone Title</label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="e.g. AWAITING CUSTOMS CLEARANCE"
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Occurrence Time (BST / UTC)</label>
                  <input
                    type="datetime-local"
                    value={eventDateTime}
                    onChange={(e) => setEventDateTime(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                    title="Leave empty to use current time"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Location Name</label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="e.g. Dhaka Custom House, HSIA"
                  required
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Event Description & Notes</label>
                <textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  rows={2}
                  placeholder="Operational details visible on client tracking timeline..."
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Latitude (Optional)</label>
                  <input
                    type="text"
                    value={eventLat}
                    onChange={(e) => setEventLat(e.target.value)}
                    placeholder="23.8433"
                    className="w-full h-8 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Longitude (Optional)</label>
                  <input
                    type="text"
                    value={eventLng}
                    onChange={(e) => setEventLng(e.target.value)}
                    placeholder="90.4029"
                    className="w-full h-8 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMilestoneModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold"
                >
                  {submittingEvent ? 'Verifying...' : 'Save Milestone →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 02. MODAL: NEW MASTER CONSIGNMENT                          */}
      {/* ========================================================= */}
      {showConsignmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-xl w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                + Register Master Consignment & Goods
              </h3>
              <button
                type="button"
                onClick={() => setShowConsignmentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateConsignment} className="space-y-3.5 text-xs">
              {/* Customer Profile Link Selector */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 text-xs">
                    Target Customer Profile (Direct Consignment Binding)
                  </label>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Auto-Linked to Customer Portal
                  </span>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setSelectedCustomerId(cId);
                    const target = users.find((u) => u.id === cId) || customers.find((c) => c.id === cId);
                    if (target) {
                      setNewCustName(target.companyName || target.fullName);
                      setNewRecipientName(target.fullName);
                      if (target.address) setNewRecipientAddress(target.address);
                      if (target.phone) setNewRecipientPhone(target.phone);
                    }
                  }}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 cursor-pointer"
                >
                  {users.filter((u) => u.role === 'customer').map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} — {u.companyName || u.email} ({u.email})
                    </option>
                  ))}
                  {users.filter((u) => u.role !== 'customer').map((u) => (
                    <option key={u.id} value={u.id}>
                      [{u.role}] {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  Selecting this customer automatically links tracking telemetry, documents, and updates directly into their dashboard.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Importer Name</label>
                  <input
                    type="text"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={newRecipientName}
                    onChange={(e) => setNewRecipientName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recipient Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={newRecipientPhone}
                    onChange={(e) => setNewRecipientPhone(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination Address (Bangladesh)</label>
                  <input
                    type="text"
                    value={newRecipientAddress}
                    onChange={(e) => setNewRecipientAddress(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Origin City (China)</label>
                  <select
                    value={newOriginCity}
                    onChange={(e) => setNewOriginCity(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Guangzhou">Guangzhou (CAN)</option>
                    <option value="Shenzhen">Shenzhen (SZX)</option>
                    <option value="Yiwu">Yiwu Trade Hub</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination City (Bangladesh)</label>
                  <select
                    value={newDestCity}
                    onChange={(e) => setNewDestCity(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Dhaka">Dhaka (HSIA / Tejgaon)</option>
                    <option value="Chittagong">Chittagong (Port Terminal)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mode</label>
                  <select
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as any)}
                    className="w-full h-9 px-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="air">Air</option>
                    <option value="sea">Sea</option>
                    <option value="hand_carry">Hand carry</option>
                    <option value="road">Road / D2D</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Carrier Name</label>
                  <input
                    type="text"
                    value={newCarrier}
                    onChange={(e) => setNewCarrier(e.target.value)}
                    required
                    className="w-full h-9 px-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Flight / Voyage #</label>
                  <input
                    type="text"
                    value={newVoyage}
                    onChange={(e) => setNewVoyage(e.target.value)}
                    required
                    className="w-full h-9 px-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <span className="font-bold text-slate-800 text-xs block">Itemized Container Goods Spec</span>
                <div>
                  <label className="block font-medium text-slate-600 mb-1">Goods Description</label>
                  <input
                    type="text"
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    required
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 font-mono">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Package Type</label>
                    <select
                      value={newItemType}
                      onChange={(e) => setNewItemType(e.target.value)}
                      className="w-full h-8 px-1.5 rounded border border-slate-300 bg-white text-[11px]"
                    >
                      <option value="40ft_hq">40ft HQ Container</option>
                      <option value="20ft_container">20ft Container</option>
                      <option value="air_uld">Air Freight ULD</option>
                      <option value="pallet">Palletized Unit</option>
                      <option value="carton">Export Cartons</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Weight (KG)</label>
                    <input
                      type="number"
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      required
                      className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Volume (CBM)</label>
                    <input
                      type="text"
                      value={newCbm}
                      onChange={(e) => setNewCbm(e.target.value)}
                      required
                      className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Tag</label>
                    <select
                      value={newItemTag}
                      onChange={(e) => setNewItemTag(e.target.value as any)}
                      className="w-full h-8 px-1.5 rounded border border-slate-300 bg-white text-[11px]"
                    >
                      <option value="Commercial">Commercial</option>
                      <option value="General">General</option>
                      <option value="Liquids">Liquids</option>
                      <option value="Dangerous">Dangerous</option>
                      <option value="Electronics">Electronics</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConsignmentModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingConsignment}
                  className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold"
                >
                  {submittingConsignment ? 'Registering...' : 'Dispatch Consignment →'}
                </button>
              </div>
            </form>
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
    </div>
  );
}
