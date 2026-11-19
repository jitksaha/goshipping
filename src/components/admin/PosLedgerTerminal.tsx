import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { PosLedgerRecord } from '../../server/services/posLedger.service';
import { downloadPosReceiptPDF } from '../../lib/posReceiptPdf';
import { normalizeStatusCode } from '../../server/services/tracking-status';
import CombinedCommercialInvoiceModal from './CombinedCommercialInvoiceModal';

interface PosStats {
  totalOrders: number;
  totalPurchaseRmb: number;
  totalPurchaseBdt: number;
  totalFreightBdt: number;
  totalBilledBdt: number;
  totalCollectedBdt: number;
  totalDueBdt: number;
  totalWeightKg: number;
}

export default function PosLedgerTerminal({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [records, setRecords] = useState<PosLedgerRecord[]>([]);
  const [stats, setStats] = useState<PosStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Multi-Order Checkbox Selection for Batch Printing & Invoicing
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showCombinedInvoiceModal, setShowCombinedInvoiceModal] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState<'all' | 'processing' | 'hub' | 'transit' | 'delivered'>('all');
  const [financialFilter, setFinancialFilter] = useState<'all' | 'paid' | 'due'>('all');

  // Modals & Panels
  const [showPosDrawer, setShowPosDrawer] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PosLedgerRecord | null>(null);
  const [thermalReceiptRecord, setThermalReceiptRecord] = useState<PosLedgerRecord | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [showSheetSetupModal, setShowSheetSetupModal] = useState(false);
  const [isSettingUpHeaders, setIsSettingUpHeaders] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(true);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Partial Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTargetRecord, setPaymentTargetRecord] = useState<PosLedgerRecord | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<string>('bKash');
  const [paymentMilestoneInput, setPaymentMilestoneInput] = useState<string>('Installment Payment');
  const [paymentTrxIdInput, setPaymentTrxIdInput] = useState<string>('');
  const [paymentNoteInput, setPaymentNoteInput] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const openPartialPaymentModal = (rec: PosLedgerRecord) => {
    setPaymentTargetRecord(rec);
    setPaymentAmountInput(rec.purchaseCostDueBdt > 0 ? String(rec.purchaseCostDueBdt) : '');
    setPaymentMethodInput('bKash');
    setPaymentMilestoneInput('Installment Payment');
    setPaymentTrxIdInput('');
    setPaymentNoteInput('');
    setShowPaymentModal(true);
  };

  const handleRecordPartialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetRecord) return;
    const amount = Number(paymentAmountInput);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await fetch(`/api/admin/pos-ledger/${paymentTargetRecord.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method: paymentMethodInput,
          milestone: paymentMilestoneInput,
          trxId: paymentTrxIdInput,
          note: paymentNoteInput
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          `Payment of ৳${amount.toLocaleString()} recorded for ${paymentTargetRecord.orderId}!`,
          'success'
        );
        setShowPaymentModal(false);
        setPaymentTargetRecord(null);
        await loadLedger();

        // If editingRecord is open and matches this order, update it too
        if (editingRecord && editingRecord.id === data.record.id) {
          setEditingRecord(data.record);
          setFormData((prev) => ({
            ...prev,
            purchaseCostPaidBdt: data.record.purchaseCostPaidBdt
          }));
        }
      } else {
        throw new Error(data.error || 'Failed to record payment');
      }
    } catch (err: any) {
      showToast(err.message || 'Error recording payment', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Auto-detect customer filter from Users tab navigation
  useEffect(() => {
    try {
      const filterCustomer = sessionStorage.getItem('goshipping_filter_customer');
      if (filterCustomer) {
        setSearchQuery(filterCustomer);
        sessionStorage.removeItem('goshipping_filter_customer');
        showToast(`Showing orders for ${filterCustomer}`, 'info');
      }
    } catch {}

    const handleFilterEvent = (e: any) => {
      if (e.detail?.customer) {
        setSearchQuery(e.detail.customer);
        showToast(`Showing orders for ${e.detail.customer}`, 'info');
      }
    };
    window.addEventListener('goshipping:filter_orders', handleFilterEvent);
    return () => window.removeEventListener('goshipping:filter_orders', handleFilterEvent);
  }, []);

  const failedSyncsCount = useMemo(() => {
    return records.filter((r) => r.sheetSyncStatus === 'failed').length;
  }, [records]);

  const syncedCount = useMemo(() => {
    return records.filter((r) => r.sheetSyncStatus === 'synced' || !r.sheetSyncStatus).length;
  }, [records]);
  const [sheetStatus, setSheetStatus] = useState<{
    configured: boolean;
    webhookUrl?: string;
    webhookUrlMasked?: string;
    sheetUrl?: string;
    sheetTab?: string;
    columnsCount?: number;
  } | null>(null);

  const fetchSheetStatus = async () => {
    try {
      const res = await fetch('/api/admin/pos-ledger/sync-sheet/status');
      const data = await res.json();
      setSheetStatus(data);
      if (data.webhookUrl) {
        setWebhookUrlInput(data.webhookUrl);
      }
    } catch {}
  };

  useEffect(() => {
    fetchSheetStatus();
  }, []);

  const handleSaveWebhookUrl = async () => {
    if (!webhookUrlInput.trim() || !webhookUrlInput.startsWith('https://script.google.com/')) {
      showToast('Please enter a valid Google Apps Script URL (starts with https://script.google.com/)', 'error');
      return;
    }
    setIsSavingWebhook(true);
    try {
      const res = await fetch('/api/admin/pos-ledger/sync-sheet/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrlInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Google Sheet Webhook URL saved successfully!', 'success');
        fetchSheetStatus();
      } else {
        throw new Error(data.error || 'Failed to save webhook URL');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving webhook URL', 'error');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  // Quick POS Form State
  const [formData, setFormData] = useState({
    orderId: '',
    orderDate: '',
    cnDate: '',
    bdDate: '',
    customerName: '',
    mobileNo: '',
    importerClient: '',
    shippingMark: '',
    websiteOrderNo: '',
    itemDetails: '',
    chinaCourierTracking: '',
    currentStatus: 'Processing',
    supplierName: 'Taobao',
    quantity: 1 as number | string,
    unitPriceRmb: '' as number | string,
    rmbRateBdt: '19.5' as number | string,
    purchaseCostPaidBdt: '' as number | string,
    serviceType: 'Sourcing & Shipping',
    cnWeightKg: '' as number | string,
    bdWeightKg: '' as number | string,
    shippingRatePerKgBdt: 850 as number | string,
    bdCourierName: 'Steadfast',
    bdTrackingNo: '',
    remark: ''
  });

  // Live Auto Computed Values for the POS form
  const computedForm = useMemo(() => {
    const qty = Number(formData.quantity) || 0;
    const unitRmb = Number(formData.unitPriceRmb) || 0;
    const totalRmb = Math.round(qty * unitRmb * 100) / 100;

    const rmbRate = Number(formData.rmbRateBdt) || 19.5;
    const purchaseCostBdt = Math.round(totalRmb * rmbRate * 100) / 100;

    const paidBdt = Number(formData.purchaseCostPaidBdt) || 0;
    const purchaseDueBdt = Math.max(0, Math.round((purchaseCostBdt - paidBdt) * 100) / 100);

    const weight = Number(formData.bdWeightKg) || Number(formData.cnWeightKg) || 0;
    const rate = Number(formData.shippingRatePerKgBdt) || 0;
    const intlFreightBdt = Math.round(weight * rate * 100) / 100;

    const totalBillBdt = Math.round((purchaseCostBdt + intlFreightBdt) * 100) / 100;

    let paymentStatus: 'Due' | 'Paid' | 'Partial' = 'Due';
    if (paidBdt >= totalBillBdt && totalBillBdt > 0) {
      paymentStatus = 'Paid';
    } else if (paidBdt > 0) {
      paymentStatus = 'Partial';
    }

    return {
      totalRmb,
      purchaseCostBdt,
      purchaseDueBdt,
      intlFreightBdt,
      totalBillBdt,
      paymentStatus
    };
  }, [formData]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (serviceFilter !== 'all') params.set('serviceType', serviceFilter);
      if (paymentFilter !== 'all') params.set('paymentStatus', paymentFilter);
      if (supplierFilter !== 'all') params.set('supplier', supplierFilter);

      const res = await fetch(`/api/admin/pos-ledger?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
        setStats(data.stats || null);
      }
    } catch {
      showToast('Failed to load POS operations ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLedger();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, serviceFilter, paymentFilter, supplierFilter]);

  // Handle direct navigation to edit order from external tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetEditId = sessionStorage.getItem('goshipping_edit_order_id');
    if (targetEditId && records.length > 0) {
      sessionStorage.removeItem('goshipping_edit_order_id');
      const target = records.find(
        (r) =>
          r.orderId.toUpperCase() === targetEditId.toUpperCase() ||
          r.id === targetEditId ||
          (r.bdTrackingNo && r.bdTrackingNo.toUpperCase() === targetEditId.toUpperCase())
      );
      if (target) {
        openEditDrawer(target);
      }
    }
  }, [records]);

  const resetForm = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('goshipping_pos_draft');
        localStorage.removeItem('goshipping_create_order_draft');
      }
    } catch {}
    setFormData({
      orderId: '',
      orderDate: '',
      cnDate: '',
      bdDate: '',
      customerName: '',
      mobileNo: '',
      importerClient: '',
      shippingMark: '',
      websiteOrderNo: '',
      itemDetails: '',
      chinaCourierTracking: '',
      currentStatus: 'Processing',
      supplierName: 'Taobao',
      quantity: 1,
      unitPriceRmb: '',
      rmbRateBdt: '19.5',
      purchaseCostPaidBdt: '',
      serviceType: 'Sourcing & Shipping',
      cnWeightKg: '',
      bdWeightKg: '',
      shippingRatePerKgBdt: 850,
      bdCourierName: 'Steadfast',
      bdTrackingNo: '',
      remark: ''
    });
    setEditingRecord(null);
  };

  const openNewOrderDrawer = () => {
    resetForm();
    setShowPosDrawer(true);
  };

  const openEditDrawer = (rec: PosLedgerRecord) => {
    setEditingRecord(rec);
    setFormData({
      orderId: rec.orderId || '',
      orderDate: rec.orderDate || '',
      cnDate: rec.cnDate || '',
      bdDate: rec.bdDate || '',
      customerName: rec.customerName || '',
      mobileNo: rec.mobileNo || '',
      importerClient: rec.importerClient || '',
      shippingMark: rec.shippingMark || '',
      websiteOrderNo: rec.websiteOrderNo || '',
      itemDetails: rec.itemDetails || '',
      chinaCourierTracking: rec.chinaCourierTracking || '',
      currentStatus: rec.currentStatus || 'PURCHASED',
      supplierName: rec.supplierName || 'Taobao',
      quantity: rec.quantity,
      unitPriceRmb: rec.unitPriceRmb,
      rmbRateBdt: rec.rmbRateBdt,
      purchaseCostPaidBdt: rec.purchaseCostPaidBdt,
      serviceType: rec.serviceType || 'Sourcing & Shipping',
      cnWeightKg: rec.cnWeightKg,
      bdWeightKg: rec.bdWeightKg,
      shippingRatePerKgBdt: rec.shippingRatePerKgBdt,
      bdCourierName: rec.bdCourierName || 'Steadfast',
      bdTrackingNo: rec.bdTrackingNo || '',
      remark: rec.remark || ''
    });
    setShowPosDrawer(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      showToast('Customer Name is required', 'error');
      return;
    }
    setSavingRecord(true);
    try {
      const payload = {
        ...formData,
        quantity: Number(formData.quantity) || 1,
        unitPriceRmb: Number(formData.unitPriceRmb) || 0,
        rmbRateBdt: Number(formData.rmbRateBdt) || 19.5,
        purchaseCostPaidBdt: Number(formData.purchaseCostPaidBdt) || 0,
        cnWeightKg: Number(formData.cnWeightKg) || 0,
        bdWeightKg: Number(formData.bdWeightKg) || 0,
        shippingRatePerKgBdt: Number(formData.shippingRatePerKgBdt) || 0
      };

      if (editingRecord) {
        // Update
        const res = await fetch(`/api/admin/pos-ledger/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update order');
        const syncBadge = data.record?.sheetSyncStatus === 'synced' ? ' & synced to Google Sheet!' : '!';
        showToast(`Order ${data.record.orderId} updated successfully${syncBadge}`, 'success');
      } else {
        // Create
        const res = await fetch('/api/admin/pos-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create order');
        const syncBadge = data.record?.sheetSyncStatus === 'synced' ? ' & synced to Google Sheet!' : '!';
        showToast(`Order ${data.record.orderId} created in POS Ledger${syncBadge}`, 'success');
      }
      setShowPosDrawer(false);
      resetForm();
      await loadLedger();
    } catch (err: any) {
      showToast(err.message || 'Error saving POS order', 'error');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDelete = async (id: string, orderId: string) => {
    if (!confirm(`Are you sure you want to delete order ${orderId}? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/pos-ledger/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Order ${orderId} deleted successfully`, 'success');
        loadLedger();
      } else {
        throw new Error('Delete failed');
      }
    } catch {
      showToast('Error deleting record', 'error');
    }
  };

  const handleQuickPaymentToggle = async (rec: PosLedgerRecord) => {
    const isPaid = rec.paymentStatus === 'Paid';
    const newPaidAmount = isPaid ? 0 : rec.totalBillBdt;
    try {
      const res = await fetch(`/api/admin/pos-ledger/${rec.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseCostPaidBdt: newPaidAmount })
      });
      if (res.ok) {
        showToast(`Payment marked as ${isPaid ? 'Due' : 'Fully Paid'} for ${rec.orderId}`, 'info');
        loadLedger();
      }
    } catch {
      showToast('Failed to update payment status', 'error');
    }
  };

  const handleImportCsv = async () => {
    if (!importCsvText.trim()) {
      showToast('Please paste valid CSV content', 'error');
      return;
    }
    setIsImporting(true);
    try {
      const res = await fetch('/api/admin/pos-ledger/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: importCsvText })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Imported ${data.imported} orders successfully!`, 'success');
        setShowImportModal(false);
        setImportCsvText('');
        loadLedger();
      } else {
        throw new Error(data.error || 'Failed to import CSV');
      }
    } catch (err: any) {
      showToast(err.message || 'Import error', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadPdf = (rec: PosLedgerRecord) => {
    try {
      downloadPosReceiptPDF(rec);
      showToast(`Downloaded official PDF receipt for ${rec.orderId}`, 'success');
    } catch {
      showToast('Failed to generate PDF receipt', 'error');
    }
  };

  const handleCopyTrackingLink = async (rec: PosLedgerRecord) => {
    const code = (rec.bdTrackingNo && rec.bdTrackingNo.toUpperCase().startsWith('GOSH-'))
      ? rec.bdTrackingNo.trim()
      : (rec.orderId || rec.bdTrackingNo || rec.id);

    const baseUrl = typeof window !== 'undefined' && window.location.origin.includes('admin.')
      ? 'https://goshipping.com.bd'
      : (typeof window !== 'undefined' ? window.location.origin : 'https://goshipping.com.bd');

    const trackingUrl = `${baseUrl}/tracking?code=${encodeURIComponent(code)}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(trackingUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = trackingUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedOrderId(rec.id);
      showToast(`Copied tracking link: ${trackingUrl}`, 'success');
      setTimeout(() => {
        setCopiedOrderId((prev) => (prev === rec.id ? null : prev));
      }, 2000);
    } catch {
      showToast('Could not copy link to clipboard', 'error');
    }
  };

  const handleSyncGoogleSheet = async () => {
    setIsSyncingSheet(true);
    try {
      const res = await fetch('/api/admin/pos-ledger/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Synced ${data.result?.successful || 0} orders to Google Sheet successfully!`, 'success');
      } else {
        throw new Error(data.error || 'Failed to sync to Google Sheet');
      }
    } catch (err: any) {
      showToast(err.message || 'Google Sheet sync error', 'error');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleSyncSingleOrder = async (recordId: string, orderCode: string) => {
    setSyncingOrderId(recordId);
    setRecords((prev) =>
      prev.map((item) => (item.id === recordId ? { ...item, sheetSyncStatus: 'pending' } : item))
    );
    try {
      const res = await fetch('/api/admin/pos-ledger/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recordId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Order ${orderCode} synced to Google Sheet!`, 'success');
        setRecords((prev) =>
          prev.map((item) =>
            item.id === recordId
              ? { ...item, sheetSyncStatus: 'synced', sheetSyncedAt: new Date().toISOString(), sheetSyncError: undefined }
              : item
          )
        );
      } else {
        throw new Error(data.error || 'Failed to sync order');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Sync error';
      showToast(errMsg, 'error');
      setRecords((prev) =>
        prev.map((item) =>
          item.id === recordId
            ? { ...item, sheetSyncStatus: 'failed', sheetSyncError: errMsg }
            : item
        )
      );
    } finally {
      setSyncingOrderId(null);
    }
  };

  const handleRetryFailedSyncs = async () => {
    setIsRetryingFailed(true);
    try {
      const res = await fetch('/api/admin/pos-ledger/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_failed' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const total = data.result?.total || 0;
        const passed = data.result?.successful || 0;
        const failed = data.result?.failed || 0;
        showToast(
          `Processed ${total} orders (${passed} synced successfully, ${failed} failed)`,
          failed === 0 ? 'success' : 'info'
        );
        loadLedger();
      } else {
        throw new Error(data.error || 'Failed to retry syncs');
      }
    } catch (err: any) {
      showToast(err.message || 'Retry failed', 'error');
    } finally {
      setIsRetryingFailed(false);
    }
  };

  const handleSetupSheetHeaders = async () => {
    setIsSettingUpHeaders(true);
    try {
      const res = await fetch('/api/admin/pos-ledger/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup_headers' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Google Sheet headers initialized and styled successfully!', 'success');
      } else {
        throw new Error(data.error || 'Failed to setup headers');
      }
    } catch (err: any) {
      showToast(err.message || 'Header setup error', 'error');
    } finally {
      setIsSettingUpHeaders(false);
    }
  };

  const copyHeadersToClipboard = () => {
    const headersTab = "Order ID\tOrder Date\tCN Date\tChina Courier Tracking (SF/ZTO)\tCustomer Name\tCurrent Status\tMobile No\tImporter / Client\tShipping Mark\tWebsite Order No\tItem / Product Details\tSupplier / Shop Name\tQuantity (Pcs)\tUnit Price (RMB)\tTotal Purchase (RMB) [Auto]\tRMB Rate (BDT)\tPurchase Cost (BDT) [Auto]\tPurchase Cost Paid     [ Customer ]\tPurchase Cost Due [Auto]\tService Type\tBD Date\tBD Weight (KG)\tShipping Rate / KG (BDT)\tInternational Freight (BDT) [Auto]\tTotal Bill (BDT) [Auto]\tPayment Status [Auto]\tBD Tracking No\tRemark / Customer Update";
    navigator.clipboard.writeText(headersTab);
    setCopiedHeaders(true);
    showToast('28 Column Titles copied! Paste directly in cell A1 of Google Sheets', 'success');
    setTimeout(() => setCopiedHeaders(false), 3000);
  };

  const copyScriptToClipboard = () => {
    const fullScript = `/**
 * =========================================================================
 * GoShipping Official POS Ledger & Order Synchronization Script 2026
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1K7JQIwYXmKjy6CsLufuV-2Adljqg2qhJSwUQOboJUwQ/edit?gid=0#gid=0
 * Sheet Tab Name: "Sheet1" (Cols A to AB: 28 Columns)
 * =========================================================================
 */
var HEADERS = [
  "Order ID",                          // 1 (A)
  "Order Date",                        // 2 (B)
  "CN Date",                           // 3 (C)
  "China Courier Tracking (SF/ZTO)",   // 4 (D)
  "Customer Name",                     // 5 (E)
  "Current Status",                    // 6 (F)
  "Mobile No",                         // 7 (G)
  "Importer / Client",                 // 8 (H)
  "Shipping Mark",                     // 9 (I)
  "Website Order No",                  // 10 (J)
  "Item / Product Details",            // 11 (K)
  "Supplier / Shop Name",              // 12 (L)
  "Quantity (Pcs)",                    // 13 (M)
  "Unit Price (RMB)",                  // 14 (N)
  "Total Purchase (RMB) [Auto]",       // 15 (O)
  "RMB Rate (BDT)",                    // 16 (P)
  "Purchase Cost (BDT) [Auto]",        // 17 (Q)
  "Purchase Cost Paid     [ Customer ]", // 18 (R)
  "Purchase Cost Due [Auto]",          // 19 (S)
  "Service Type",                      // 20 (T)
  "BD Date",                           // 21 (U)
  "BD Weight (KG)",                    // 22 (V)
  "Shipping Rate / KG (BDT)",          // 23 (W)
  "International Freight (BDT) [Auto]", // 24 (X)
  "Total Bill (BDT) [Auto]",           // 25 (Y)
  "Payment Status [Auto]",             // 26 (Z)
  "BD Tracking No",                    // 27 (AA)
  "Remark / Customer Update"           // 28 (AB)
];

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("All-in-One") || ss.getActiveSheet();
  var firstCellVal = sheet.getRange(1, 1).getValue().toString().trim();

  if (firstCellVal !== "Order ID") {
    sheet.insertRowBefore(1);
  }

  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setBackground("#11181E")
             .setFontColor("#FFFFFF")
             .setFontWeight("bold")
             .setFontSize(10)
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle")
             .setWrap(true);

  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  sheet.getRange("A:A").setNumberFormat("@");
  sheet.getRange("D:D").setNumberFormat("@");
  sheet.getRange("G:G").setNumberFormat("@");
  sheet.getRange("I:I").setNumberFormat("@");
  sheet.getRange("J:J").setNumberFormat("@");
  sheet.getRange("AA:AA").setNumberFormat("@");

  for (var c = 1; c <= HEADERS.length; c++) {
    sheet.autoResizeColumn(c);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 GoShipping')
    .addItem('⚙️ Setup Sheet Headers & Styling', 'setupSheet')
    .addToUi();
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("All-in-One") || ss.getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === "setup_headers") {
      setupSheet();
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Headers initialized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var orderId = data.orderId;
    if (!orderId) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing orderId" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var lastRow = sheet.getLastRow();
    var targetRow = -1;

    if (lastRow > 1) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === String(orderId).trim()) {
          targetRow = i + 2;
          break;
        }
      }
    }

    if (targetRow === -1 && lastRow > 1) {
      var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var j = 0; j < colA.length; j++) {
        var valA = String(colA[j][0] || '').trim();
        if (valA === '') {
          targetRow = j + 2;
          break;
        }
      }
    }

    var mobile = data.mobileNo ? String(data.mobileNo) : '';
    if (mobile && !mobile.startsWith("'")) {
      mobile = "'" + mobile;
    }
    
    var rowValues = (data.rowValues && data.rowValues.length === 29) ? data.rowValues : [
      data.orderId || '',
      data.orderDate || '',
      data.cnDate || '',
      data.chinaCourierTracking || '',
      data.customerName || '',
      data.currentStatus || 'Processing',
      mobile,
      data.importerClient || '',
      data.shippingMark || '',
      data.websiteOrderNo || '',
      data.itemDetails || '',
      data.supplierName || 'Taobao',
      Number(data.quantity) || 1,
      Number(data.unitPriceRmb) || 0,
      Number(data.totalPurchaseRmb) || 0,
      Number(data.rmbRateBdt) || 19.5,
      Number(data.purchaseCostBdt) || 0,
      Number(data.purchaseCostPaidBdt) || 0,
      Number(data.purchaseCostDueBdt) || 0,
      data.serviceType || 'Sourcing & Shipping',
      data.bdDate || '',
      Number(data.bdWeightKg) || 0,
      Number(data.shippingRatePerKgBdt) || 850,
      Number(data.internationalFreightBdt) || 0,
      Number(data.totalBillBdt) || 0,
      data.paymentStatus || 'Due',
      data.bdTrackingNo || '',
      data.remark || ''
    ];
    
    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
      targetRow = sheet.getLastRow();
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      orderId: orderId,
      row: targetRow,
      action: targetRow > 0 ? 'updated' : 'appended'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
    navigator.clipboard.writeText(fullScript);
    setCopiedScript(true);
    showToast('Complete 29-Column Google Apps Script copied!', 'success');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  // Computed Analytics & Visual Report Metrics (Super Dynamic & 100% Normalized)
  const analytics = useMemo(() => {
    const totalCount = records.length;
    
    // Status pipeline counts using normalizeStatusCode so every single status is reliably mapped
    const statusCounts = {
      processing: records.filter((r) => normalizeStatusCode(r.currentStatus || 'purchased') === 'purchased').length,
      hub: records.filter((r) => normalizeStatusCode(r.currentStatus || '') === 'cn_warehouse_received').length,
      transit: records.filter((r) => ['dispatched_from_china', 'arrived_dhaka_airport', 'awaiting_customs'].includes(normalizeStatusCode(r.currentStatus || ''))).length,
      delivered: records.filter((r) => ['bd_warehouse_received', 'out_for_delivery', 'delivered', 'payment_received'].includes(normalizeStatusCode(r.currentStatus || ''))).length,
    };

    // Live Financial split computed dynamically from loaded records
    const liveBilled = records.reduce((sum, r) => sum + (Number(r.totalBillBdt) || 0), 0);
    const liveCollected = records.reduce((sum, r) => sum + (Number(r.purchaseCostPaidBdt) || 0), 0);
    const liveDue = Math.max(0, liveBilled - liveCollected);

    const totalBilled = liveBilled || stats?.totalBilledBdt || 0;
    const totalCollected = liveCollected || stats?.totalCollectedBdt || 0;
    const totalDue = totalBilled > 0 ? Math.max(0, totalBilled - totalCollected) : (stats?.totalDueBdt || 0);
    const collectionPercent = totalBilled > 0 ? Math.min(100, Math.round((totalCollected / totalBilled) * 100)) : 0;
    const duePercent = Math.max(0, 100 - collectionPercent);

    // Service breakdown
    const serviceCounts = {
      sourcingAndShipping: records.filter((r) => {
        const st = (r.serviceType || '').toLowerCase();
        return st.includes('sourcing') && st.includes('shipping');
      }).length,
      sourcingOnly: records.filter((r) => {
        const st = (r.serviceType || '').toLowerCase();
        return st.includes('sourcing') && !st.includes('shipping');
      }).length,
      freightCargo: records.filter((r) => {
        const st = (r.serviceType || '').toLowerCase();
        return st.includes('cargo') || st.includes('freight') || (!st.includes('sourcing') && st.length > 0);
      }).length,
    };

    // Trend points from records for sparklines
    const revRaw = records.slice(0, 10).reverse().map((r) => Number(r.totalBillBdt) || 100);
    const rmbRaw = records.slice(0, 10).reverse().map((r) => Number(r.totalPurchaseRmb) || 50);
    const freightRaw = records.slice(0, 10).reverse().map((r) => Number(r.internationalFreightBdt) || 80);
    const weightRaw = records.slice(0, 10).reverse().map((r) => Number(r.bdWeightKg || r.cnWeightKg) || 10);

    return {
      statusCounts,
      totalBilled,
      totalCollected,
      totalDue,
      collectionPercent,
      duePercent,
      serviceCounts,
      revenuePoints: revRaw.length >= 2 ? revRaw : [12000, 24000, 18000, 42000, 31000, 56000, 81000],
      rmbPoints: rmbRaw.length >= 2 ? rmbRaw : [800, 1500, 1100, 2300, 1900, 3000, 4200],
      freightPoints: freightRaw.length >= 2 ? freightRaw : [4000, 8500, 6200, 11000, 9500, 16000, 22500],
      weightPoints: weightRaw.length >= 2 ? weightRaw : [8, 15, 12, 22, 19, 28, 35]
    };
  }, [records, stats]);

  // Dynamic filter for displayed records based on stageFilter and financialFilter
  const displayedRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. Stage filter
      if (stageFilter !== 'all') {
        const code = normalizeStatusCode(r.currentStatus || 'purchased');
        if (stageFilter === 'processing' && code !== 'purchased') return false;
        if (stageFilter === 'hub' && code !== 'cn_warehouse_received') return false;
        if (stageFilter === 'transit' && !['dispatched_from_china', 'arrived_dhaka_airport', 'awaiting_customs'].includes(code)) return false;
        if (stageFilter === 'delivered' && !['bd_warehouse_received', 'out_for_delivery', 'delivered', 'payment_received'].includes(code)) return false;
      }

      // 2. Financial filter
      if (financialFilter === 'paid') {
        const billed = Number(r.totalBillBdt) || 0;
        const paid = Number(r.purchaseCostPaidBdt) || 0;
        const due = Math.max(0, billed - paid);
        if (due > 0 && r.paymentStatus !== 'Paid') return false;
      } else if (financialFilter === 'due') {
        const billed = Number(r.totalBillBdt) || 0;
        const paid = Number(r.purchaseCostPaidBdt) || 0;
        const due = Math.max(0, billed - paid);
        if (due <= 0 && r.paymentStatus === 'Paid') return false;
      }

      return true;
    });
  }, [records, stageFilter, financialFilter]);

  // Checkbox Selection Helpers
  const isAllSelected = useMemo(() => {
    if (displayedRecords.length === 0) return false;
    return displayedRecords.every((r) => selectedOrderIds.includes(r.id));
  }, [displayedRecords, selectedOrderIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(displayedRecords.map((r) => r.id));
    }
  };

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedRecords = useMemo(() => {
    return records.filter((r) => selectedOrderIds.includes(r.id));
  }, [records, selectedOrderIds]);

  const selectedTotals = useMemo(() => {
    const totalBillBdt = selectedRecords.reduce((acc, r) => acc + (Number(r.totalBillBdt) || 0), 0);
    const totalPaidBdt = selectedRecords.reduce((acc, r) => acc + (Number(r.purchaseCostPaidBdt) || 0), 0);
    const totalDueBdt = Math.max(0, totalBillBdt - totalPaidBdt);
    return {
      count: selectedRecords.length,
      totalBillBdt: Math.round(totalBillBdt),
      totalPaidBdt: Math.round(totalPaidBdt),
      totalDueBdt: Math.round(totalDueBdt)
    };
  }, [selectedRecords]);

  // Pure SVG mini-sparkline renderer
  const renderSparkline = (points: number[], strokeColor: string, fillColor: string) => {
    if (!points || points.length < 2) points = [10, 20, 15, 30, 25, 40];
    const min = Math.min(...points);
    const max = Math.max(...points) || 1;
    const range = max - min || 1;
    const width = 84;
    const height = 28;
    const coords = points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const pathD = `M ${coords.join(' L ')}`;
    const areaD = `M 0,${height} L ${coords.join(' L ')} L ${width},${height} Z`;

    return (
      <svg className="w-21 h-7 overflow-visible shrink-0" viewBox={`0 0 ${width} ${height}`}>
        <path d={areaD} fill={fillColor} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // Pure SVG mini-bar renderer
  const renderMiniBars = (points: number[], barColor: string) => {
    if (!points || points.length === 0) points = [6, 12, 8, 18, 14, 22, 28];
    const max = Math.max(...points) || 1;
    return (
      <div className="flex items-end gap-1 h-7 shrink-0">
        {points.slice(-6).map((val, i) => {
          const heightPct = Math.max(18, Math.round((val / max) * 100));
          return (
            <div
              key={i}
              className="w-1.5 rounded-t-xs"
              style={{ height: `${heightPct}%`, backgroundColor: barColor }}
              title={`Metric: ${val}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      {/* 1. EXECUTIVE KPI CARDS & REPORT SPARKLINES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Orders & Cargo Weight */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                Total Orders
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-0.5 font-['Manrope',sans-serif] tracking-tight">
                {stats?.totalOrders || 0}
              </div>
            </div>
            {renderMiniBars(analytics.weightPoints, '#3B82F6')}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
            <span className="text-slate-600 font-medium">{stats?.totalWeightKg || 0} KG Cargo</span>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Active Cargo</span>
          </div>
        </div>

        {/* Card 2: China Sourcing (RMB & BDT) */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                China Sourcing (RMB)
              </span>
              <div className="text-2xl font-extrabold text-amber-600 mt-0.5 font-mono tracking-tight">
                ¥{(stats?.totalPurchaseRmb || 0).toLocaleString()}
              </div>
            </div>
            {renderSparkline(analytics.rmbPoints, '#D97706', 'rgba(217, 119, 6, 0.12)')}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
            <span className="text-slate-600 font-mono font-semibold">৳{(stats?.totalPurchaseBdt || 0).toLocaleString()} BDT</span>
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">1688 / Taobao</span>
          </div>
        </div>

        {/* Card 3: Int'l Freight Logistics */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                Int'l Freight
              </span>
              <div className="text-2xl font-extrabold text-sky-600 mt-0.5 font-mono tracking-tight">
                ৳{(stats?.totalFreightBdt || 0).toLocaleString()}
              </div>
            </div>
            {renderSparkline(analytics.freightPoints, '#0284C7', 'rgba(2, 132, 199, 0.12)')}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
            <span className="text-slate-500 font-medium">Air &amp; Sea Linehaul</span>
            <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">Logistics</span>
          </div>
        </div>

        {/* Card 4: Total Revenue (Billed) */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                Total Revenue
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-0.5 font-mono tracking-tight">
                ৳{(stats?.totalBilledBdt || 0).toLocaleString()}
              </div>
            </div>
            {renderSparkline(analytics.revenuePoints, '#10B981', 'rgba(16, 185, 129, 0.12)')}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
            <span className="text-slate-600 font-mono font-medium">Orders: <strong className="text-slate-900 font-bold">{stats?.totalOrders || 0}</strong></span>
            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">Freight: ৳{(stats?.totalFreightBdt || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Card 5: Collected vs Due Balance */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2.5 col-span-2 sm:col-span-1">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Cash Flow
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                {analytics.collectionPercent}% Cleared
              </span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-0.5 font-mono tracking-tight">
              ৳{(stats?.totalCollectedBdt || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
              <div style={{ width: `${analytics.collectionPercent}%` }} className="bg-emerald-500 h-full" />
              <div style={{ width: `${analytics.duePercent}%` }} className="bg-rose-500 h-full" />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-500">Collected</span>
              <span className="text-rose-600 font-bold">Due: ৳{(stats?.totalDueBdt || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. OPERATIONAL PIPELINE & FINANCIAL CLEARANCE REPORT BAR (Super Dynamic & Interactive) */}
      <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EA1D2C] animate-pulse"></span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-['Manrope',sans-serif]">
              Operational Pipeline &amp; Settlement Report
            </h3>
            {(stageFilter !== 'all' || financialFilter !== 'all') && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-[#EA1D2C] border border-red-200 font-mono">
                Filter: {stageFilter !== 'all' ? stageFilter.toUpperCase() : ''} {financialFilter !== 'all' ? financialFilter.toUpperCase() : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            {(stageFilter !== 'all' || financialFilter !== 'all') ? (
              <button
                type="button"
                onClick={() => {
                  setStageFilter('all');
                  setFinancialFilter('all');
                }}
                className="text-xs font-bold text-[#EA1D2C] hover:underline cursor-pointer"
              >
                ✕ Reset Pipeline Filters
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Live Google Sheet Synced
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Section A: Consignment Stage Distribution (Clickable Interactive Stage Filter) */}
          <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200/70 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span>Consignment Stages</span>
              <span className="text-slate-400 font-mono font-normal">Click to Filter Orders</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setStageFilter(stageFilter === 'processing' ? 'all' : 'processing')}
                className={`p-2 rounded-md border flex items-center justify-between shadow-3xs cursor-pointer transition-all text-left ${
                  stageFilter === 'processing'
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200'
                    : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/20'
                }`}
                title="Filter by Processing / Purchased orders"
              >
                <span className="text-slate-700 text-[11px] font-medium">Processing</span>
                <span className="font-bold text-amber-600 font-mono">{analytics.statusCounts.processing}</span>
              </button>

              <button
                type="button"
                onClick={() => setStageFilter(stageFilter === 'hub' ? 'all' : 'hub')}
                className={`p-2 rounded-md border flex items-center justify-between shadow-3xs cursor-pointer transition-all text-left ${
                  stageFilter === 'hub'
                    ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-200'
                    : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50/20'
                }`}
                title="Filter by CN Warehouse Received orders"
              >
                <span className="text-slate-700 text-[11px] font-medium">CN Hub</span>
                <span className="font-bold text-sky-600 font-mono">{analytics.statusCounts.hub}</span>
              </button>

              <button
                type="button"
                onClick={() => setStageFilter(stageFilter === 'transit' ? 'all' : 'transit')}
                className={`p-2 rounded-md border flex items-center justify-between shadow-3xs cursor-pointer transition-all text-left ${
                  stageFilter === 'transit'
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/20'
                }`}
                title="Filter by In Transit / Airport / Customs orders"
              >
                <span className="text-slate-700 text-[11px] font-medium">In Transit</span>
                <span className="font-bold text-blue-600 font-mono">{analytics.statusCounts.transit}</span>
              </button>

              <button
                type="button"
                onClick={() => setStageFilter(stageFilter === 'delivered' ? 'all' : 'delivered')}
                className={`p-2 rounded-md border flex items-center justify-between shadow-3xs cursor-pointer transition-all text-left ${
                  stageFilter === 'delivered'
                    ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200'
                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20'
                }`}
                title="Filter by BD Warehouse / Delivered orders"
              >
                <span className="text-slate-700 text-[11px] font-medium">Delivered</span>
                <span className="font-bold text-emerald-600 font-mono">{analytics.statusCounts.delivered}</span>
              </button>
            </div>
          </div>

          {/* Section B: Financial Settlement Ratio Bar (Clickable Paid vs Due Filter) */}
          <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200/70 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span>Financial Clearance</span>
              <span className="text-emerald-700 font-mono font-bold">{analytics.collectionPercent}% Settled</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${analytics.collectionPercent}%` }}
                className="bg-emerald-500 h-full transition-all cursor-pointer hover:opacity-90"
                title={`Collected: ৳${analytics.totalCollected.toLocaleString()} (${analytics.collectionPercent}%) - Click to filter Paid`}
                onClick={() => setFinancialFilter(financialFilter === 'paid' ? 'all' : 'paid')}
              />
              <div
                style={{ width: `${analytics.duePercent}%` }}
                className="bg-rose-500 h-full transition-all cursor-pointer hover:opacity-90"
                title={`Due: ৳${analytics.totalDue.toLocaleString()} (${analytics.duePercent}%) - Click to filter Due`}
                onClick={() => setFinancialFilter(financialFilter === 'due' ? 'all' : 'due')}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
              <button
                type="button"
                onClick={() => setFinancialFilter(financialFilter === 'paid' ? 'all' : 'paid')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                  financialFilter === 'paid'
                    ? 'bg-emerald-100 text-emerald-900 font-extrabold ring-1 ring-emerald-400'
                    : 'text-emerald-700 font-bold hover:bg-emerald-50'
                }`}
                title="Click to view Paid orders"
              >
                ৳{analytics.totalCollected.toLocaleString()} Paid {financialFilter === 'paid' && '✓'}
              </button>
              <button
                type="button"
                onClick={() => setFinancialFilter(financialFilter === 'due' ? 'all' : 'due')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                  financialFilter === 'due'
                    ? 'bg-rose-100 text-rose-900 font-extrabold ring-1 ring-rose-400'
                    : 'text-rose-600 font-bold hover:bg-rose-50'
                }`}
                title="Click to view Due orders"
              >
                ৳{analytics.totalDue.toLocaleString()} Due {financialFilter === 'due' && '✓'}
              </button>
            </div>
          </div>

          {/* Section C: Service Breakdown (Clickable Service Filter) */}
          <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200/70 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span>Service Breakdown</span>
              <span className="text-slate-400 font-mono font-normal">Consignment Mix</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div
                onClick={() => setServiceFilter(serviceFilter === 'Sourcing & Shipping' ? 'all' : 'Sourcing & Shipping')}
                className={`flex items-center justify-between text-[11px] p-1.5 rounded cursor-pointer transition-colors ${
                  serviceFilter === 'Sourcing & Shipping'
                    ? 'bg-red-50 text-[#EA1D2C] font-bold border border-red-200 ring-1 ring-red-200'
                    : 'hover:bg-white text-slate-600'
                }`}
                title="Click to filter Sourcing & Shipping orders"
              >
                <span>Sourcing &amp; Shipping</span>
                <span className="font-mono font-bold text-slate-900">{analytics.serviceCounts.sourcingAndShipping} orders</span>
              </div>
              <div
                onClick={() => setServiceFilter(serviceFilter === 'Sourcing Only' ? 'all' : 'Sourcing Only')}
                className={`flex items-center justify-between text-[11px] p-1.5 rounded cursor-pointer transition-colors ${
                  serviceFilter === 'Sourcing Only'
                    ? 'bg-red-50 text-[#EA1D2C] font-bold border border-red-200 ring-1 ring-red-200'
                    : 'hover:bg-white text-slate-600'
                }`}
                title="Click to filter China Sourcing Only orders"
              >
                <span>China Sourcing Only</span>
                <span className="font-mono font-bold text-slate-900">{analytics.serviceCounts.sourcingOnly} orders</span>
              </div>
              <div
                onClick={() => setServiceFilter(serviceFilter === 'Air Cargo' ? 'all' : 'Air Cargo')}
                className={`flex items-center justify-between text-[11px] p-1.5 rounded cursor-pointer transition-colors ${
                  serviceFilter === 'Air Cargo' || serviceFilter === 'Sea Cargo'
                    ? 'bg-red-50 text-[#EA1D2C] font-bold border border-red-200 ring-1 ring-red-200'
                    : 'hover:bg-white text-slate-600'
                }`}
                title="Click to filter Freight Cargo orders"
              >
                <span>Freight Cargo Only</span>
                <span className="font-mono font-bold text-slate-900">{analytics.serviceCounts.freightCargo} orders</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONTROL & FILTER BAR (Clean 1-Line Desktop Alignment with Tooltip Icons) */}
      <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Search & Filter Selects in 1 horizontal row */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative w-full sm:w-56 md:w-64 lg:w-72 shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Customer, Mark, SF/ZTO, ID..."
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none bg-slate-50/50 hover:bg-white focus:bg-white transition-colors"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {/* Service Select */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA1D2C]"
            >
              <option value="all">All Services</option>
              <option value="Sourcing & Shipping">Sourcing &amp; Shipping</option>
              <option value="Sourcing Only">Sourcing Only</option>
              <option value="Air Cargo">Air Cargo</option>
              <option value="Sea Cargo">Sea Cargo</option>
              <option value="Door-to-Door">Door-to-Door</option>
            </select>

            {/* Payment Status Select */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA1D2C]"
            >
              <option value="all">All Payment</option>
              <option value="Due">Due</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </select>

            {/* Supplier Select */}
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA1D2C]"
            >
              <option value="all">All Suppliers</option>
              <option value="Taobao">Taobao</option>
              <option value="1688">1688</option>
              <option value="Alibaba">Alibaba</option>
              <option value="Factory">Factory Direct</option>
            </select>
          </div>

          {/* Right: Icon-Only Quick Action Buttons */}
          <div className="flex items-center gap-1.5 self-end lg:self-auto shrink-0">
            {/* Print Combined Commercial Invoice Button */}
            <button
              type="button"
              disabled={selectedOrderIds.length === 0}
              onClick={() => setShowCombinedInvoiceModal(true)}
              className={`h-9 px-3 rounded-lg border flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer shadow-2xs ${
                selectedOrderIds.length > 0
                  ? 'bg-[#EA1D2C] hover:bg-[#D41523] text-white border-transparent'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
              }`}
              title={selectedOrderIds.length > 0 ? "Print combined commercial invoice for selected orders" : "Select one or more orders to print combined invoice"}
            >
              <svg className="w-4 h-4 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print Invoice {selectedOrderIds.length > 0 ? `(${selectedOrderIds.length})` : ''}</span>
            </button>

            {/* Import CSV Button (Icon Only) */}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
              title="Import CSV from Google Sheets"
              aria-label="Import CSV"
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>

            {/* Export CSV Button (Icon Only) */}
            <a
              href="/api/admin/pos-ledger/export"
              download
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-emerald-600 hover:text-emerald-700 flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
              title="Export Orders to Excel/CSV"
              aria-label="Export CSV"
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </a>

            {/* Sync to Sheet Button (Icon Only) */}
            <button
              type="button"
              disabled={isSyncingSheet}
              onClick={handleSyncGoogleSheet}
              className={`w-9 h-9 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center cursor-pointer shadow-2xs transition-colors ${
                isSyncingSheet ? 'opacity-70 cursor-wait' : ''
              }`}
              title="Sync All Orders to Google Sheet"
              aria-label="Sync to Sheet"
            >
              <svg
                className={`w-4 h-4 stroke-[2.2] ${isSyncingSheet ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>

            {/* Setup Headers Button (Icon Only) */}
            <button
              type="button"
              onClick={() => setShowSheetSetupModal(true)}
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
              title="Setup Google Sheet 29 Headers &amp; Webhook"
              aria-label="Setup Headers"
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {/* Retry Failed Syncs Button (if any) */}
            {failedSyncsCount > 0 && (
              <button
                type="button"
                disabled={isRetryingFailed}
                onClick={handleRetryFailedSyncs}
                className="h-9 px-2.5 rounded-lg bg-rose-50 border border-rose-300 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-none"
                title="Retry failed Google Sheet syncs"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                <span>{failedSyncsCount} Failed</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. ORDERS WORKSPACE: DESKTOP HORIZONTALLY SCROLLABLE TABLE & MOBILE CARD VIEW */}
      
      {/* 4A. Desktop & Tablet View (Smooth Horizontal Scroll, Never Squeezed) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1260px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[10px] uppercase font-mono tracking-wider font-bold">
                {/* Column 0: Checkbox (Select All) */}
                <th className="py-3 px-3 sticky left-0 bg-slate-100 z-20 border-r border-slate-200 w-11 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#EA1D2C] focus:ring-[#EA1D2C] cursor-pointer align-middle"
                    title="Select all orders"
                    aria-label="Select all orders"
                  />
                </th>
                <th className="py-3 px-4 sticky left-11 bg-slate-100 z-10 border-r border-slate-200 min-w-[150px]">
                  Order &amp; Date
                </th>
                <th className="py-3 px-4 border-r border-slate-200 min-w-[210px]">
                  Customer &amp; Mark
                </th>
                <th className="py-3 px-4 border-r border-slate-200 min-w-[240px]">
                  Product &amp; Sourcing
                </th>
                <th className="py-3 px-4 border-r border-slate-200 min-w-[160px]">
                  Status &amp; Delivery
                </th>
                <th className="py-3 px-4 border-r border-slate-200 text-right min-w-[180px]">
                  Purchase &amp; Freight
                </th>
                <th className="py-3 px-4 border-r border-slate-200 text-right min-w-[190px]">
                  Total Bill &amp; Due
                </th>
                <th className="py-3 px-4 border-r border-slate-200 text-center min-w-[100px]">
                  Sheet Sync
                </th>
                <th className="py-3 px-4 text-right sticky right-0 bg-slate-100 z-10 min-w-[175px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-xs text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin text-[#EA1D2C]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Loading operations ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-xs text-slate-500">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700">No orders found matching the active filter.</p>
                      {(stageFilter !== 'all' || financialFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setStageFilter('all');
                            setFinancialFilter('all');
                          }}
                          className="text-xs font-bold text-[#EA1D2C] hover:underline cursor-pointer"
                        >
                          Clear Filters &amp; Show All Orders
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRecords.map((r, idx) => (
                  <tr key={r.id || idx} className={`hover:bg-slate-50/90 transition-colors ${selectedOrderIds.includes(r.id) ? 'bg-red-50/35' : ''}`}>
                    {/* Column 0: Row Selection Checkbox */}
                    <td className={`py-3 px-3 sticky left-0 z-20 border-r border-slate-200 text-center w-11 transition-colors ${
                      selectedOrderIds.includes(r.id) ? 'bg-red-50/80' : 'bg-white hover:bg-slate-50'
                    }`}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(r.id)}
                        onChange={() => handleToggleSelectOrder(r.id)}
                        className="w-4 h-4 rounded border-slate-300 text-[#EA1D2C] focus:ring-[#EA1D2C] cursor-pointer align-middle"
                        aria-label={`Select order ${r.orderId}`}
                      />
                    </td>

                    {/* Column 1: Order ID & Date (Sticky Left-11) */}
                    <td className={`py-3 px-4 sticky left-11 z-10 border-r border-slate-200 font-mono font-bold text-slate-900 shadow-[1px_0_3px_rgba(0,0,0,0.03)] transition-colors ${
                      selectedOrderIds.includes(r.id) ? 'bg-red-50/80' : 'bg-white hover:bg-slate-50'
                    }`}>
                      <button
                        type="button"
                        onClick={() => openEditDrawer(r)}
                        className="text-xs font-mono font-bold text-slate-900 hover:text-[#EA1D2C] hover:underline cursor-pointer text-left block"
                        title="Click to edit order"
                      >
                        {r.orderId}
                      </button>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">{r.orderDate}</div>
                      <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {r.serviceType}
                      </span>
                    </td>

                    {/* Column 2: Customer & Shipping Mark */}
                    <td className="py-3 px-4 border-r border-slate-200">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span>{r.customerName}</span>
                        {r.importerClient && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono text-slate-600 font-medium">
                            {r.importerClient}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {r.mobileNo}
                      </div>
                      {r.shippingMark && (
                        <div className="mt-1">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-50 text-[#EA1D2C] border border-red-200">
                            Mark: {r.shippingMark}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Column 3: Product & Sourcing */}
                    <td className="py-3 px-4 border-r border-slate-200 max-w-[280px]">
                      <div className="font-medium text-slate-900 text-xs line-clamp-2" title={r.itemDetails}>
                        {r.itemDetails}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-[10px]">
                          {r.supplierName}
                        </span>
                        <span className="font-mono">· {r.quantity} pcs</span>
                        {r.chinaCourierTracking && (
                          <span className="font-mono text-[10px] text-slate-400 truncate max-w-[130px]" title={r.chinaCourierTracking}>
                            SF: {r.chinaCourierTracking}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 4: Status & Delivery */}
                    <td className="py-3 px-4 border-r border-slate-200">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                        {r.currentStatus}
                      </span>
                      {r.bdCourierName && (
                        <div className="text-[11px] font-semibold text-slate-800 mt-1">
                          {r.bdCourierName}
                        </div>
                      )}
                      {r.bdTrackingNo && (
                        <div className="font-mono text-[10px] text-blue-600 font-semibold truncate max-w-[140px]" title={r.bdTrackingNo}>
                          {r.bdTrackingNo}
                        </div>
                      )}
                    </td>

                    {/* Column 5: Purchase & Freight Breakdown */}
                    <td className="py-3 px-4 border-r border-slate-200 text-right font-mono">
                      <div>
                        <span className="font-bold text-amber-700 text-xs">¥{Number(r.totalPurchaseRmb).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 block font-sans">
                          ৳{Number(r.purchaseCostBdt).toLocaleString()} @{Number(r.rmbRateBdt).toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 pt-1 border-t border-slate-100">
                        <span className="font-bold text-sky-700 text-xs">৳{Number(r.internationalFreightBdt).toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 block font-sans">
                          {Number(r.bdWeightKg) > 0 ? `${r.bdWeightKg} KG (BD)` : Number(r.cnWeightKg) > 0 ? `${r.cnWeightKg} KG (CN)` : 'Pending BD'} @ ৳{r.shippingRatePerKgBdt}
                        </span>
                      </div>
                    </td>

                    {/* Column 6: Total Bill & Settlement */}
                    <td className="py-3 px-4 border-r border-slate-200 text-right font-mono">
                      <div className="font-extrabold text-slate-900 text-sm">
                        ৳{Number(r.totalBillBdt).toLocaleString()}
                      </div>
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => handleQuickPaymentToggle(r)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-none ${
                            r.paymentStatus === 'Paid'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : r.paymentStatus === 'Partial'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                              : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                          }`}
                          title="Click to toggle Paid/Due status"
                        >
                          {r.paymentStatus}
                        </button>
                        <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                          Due: ৳{Number(r.purchaseCostDueBdt).toLocaleString()}
                        </div>
                      </div>
                    </td>

                    {/* Column 7: Sheet Sync Status */}
                    <td className="py-3 px-4 border-r border-slate-200 text-center">
                      <div className="relative group inline-block">
                        <button
                          type="button"
                          disabled={syncingOrderId === r.id}
                          onClick={() => handleSyncSingleOrder(r.id, r.orderId)}
                          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EA1D2C] rounded-full cursor-pointer transition-none inline-flex items-center justify-center p-0.5"
                          title="Click to Sync to Google Sheet"
                        >
                          {syncingOrderId === r.id || r.sheetSyncStatus === 'pending' ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 text-sky-700 border border-sky-300 shadow-2xs">
                              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                            </span>
                          ) : r.sheetSyncStatus === 'failed' ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500 text-white shadow-2xs hover:bg-rose-600">
                              <svg className="w-3.5 h-3.5 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shadow-2xs hover:bg-emerald-600">
                              <svg className="w-3.5 h-3.5 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          )}
                        </button>

                        {/* Interactive Hover Tooltip */}
                        <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 w-52 p-2.5 rounded-lg bg-slate-900 text-white shadow-xl text-left border border-slate-700">
                          {syncingOrderId === r.id || r.sheetSyncStatus === 'pending' ? (
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-sky-400 text-xs">
                                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                                <span>Syncing...</span>
                              </div>
                              <p className="text-[11px] text-slate-300 mt-1">Updating Google Sheet record.</p>
                            </div>
                          ) : r.sheetSyncStatus === 'failed' ? (
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-rose-400 text-xs">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span>Sync Failed</span>
                              </div>
                              <p className="text-[10px] text-amber-300 font-semibold mt-1">Click to retry sync now</p>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>Sheet Synced</span>
                              </div>
                              <p className="text-[10px] text-slate-300 mt-0.5">29 columns recorded successfully.</p>
                            </div>
                          )}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900" />
                        </div>
                      </div>
                    </td>

                    {/* Column 8: Actions (Sticky Right) */}
                    <td className="py-3 px-4 text-right sticky right-0 bg-white hover:bg-slate-50 z-10 whitespace-nowrap shadow-[-1px_0_3px_rgba(0,0,0,0.03)]">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Download PDF Receipt */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(r)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-700 hover:text-[#EA1D2C] cursor-pointer shadow-2xs transition-colors"
                          title="Download PDF Receipt"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>

                        {/* Thermal Receipt Slip Preview */}
                        <button
                          type="button"
                          onClick={() => setThermalReceiptRecord(r)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer shadow-2xs transition-colors"
                          title="Preview Thermal Receipt Slip"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </button>

                        {/* Copy Public Tracking Link */}
                        <button
                          type="button"
                          onClick={() => handleCopyTrackingLink(r)}
                          className={`p-1.5 rounded-lg border cursor-pointer shadow-2xs transition-colors ${
                            copiedOrderId === r.id
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-slate-700 hover:text-blue-600'
                          }`}
                          title={copiedOrderId === r.id ? 'Tracking Link Copied!' : 'Copy Public Tracking Link'}
                        >
                          {copiedOrderId === r.id ? (
                            <svg className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          )}
                        </button>

                        {/* Partial Payment Button */}
                        <button
                          type="button"
                          onClick={() => openPartialPaymentModal(r)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer transition-none shadow-2xs flex items-center gap-1"
                          title="Record Partial Payment / Installment"
                        >
                          <span className="font-extrabold text-[12px] leading-none">+</span>
                          <span>Pay</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => openEditDrawer(r)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-semibold cursor-pointer transition-none shadow-2xs"
                        >
                          Edit
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id, r.orderId)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          title="Delete Order"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4B. Mobile Cards View (100% Mobile Friendly for Smartphones) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
            <svg className="w-5 h-5 animate-spin text-[#EA1D2C] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading orders list...
          </div>
        ) : displayedRecords.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">No orders found matching criteria.</p>
            {(stageFilter !== 'all' || financialFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setStageFilter('all');
                  setFinancialFilter('all');
                }}
                className="text-xs font-bold text-[#EA1D2C] hover:underline cursor-pointer block mx-auto"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          displayedRecords.map((r, idx) => (
            <div key={r.id || idx} className={`bg-white rounded-xl border p-4 shadow-2xs space-y-3 transition-colors ${
              selectedOrderIds.includes(r.id) ? 'border-red-300 bg-red-50/25 ring-1 ring-red-200' : 'border-slate-200/90'
            }`}>
              {/* Card Header: Checkbox + Order ID + Status */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(r.id)}
                    onChange={() => handleToggleSelectOrder(r.id)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#EA1D2C] focus:ring-[#EA1D2C] cursor-pointer"
                    aria-label={`Select order ${r.orderId}`}
                  />
                  <div>
                    <div className="font-mono font-bold text-slate-900 text-xs">{r.orderId}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{r.orderDate} · {r.serviceType}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {r.currentStatus}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSyncSingleOrder(r.id, r.orderId)}
                    className="p-1 text-xs"
                    title="Google Sheet Sync Status"
                  >
                    <span className={`w-2 h-2 rounded-full inline-block ${r.sheetSyncStatus === 'failed' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  </button>
                </div>
              </div>

              {/* Customer & Mark */}
              <div className="text-xs space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>{r.customerName}</span>
                  {r.shippingMark && (
                    <span className="px-1.5 py-0.5 rounded bg-red-50 text-[#EA1D2C] border border-red-200 text-[10px] font-mono font-bold">
                      Mark: {r.shippingMark}
                    </span>
                  )}
                </div>
                <div className="text-slate-500 font-mono text-[11px]">{r.mobileNo}</div>
              </div>

              {/* Product Info */}
              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/70 text-xs space-y-1">
                <div className="font-medium text-slate-900 line-clamp-2">{r.itemDetails}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span className="font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[10px]">
                    {r.supplierName}
                  </span>
                  <span className="font-mono">{r.quantity} pcs</span>
                  {r.chinaCourierTracking && (
                    <span className="font-mono text-[10px] text-slate-400">SF: {r.chinaCourierTracking}</span>
                  )}
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50/50 p-2.5 rounded-lg border border-slate-200/60">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Total Bill</span>
                  <span className="font-extrabold text-slate-900 text-sm">৳{Number(r.totalBillBdt).toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-sans">Payment</span>
                  <span className={`font-bold text-[11px] ${r.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {r.paymentStatus}
                  </span>
                  {r.purchaseCostDueBdt > 0 && (
                    <span className="block text-[10px] text-rose-600 font-bold">Due: ৳{Number(r.purchaseCostDueBdt).toLocaleString()}</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500">
                  Purchase: ¥{Number(r.totalPurchaseRmb).toFixed(2)} (৳{Number(r.purchaseCostBdt).toLocaleString()})
                </div>
                <div className="text-[10px] text-slate-500 text-right">
                  Freight: ৳{Number(r.internationalFreightBdt).toLocaleString()} ({r.bdWeightKg || r.cnWeightKg} KG)
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(r)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs shadow-2xs"
                    title="PDF Receipt"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setThermalReceiptRecord(r)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs shadow-2xs"
                    title="Thermal Slip"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyTrackingLink(r)}
                    className={`p-1.5 rounded-lg border text-xs shadow-2xs transition-colors ${
                      copiedOrderId === r.id
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-slate-700 hover:text-blue-600'
                    }`}
                    title={copiedOrderId === r.id ? 'Tracking Link Copied!' : 'Copy Tracking Link'}
                  >
                    {copiedOrderId === r.id ? (
                      <svg className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={syncingOrderId === r.id}
                    onClick={() => handleSyncSingleOrder(r.id, r.orderId)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 text-emerald-700 text-xs shadow-2xs"
                    title="Sync to Sheet"
                  >
                    <svg className={`w-3.5 h-3.5 ${syncingOrderId === r.id ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openPartialPaymentModal(r)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-2xs"
                  >
                    + Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditDrawer(r)}
                    className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-2xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id, r.orderId)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Batch Invoicing & Print Dock */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200 w-[92%] max-w-xl justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="truncate">
              <span className="text-xs font-bold text-white block sm:inline">
                {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'order' : 'orders'} selected
              </span>
              <span className="hidden sm:inline text-slate-400 text-xs mx-1.5">·</span>
              <span className="text-xs font-mono text-emerald-400 font-extrabold block sm:inline">
                ৳{selectedTotals.totalBillBdt.toLocaleString()}
              </span>
              {selectedTotals.totalDueBdt > 0 && (
                <span className="text-[11px] font-mono text-rose-400 font-bold ml-1.5 hidden sm:inline">
                  (Due: ৳{selectedTotals.totalDueBdt.toLocaleString()})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCombinedInvoiceModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print Invoice</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium cursor-pointer transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 4. POS FAST-ENTRY MODAL / DRAWER */}
      {showPosDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[94vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-['Manrope'] flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-red-50 text-[#EA1D2C] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </span>
                  <span>{editingRecord ? `Edit Order: ${editingRecord.orderId}` : 'POS Rapid Order Terminal'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-velocity entry with real-time RMB currency conversion, freight calculations, and instant ledger sync.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPosDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-5 pt-4 text-xs">
              {/* Section 1: Customer & Logistics Identification */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                    01 · Customer &amp; Order Identification
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Google Sheet Sync Cols A–K
                  </span>
                </div>

                {/* Row 1: Customer Name, Phone, Importer Client */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">Customer Full Name (Col E) *</label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                      placeholder="e.g. Sourov Ahmed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Mobile / WhatsApp (Col G)</label>
                    <input
                      type="text"
                      value={formData.mobileNo}
                      onChange={(e) => setFormData({ ...formData, mobileNo: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                      placeholder="+880 1711..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Importer / Client (Col H)</label>
                    <input
                      type="text"
                      value={formData.importerClient}
                      onChange={(e) => setFormData({ ...formData, importerClient: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono uppercase"
                      placeholder="e.g. HTI"
                    />
                  </div>
                </div>

                {/* Row 2: Order ID, Order Date, CN Date, BD Date */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>Order ID (Col A)</span>
                      {!editingRecord && <span className="text-[10px] text-slate-400 font-normal">Auto if blank</span>}
                    </label>
                    <input
                      type="text"
                      value={formData.orderId}
                      onChange={(e) => setFormData({ ...formData, orderId: e.target.value.toUpperCase() })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono font-bold uppercase"
                      placeholder={editingRecord ? 'e.g. GOS-00025' : 'Auto: e.g. GOS-00025'}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Order Date (Col B)</label>
                    <input
                      type="date"
                      value={formData.orderDate}
                      onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">CN Date (Col C)</label>
                    <input
                      type="date"
                      value={formData.cnDate}
                      onChange={(e) => setFormData({ ...formData, cnDate: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">BD Date (Col U)</label>
                    <input
                      type="date"
                      value={formData.bdDate}
                      onChange={(e) => setFormData({ ...formData, bdDate: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                {/* Row 3: Shipping Mark, Website Order Ref, China Domestic Tracking */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Shipping Mark (Col I)</label>
                    <input
                      type="text"
                      value={formData.shippingMark}
                      onChange={(e) => setFormData({ ...formData, shippingMark: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="HTI-DAC-01"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Website Order Ref (Col J)</label>
                    <input
                      type="text"
                      value={formData.websiteOrderNo}
                      onChange={(e) => setFormData({ ...formData, websiteOrderNo: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="WEB-1092"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">China Courier Tracking (Col D)</label>
                    <input
                      type="text"
                      value={formData.chinaCourierTracking}
                      onChange={(e) => setFormData({ ...formData, chinaCourierTracking: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="SF14092847192"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Product & Supplier Sourcing */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                  02 · Product Details &amp; Sourcing Platform
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">Product / Item Details (Col K) *</label>
                    <input
                      type="text"
                      required
                      value={formData.itemDetails}
                      onChange={(e) => setFormData({ ...formData, itemDetails: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                      placeholder="e.g. Women Silk Scarf Accessories"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Supplier / Platform (Col L)</label>
                    <select
                      value={formData.supplierName}
                      onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="Taobao">Taobao</option>
                      <option value="1688">1688 (Alibaba CN)</option>
                      <option value="Alibaba">Alibaba International</option>
                      <option value="Pinduoduo">Pinduoduo</option>
                      <option value="Factory Direct">Factory Direct</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Service Mode (Col T)</label>
                    <select
                      value={formData.serviceType}
                      onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="Sourcing & Shipping">Sourcing &amp; Shipping</option>
                      <option value="Sourcing Only">Sourcing Only</option>
                      <option value="Air Cargo">Air Cargo (7-14d)</option>
                      <option value="Sea Cargo">Sea Cargo (35-45d)</option>
                      <option value="Door-to-Door">Door-to-Door Delivery</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Current Status (Col F)</label>
                  <select
                    value={formData.currentStatus}
                    onChange={(e) => setFormData({ ...formData, currentStatus: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold"
                  >
                    <option value="PURCHASED CHINA WAREHOUSE">1. PURCHASED CHINA WAREHOUSE</option>
                    <option value="PURCHASED">1. PURCHASED</option>
                    <option value="CN WAREHOUSE RECEIVED">2. CN WAREHOUSE RECEIVED</option>
                    <option value="DISPATCHED FROM CHINA">3. DISPATCHED FROM CHINA</option>
                    <option value="ARRIVED DHAKA AIRPORT">4. ARRIVED DHAKA AIRPORT</option>
                    <option value="AWAITING CUSTOMS CLEARANCE">5. AWAITING CUSTOMS CLEARANCE</option>
                    <option value="BD WAREHOUSE RECEIVED">6. BD WAREHOUSE RECEIVED</option>
                    <option value="OUT FOR DELIVERY">7. OUT FOR DELIVERY</option>
                    <option value="DELIVERED">8. DELIVERED</option>
                    {!['PURCHASED','PURCHASED CHINA WAREHOUSE','CN WAREHOUSE RECEIVED','DISPATCHED FROM CHINA','ARRIVED DHAKA AIRPORT','AWAITING CUSTOMS CLEARANCE','BD WAREHOUSE RECEIVED','OUT FOR DELIVERY','DELIVERED'].includes(formData.currentStatus.toUpperCase()) && (
                      <option value={formData.currentStatus}>{formData.currentStatus}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Section 3: Live Real-time POS Calculator (RMB + BDT + Freight) */}
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-900 block">
                    03 · Live POS Costing &amp; Freight Engine
                  </span>
                  <span className="text-[11px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                    Auto-Computed Realtime
                  </span>
                </div>

                {/* RMB Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Quantity (Pcs) *</label>
                    <input
                      type="number"
                      step="1"
                      min={1}
                      required
                      value={formData.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      onBlur={() => {
                        if (!formData.quantity || Number(formData.quantity) < 1) {
                          setFormData({ ...formData, quantity: 1 });
                        }
                      }}
                      placeholder="1"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono font-bold text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Unit Price (RMB ¥) *</label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      required
                      value={formData.unitPriceRmb}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormData({ ...formData, unitPriceRmb: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono font-bold text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Total Purchase (RMB)</label>
                    <div className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs font-mono font-extrabold text-amber-700 flex items-center justify-center">
                      ¥{computedForm.totalRmb.toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">RMB Rate (BDT) *</label>
                    <input
                      type="number"
                      step="any"
                      min={0.01}
                      required
                      value={formData.rmbRateBdt}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormData({ ...formData, rmbRateBdt: e.target.value })}
                      onBlur={() => {
                        if (!formData.rmbRateBdt || Number(formData.rmbRateBdt) <= 0) {
                          setFormData({ ...formData, rmbRateBdt: '19.5' });
                        }
                      }}
                      placeholder="19.50"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono font-bold text-center"
                    />
                  </div>
                </div>

                {/* Freight & Weight Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">CN Weight (KG) <span className="font-normal text-slate-400">(Opt)</span></label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={formData.cnWeightKg}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormData({ ...formData, cnWeightKg: e.target.value })}
                      placeholder="Leave blank"
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 text-emerald-800">BD Weight (KG) <span className="font-normal text-emerald-600">(Enter on BD arrival)</span></label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={formData.bdWeightKg}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormData({ ...formData, bdWeightKg: e.target.value })}
                      placeholder="e.g. 12.5"
                      className="w-full h-8 px-2.5 rounded border border-emerald-300 bg-emerald-50/30 text-xs font-mono text-center font-bold focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Shipping Rate / KG (৳)</label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={formData.shippingRatePerKgBdt}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormData({ ...formData, shippingRatePerKgBdt: e.target.value })}
                      placeholder="850"
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Int'l Freight (BDT)</label>
                    <div className="w-full h-8 px-2.5 rounded bg-white border border-slate-300 text-xs font-mono font-extrabold text-sky-700 flex items-center justify-center">
                      ৳{computedForm.intlFreightBdt.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Final Totals Breakdown Banner */}
                <div className="p-3.5 rounded-lg bg-white border border-amber-300/80 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Purchase Cost BDT</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">৳{computedForm.purchaseCostBdt.toLocaleString()}</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-500 block uppercase font-mono">Customer Paid ৳</label>
                      {editingRecord && (
                        <button
                          type="button"
                          onClick={() => openPartialPaymentModal(editingRecord)}
                          className="text-[9px] font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          + Add Pay
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={formData.purchaseCostPaidBdt}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormData({ ...formData, purchaseCostPaidBdt: e.target.value })}
                      placeholder="0"
                      className="w-full h-7 px-2 rounded border border-slate-300 text-xs font-mono font-bold text-emerald-700"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Outstanding Due</span>
                    <span className="text-sm font-extrabold text-red-600 font-mono">৳{computedForm.purchaseDueBdt.toLocaleString()}</span>
                  </div>

                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Grand Total Bill</span>
                    <span className="text-base font-black text-slate-900 font-mono">৳{computedForm.totalBillBdt.toLocaleString()}</span>
                  </div>
                </div>

                {/* Installment Payment History Log */}
                {editingRecord && Array.isArray(editingRecord.payments) && editingRecord.payments.length > 0 && (
                  <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-emerald-900 border-b border-emerald-200 pb-1">
                      <span>INSTALLMENT PAYMENT LEDGER ({editingRecord.payments.length} ENTRIES)</span>
                      <button
                        type="button"
                        onClick={() => openPartialPaymentModal(editingRecord)}
                        className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] hover:bg-emerald-700 cursor-pointer"
                      >
                        + Add Partial Payment
                      </button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {editingRecord.payments.map((p, pIdx) => (
                        <div key={p.id || pIdx} className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1 rounded border border-emerald-100">
                          <div>
                            <span className="font-bold text-slate-800">{p.milestone || 'Installment'}</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">{p.dateTime}</span>
                            {p.trxId && <span className="text-[10px] text-slate-500 font-mono ml-1.5">({p.method}: {p.trxId})</span>}
                          </div>
                          <span className="font-mono font-bold text-emerald-700">৳{Number(p.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: BD Local Delivery Dispatch */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                  04 · Bangladesh Local Delivery &amp; Dispatch
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Courier Partner</label>
                    <select
                      value={formData.bdCourierName}
                      onChange={(e) => setFormData({ ...formData, bdCourierName: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    >
                      <option value="Steadfast">Steadfast Courier</option>
                      <option value="Pathao">Pathao Courier</option>
                      <option value="RedX">RedX Logistics</option>
                      <option value="Paperfly">Paperfly</option>
                      <option value="Hub Pickup">Dhaka Central Hub Pickup</option>
                      <option value="SA Paribahan">SA Paribahan</option>
                      <option value="Sundarban">Sundarban Courier</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">BD Courier Tracking No</label>
                    <input
                      type="text"
                      value={formData.bdTrackingNo}
                      onChange={(e) => setFormData({ ...formData, bdTrackingNo: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="e.g. STDF-8839201"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Remarks / Customer Update</label>
                    <input
                      type="text"
                      value={formData.remark}
                      onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                      placeholder="Customer requested extra packing"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPosDrawer(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRecord}
                  className="px-6 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {savingRecord ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>{editingRecord ? 'Updating & Syncing to Sheet...' : 'Saving & Syncing to Sheet...'}</span>
                    </>
                  ) : (
                    <span>{editingRecord ? 'Update Order & Sync to Sheet →' : 'Save to POS Ledger →'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. THERMAL POS RECEIPT PRINT MODAL */}
      {thermalReceiptRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            {/* Thermal Slip Content (80mm width standard) */}
            <div className="text-slate-900 font-mono text-xs border border-dashed border-slate-300 p-4 rounded-lg bg-slate-50 space-y-3">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
                <div className="text-base font-black tracking-tight font-['Manrope'] text-[#EA1D2C]">
                  GoShipping Express
                </div>
                <div className="text-[10px] text-slate-500 font-sans">
                  China to Bangladesh Freight &amp; Sourcing Desk
                </div>
                <div className="text-[10px] text-slate-600 font-mono font-bold mt-1">
                  POS ORDER: {thermalReceiptRecord.orderId}
                </div>
                <div className="text-[9px] text-slate-400">
                  {thermalReceiptRecord.orderDate} · Dhaka Central Terminal
                </div>
              </div>

              {/* Customer Info */}
              <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                <div><span className="text-slate-400">Customer:</span> <span className="font-bold">{thermalReceiptRecord.customerName}</span></div>
                {thermalReceiptRecord.mobileNo && <div><span className="text-slate-400">Phone:</span> {thermalReceiptRecord.mobileNo}</div>}
                {thermalReceiptRecord.shippingMark && <div><span className="text-slate-400">Mark:</span> <span className="font-bold text-[#EA1D2C]">{thermalReceiptRecord.shippingMark}</span></div>}
              </div>

              {/* Sourcing & Product Breakdown */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="font-bold truncate">{thermalReceiptRecord.itemDetails}</div>
                <div className="flex justify-between text-slate-600">
                  <span>{thermalReceiptRecord.quantity} pcs @ ¥{Number(thermalReceiptRecord.unitPriceRmb).toFixed(2)}</span>
                  <span className="font-bold">¥{Number(thermalReceiptRecord.totalPurchaseRmb).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>RMB Rate (BDT)</span>
                  <span>@{Number(thermalReceiptRecord.rmbRateBdt).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Purchase BDT:</span>
                  <span>৳{Number(thermalReceiptRecord.purchaseCostBdt).toLocaleString()}</span>
                </div>
              </div>

              {/* Freight Charges */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between text-slate-600">
                  <span>Weight ({thermalReceiptRecord.bdWeightKg || thermalReceiptRecord.cnWeightKg} KG @ ৳{thermalReceiptRecord.shippingRatePerKgBdt})</span>
                  <span>{thermalReceiptRecord.serviceType}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Int'l Freight BDT:</span>
                  <span>৳{Number(thermalReceiptRecord.internationalFreightBdt).toLocaleString()}</span>
                </div>
              </div>

              {/* Financial Settlement */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between text-xs font-black">
                  <span>TOTAL BILL:</span>
                  <span>৳{Number(thermalReceiptRecord.totalBillBdt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>PAID AMOUNT:</span>
                  <span>৳{Number(thermalReceiptRecord.purchaseCostPaidBdt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red-600 font-extrabold">
                  <span>DUE BALANCE:</span>
                  <span>৳{Number(thermalReceiptRecord.purchaseCostDueBdt).toLocaleString()}</span>
                </div>
              </div>

              {/* Footer barcode & contact */}
              <div className="text-center text-[9px] text-slate-500 pt-1 space-y-1">
                {thermalReceiptRecord.bdTrackingNo && (
                  <div className="font-mono text-slate-700 font-bold">
                    Courier Tracking: {thermalReceiptRecord.bdCourierName} {thermalReceiptRecord.bdTrackingNo}
                  </div>
                )}
                <div>Support Hotline: +880 1797-252627</div>
                <div className="font-mono tracking-widest text-[10px] text-slate-400">
                  * * * THANK YOU FOR SHIPPING * * *
                </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setThermalReceiptRecord(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPdf(thermalReceiptRecord)}
                className="px-4 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download PDF Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. IMPORT CSV MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 font-['Manrope']">
                Import Orders from Google Sheets CSV
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Copy and paste the raw CSV rows or content from your <strong>GoShipping Google Sheet</strong>. All 29 columns will be parsed and auto-calculated into the POS ledger.
              </p>

              <textarea
                rows={8}
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder="Paste CSV rows here (including header)..."
                className="w-full p-3 rounded-lg border border-slate-300 font-mono text-[11px] focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleImportCsv}
                  className="px-5 py-2 rounded-lg bg-[#EA1D2C] text-white font-bold hover:bg-[#D41523] disabled:opacity-50 cursor-pointer"
                >
                  {isImporting ? 'Importing...' : 'Start Import →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 7. GOOGLE SHEET SETUP & HEADERS MODAL */}
      {showSheetSetupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-['Manrope']">
                    Official Google Sheet Ledger Setup (29 Columns: A to AC)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Format Row 1 with 29 official titles matching our POS Ledger, freeze headers, and sync orders automatically in real-time.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSheetSetupModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              {/* Connected Target Google Sheet Details */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-bold text-emerald-900 text-xs">Target Spreadsheet (Go Shipping Order List)</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-200/80 text-[10px] font-mono text-emerald-800 font-bold">Tab: Sheet1</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-200/80 text-[10px] font-mono text-emerald-800 font-bold">29 Columns (A-AC)</span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-800 truncate max-w-lg">
                    https://docs.google.com/spreadsheets/d/1K7JQIwYXmKjy6CsLufuV-2Adljqg2qhJSwUQOboJUwQ/edit?gid=0#gid=0
                  </div>
                </div>
                <a
                  href="https://docs.google.com/spreadsheets/d/1K7JQIwYXmKjy6CsLufuV-2Adljqg2qhJSwUQOboJUwQ/edit?gid=0#gid=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shrink-0 shadow-2xs"
                >
                  <span>Open Sheet</span>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>

              {/* Webhook Configuration Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">Google Apps Script Webhook URL</h4>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${sheetStatus?.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sheetStatus?.configured ? '● Connected' : '○ Not Configured'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 p-2 rounded-lg border border-slate-300 font-mono text-[11px] focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none bg-white"
                  />
                  <button
                    type="button"
                    disabled={isSavingWebhook}
                    onClick={handleSaveWebhookUrl}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shrink-0 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    {isSavingWebhook ? 'Saving...' : 'Save Webhook URL'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Deploy the Apps Script below in your Google Sheet, then paste the web app URL (ending with <code>/exec</code>) here.
                </p>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Method 1: Instant Copy Headers */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                      Fastest: 10 Seconds
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">Copy 29 Column Titles</h4>
                    <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                      1. In Google Sheets, right-click row 1 &gt; <strong>Insert 1 row above</strong>.<br />
                      2. Click cell <strong>A1</strong> and press <strong>Ctrl+V / Cmd+V</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyHeadersToClipboard}
                    className="mt-3 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>{copiedHeaders ? 'Copied to Clipboard!' : 'Copy 29 Header Titles'}</span>
                  </button>
                </div>

                {/* Method 2: Webhook Trigger */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                      Automated Sync
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">Trigger Header Setup via Webhook</h4>
                    <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                      Sends an automated instruction to your connected Apps Script to format Row 1, freeze headers, and set dark styling.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSettingUpHeaders}
                    onClick={handleSetupSheetHeaders}
                    className="mt-3 w-full py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <svg className={`w-3.5 h-3.5 ${isSettingUpHeaders ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span>{isSettingUpHeaders ? 'Initializing...' : 'Initialize Headers Now'}</span>
                  </button>
                </div>
              </div>

              {/* Complete Google Apps Script */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-['Manrope']">
                      Official 29-Column Google Apps Script
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Matches the <strong>Sheet1</strong> tab with 29 columns (A to AC), auto-updates existing orders, and fills template rows.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyScriptToClipboard}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>{copiedScript ? 'Script Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-950 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto max-h-40 border border-slate-800">
                  <pre className="text-emerald-400">// In Google Sheets: Extensions &gt; Apps Script &gt; Paste code &gt; Deploy as Web App</pre>
                  <pre className="text-slate-300">function setupSheet() &#123; ... sets 29 headers, #11181E styling, freezes row 1 &#125;</pre>
                  <pre className="text-slate-400">function doPost(e) &#123; ... writes 29 columns into Sheet1 tab &#125;</pre>
                </div>
              </div>

              {/* 29 Columns Reference Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200 font-bold text-slate-800 text-[11px]">
                  All 29 Columns Reference (1:1 with Official Google Sheet A-AC)
                </div>
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 text-[10px] max-h-56 overflow-y-auto font-mono">
                  {[
                    "A: Order ID", "B: Order Date", "C: CN Date", "D: China Courier Tracking (SF/ZTO)",
                    "E: Customer Name", "F: Current Status", "G: Mobile No", "H: Importer / Client",
                    "I: Shipping Mark", "J: Website Order No", "K: Item / Product Details", "L: Supplier / Shop Name",
                    "M: Quantity (Pcs)", "N: Unit Price (RMB)", "O: Total Purchase RMB [Auto]", "P: RMB Rate (BDT)",
                    "Q: Purchase Cost BDT [Auto]", "R: Purchase Cost Paid", "S: Purchase Cost Due [Auto]", "T: Service Type",
                    "U: BD Date", "V: BD Weight (KG)", "W: Shipping Rate / KG", "X: Int'l Freight [Auto]",
                    "Y: Total Bill [Auto]", "Z: Payment Status [Auto]", "AA: BD Tracking No", "AB: Remark / Update"
                  ].map((col, idx) => (
                    <div key={idx} className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 truncate">
                      {col}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowSheetSetupModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 5B. ADD PARTIAL PAYMENT / INSTALLMENT ENTRY MODAL */}
      {showPaymentModal && paymentTargetRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-w-md w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header — Clean Light Design */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center font-bold text-base shadow-2xs">
                  ৳
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Manrope']">
                    Record Partial Payment
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                    <span>Order:</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-900 font-mono font-semibold text-[10px]">
                      {paymentTargetRecord.orderId}
                    </span>
                    <span>·</span>
                    <span className="font-medium text-slate-700 truncate max-w-[190px]">
                      {paymentTargetRecord.customerName}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentTargetRecord(null);
                }}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Financial Status Summary Strip */}
            <div className="p-4 pb-0 bg-white">
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 grid grid-cols-3 divide-x divide-slate-200/70 text-center">
                <div className="px-1">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Total Billed</span>
                  <span className="font-bold text-slate-900 font-mono text-xs block mt-0.5">
                    ৳{Number(paymentTargetRecord.totalBillBdt).toLocaleString()}
                  </span>
                </div>
                <div className="px-1">
                  <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider block">Already Paid</span>
                  <span className="font-bold text-emerald-600 font-mono text-xs block mt-0.5">
                    ৳{Number(paymentTargetRecord.purchaseCostPaidBdt).toLocaleString()}
                  </span>
                </div>
                <div className="px-1">
                  <span className="text-[10px] text-rose-600 font-semibold uppercase tracking-wider block">Balance Due</span>
                  <span className="font-bold text-rose-600 font-mono text-xs block mt-0.5">
                    ৳{Number(paymentTargetRecord.purchaseCostDueBdt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handleRecordPartialPayment} className="p-4 space-y-3.5 text-xs bg-white">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 text-xs">
                    Payment Amount (৳) <span className="text-rose-500">*</span>
                  </label>
                  {paymentTargetRecord.purchaseCostDueBdt > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmountInput(String(paymentTargetRecord.purchaseCostDueBdt))}
                      className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>Pay Full Due: ৳{Number(paymentTargetRecord.purchaseCostDueBdt).toLocaleString()}</span>
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-400 font-mono font-bold text-sm pointer-events-none select-none">
                    ৳
                  </span>
                  <input
                    type="number"
                    step="any"
                    min={1}
                    required
                    autoFocus
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full h-10 pl-8 pr-3 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 text-[11px]">
                    Payment Method <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentMethodInput}
                    onChange={(e) => setPaymentMethodInput(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-2xs cursor-pointer"
                  >
                    <option value="bKash">bKash Merchant</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Bank Transfer">Bank Transfer (SCB / City)</option>
                    <option value="Cash">Cash in Hand</option>
                    <option value="Rocket">Rocket</option>
                    <option value="Upay">Upay</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 text-[11px]">Milestone / Stage</label>
                  <select
                    value={paymentMilestoneInput}
                    onChange={(e) => setPaymentMilestoneInput(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-2xs cursor-pointer"
                  >
                    <option value="Order Confirmation Advance">Order Advance</option>
                    <option value="China Warehouse Arrival">China Warehouse Arrival</option>
                    <option value="Dispatched from China">Dispatched from China</option>
                    <option value="Arrived Bangladesh HSIA">Arrived Bangladesh HSIA</option>
                    <option value="Final Delivery Handover">Final Delivery Clearance</option>
                    <option value="General Installment">General Installment</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 text-[11px]">
                    TrxID / Reference <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentTrxIdInput}
                    onChange={(e) => setPaymentTrxIdInput(e.target.value)}
                    placeholder="e.g. BK-98302184"
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 text-[11px]">
                    Collector Note <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentNoteInput}
                    onChange={(e) => setPaymentNoteInput(e.target.value)}
                    placeholder="Collected by delivery agent"
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentTargetRecord(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 cursor-pointer text-xs font-semibold transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold cursor-pointer disabled:opacity-50 text-xs shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                >
                  {isSubmittingPayment ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Recording Payment...</span>
                    </>
                  ) : (
                    <span>Record Payment →</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. COMBINED COMMERCIAL INVOICE PRINT MODAL */}
      <CombinedCommercialInvoiceModal
        isOpen={showCombinedInvoiceModal}
        onClose={() => setShowCombinedInvoiceModal(false)}
        selectedRecords={selectedRecords}
        onPaymentRecorded={loadLedger}
        onInvoiceSaved={(invoice) => {
          // Update local orders with the invoice number
          setRecords((prev) =>
            prev.map((r) =>
              selectedOrderIds.includes(r.id)
                ? { ...r, invoiceNumber: invoice.invoiceNumber }
                : r
            )
          );
        }}
        showToast={showToast}
      />
    </div>
  );
}
