import React, { useState, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { downloadInvoicePDF, SETTLEMENT_BANKS, type InvoiceRecordData } from '../../lib/invoicePdf';
import type { PosLedgerRecord } from '../../server/services/posLedger.service';

interface CustomerSummary {
  customerName: string;
  importerClient: string;
  totalOrders: number;
  activeOrders: number;
  totalBillBdt: number;
  totalPaidBdt: number;
  totalDueBdt: number;
  orders: Array<{
    id: string;
    orderId: string;
    itemDetails: string;
    currentStatus: string;
    totalBillBdt: number;
    purchaseCostPaidBdt: number;
    purchaseCostDueBdt: number;
    paymentStatus: string;
    shippingMark?: string;
  }>;
}

interface CombinedCommercialInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: PosLedgerRecord[];
  onInvoiceSaved?: (invoice: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onPaymentRecorded?: () => void;
}

export default function CombinedCommercialInvoiceModal({
  isOpen,
  onClose,
  selectedRecords,
  onInvoiceSaved,
  showToast,
  onPaymentRecorded
}: CombinedCommercialInvoiceModalProps) {
  if (!isOpen || selectedRecords.length === 0) return null;

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedInvoiceNumber, setSavedInvoiceNumber] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Auto-generate invoice number based on current year and sequence
  const initialInvoiceNum = useMemo(() => {
    const year = new Date().getFullYear();
    const randSeq = String(Math.floor(1000 + Math.random() * 9000));
    return `GS-INV-${year}-${randSeq}`;
  }, []);

  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNum);
  const [issueDate, setIssueDate] = useState(() => {
    const now = new Date();
    return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  });
  const [deliveryAddress, setDeliveryAddress] = useState(
    'House 12, Road 4, Sector 7, Uttara Model Town, Dhaka-1230, Bangladesh'
  );
  const [shippingMethod, setShippingMethod] = useState(
    selectedRecords[0]?.serviceType || 'Air Cargo (7–14 days)'
  );

  // Client Details derived from first record
  const primaryRecord = selectedRecords[0];
  const clientName = primaryRecord.importerClient || primaryRecord.customerName || 'Commercial Consignee';
  const contactPerson = primaryRecord.customerName;
  const mobileNo = primaryRecord.mobileNo || '+880 1711 000000';
  const shippingMark = primaryRecord.shippingMark || 'N/A';
  const orderCodes = selectedRecords.map((r) => r.orderId).join(', ');

  // Base Products Subtotal from selected records
  const productsSubtotal = useMemo(() => {
    return selectedRecords.reduce((acc, r) => acc + (Number(r.purchaseCostBdt) || 0), 0);
  }, [selectedRecords]);

  // Default pre-filled freight charges from selected records
  const initialFreightSum = useMemo(() => {
    return selectedRecords.reduce((acc, r) => acc + (Number(r.internationalFreightBdt) || 0), 0);
  }, [selectedRecords]);

  // Default pre-filled paid amount from selected records
  const initialPaidSum = useMemo(() => {
    return selectedRecords.reduce((acc, r) => acc + (Number(r.purchaseCostPaidBdt) || 0), 0);
  }, [selectedRecords]);

  // Total Pcs and Weight
  const totalPcs = useMemo(() => {
    return selectedRecords.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
  }, [selectedRecords]);

  const totalWeightKg = useMemo(() => {
    const w = selectedRecords.reduce(
      (acc, r) => acc + (Number(r.bdWeightKg || r.cnWeightKg) || 0),
      0
    );
    return Math.round(w * 100) / 100;
  }, [selectedRecords]);

  // Editable Financial States
  const [shippingCharges, setShippingCharges] = useState<number>(initialFreightSum);
  const [discountBdt, setDiscountBdt] = useState<number>(0);
  const [advancePaidBdt, setAdvancePaidBdt] = useState<number>(initialPaidSum);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank / bKash / Nagad');

  // Sync state if selected records change
  useEffect(() => {
    setShippingCharges(initialFreightSum);
    setAdvancePaidBdt(initialPaidSum);
  }, [initialFreightSum, initialPaidSum]);

  // Calculated Grand Total & Balance Due
  const grandTotalBdt = useMemo(() => {
    const total = productsSubtotal + (Number(shippingCharges) || 0) - (Number(discountBdt) || 0);
    return Math.max(0, Math.round(total * 100) / 100);
  }, [productsSubtotal, shippingCharges, discountBdt]);

  const balanceDueBdt = useMemo(() => {
    const due = grandTotalBdt - (Number(advancePaidBdt) || 0);
    return Math.max(0, Math.round(due * 100) / 100);
  }, [grandTotalBdt, advancePaidBdt]);

  // Payment Status
  const paymentStatus = useMemo<'Due' | 'Partial' | 'Paid'>(() => {
    if (balanceDueBdt <= 0 && grandTotalBdt > 0) return 'Paid';
    if (advancePaidBdt > 0) return 'Partial';
    return 'Due';
  }, [balanceDueBdt, grandTotalBdt, advancePaidBdt]);

  // Customer Overall Account Summary Across All Orders
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    const clientKey = primaryRecord.importerClient || primaryRecord.customerName || primaryRecord.mobileNo;
    if (!clientKey) return;

    setLoadingSummary(true);
    fetch(`/api/admin/pos-ledger/customer-summary?client=${encodeURIComponent(clientKey)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.summary) {
          setCustomerSummary(data.summary);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [primaryRecord]);

  // Quick Payment Recording Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<string>(
    selectedRecords[0]?.id || ''
  );
  const [paymentMethodInput, setPaymentMethodInput] = useState<string>('bKash');
  const [paymentMilestoneInput, setPaymentMilestoneInput] = useState<string>(
    'Commercial Invoice Payment'
  );
  const [paymentTrxIdInput, setPaymentTrxIdInput] = useState<string>('');
  const [paymentNoteInput, setPaymentNoteInput] = useState<string>('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Handle Quick Payment Submit
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmountInput);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    setRecordingPayment(true);
    try {
      const res = await fetch(`/api/admin/pos-ledger/${selectedOrderForPayment}/payment`, {
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
          `Payment of ৳${amount.toLocaleString()} recorded successfully!`,
          'success'
        );
        // Update local advance paid state
        setAdvancePaidBdt((prev) => prev + amount);
        setShowPaymentModal(false);
        setPaymentAmountInput('');
        setPaymentTrxIdInput('');
        setPaymentNoteInput('');

        // Refresh customer summary
        const clientKey = primaryRecord.importerClient || primaryRecord.customerName;
        if (clientKey) {
          fetch(`/api/admin/pos-ledger/customer-summary?client=${encodeURIComponent(clientKey)}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.summary) setCustomerSummary(d.summary);
            })
            .catch(() => {});
        }

        if (onPaymentRecorded) {
          onPaymentRecorded();
        }
      } else {
        throw new Error(data.error || 'Failed to record payment');
      }
    } catch (err: any) {
      showToast(err.message || 'Error recording payment', 'error');
    } finally {
      setRecordingPayment(false);
    }
  };

  // Direct PDF Generation & Download (No browser print popups, no URL/date headers)
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    // Give 120ms for DOM re-render so editable input boxes become clean formatted text
    await new Promise((r) => setTimeout(r, 120));

    try {
      const element = document.getElementById('printable-commercial-invoice');
      if (!element) throw new Error('Invoice printable element not found');

      const canvas = await html2canvas(element, {
        scale: 2.5, // 2.5x high-res retina output for crisp text and lines
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (el) => el.classList.contains('no-print')
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const cleanInvoiceId = (invoiceNumber || 'INV-2026').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`GoShipping_Commercial_Invoice_${cleanInvoiceId}.pdf`);
      showToast(`Invoice ${invoiceNumber} PDF downloaded directly!`, 'success');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      // Fallback to pure vector jsPDF
      try {
        handleDownloadVectorPDF();
      } catch (fallbackErr) {
        showToast('Failed to download invoice PDF', 'error');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Pure Vector PDF (Mushak 6.3 Standard)
  const handleDownloadVectorPDF = () => {
    const fallbackInvoice: InvoiceRecordData = {
      invoiceNumber,
      customerName: clientName,
      destination: 'Dhaka Hub (HSIA / Chittagong)',
      origin: 'Guangzhou / Yiwu CFS, China',
      recipient: contactPerson || clientName,
      trackingNumber: orderCodes || primaryRecord.orderId || 'GOSH-CARGO',
      issueDate,
      dueDate: issueDate,
      status: balanceDueBdt <= 0 ? 'paid' : 'pending',
      mode: shippingMethod.toLowerCase().includes('sea') ? 'sea' : 'air',
      weightKg: totalWeightKg,
      baseFreight: shippingCharges,
      terminalHandling: 0,
      customsDuty: 0,
      fuelSurcharge: 0,
      vatTax: 0,
      totalBDT: grandTotalBdt,
      totalUSD: Math.round(grandTotalBdt / 122),
      paymentMethod
    };
    downloadInvoicePDF(fallbackInvoice, SETTLEMENT_BANKS[0]);
    showToast(`Vector Tax Invoice ${invoiceNumber} downloaded!`, 'success');
  };

  // Handle Print Action (Fallback / Hardware Print)
  const handlePrint = () => {
    window.print();
  };

  // Handle Save to Invoice Desk
  const handleSaveToInvoiceDesk = async () => {
    setIsSaving(true);
    try {
      const payload = {
        isCombined: true,
        invoiceNumber,
        orderIds: selectedRecords.map((r) => r.orderId),
        customerName: contactPerson,
        companyName: primaryRecord.importerClient,
        customerPhone: mobileNo,
        customerAddress: deliveryAddress,
        shippingMark,
        mode: shippingMethod.toLowerCase().includes('sea') ? 'sea' : 'air',
        totalWeightKg,
        items: selectedRecords.map((r, idx) => ({
          itemId: `itm-${r.orderId || idx + 1}`,
          itemCode: r.orderId,
          description: r.itemDetails,
          packagingType: 'carton',
          arrivedQuantity: r.quantity,
          totalQuantity: r.quantity,
          weightKg: Number(r.bdWeightKg || r.cnWeightKg) || 1,
          ratePerKg: Number(r.shippingRatePerKgBdt) || 850,
          amountBDT: Number(r.purchaseCostBdt) || 0
        })),
        baseFreight: shippingCharges,
        shippingCharges,
        discount: discountBdt,
        subtotal: productsSubtotal,
        totalBDT: grandTotalBdt,
        advancePaid: advancePaidBdt,
        balanceDue: balanceDueBdt,
        status: balanceDueBdt <= 0 ? 'paid' : 'pending',
        issueDate,
        paymentMethod,
        notes: `Consolidated commercial invoice for ${selectedRecords.length} consignments (${orderCodes})`
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSaved(true);
        setSavedInvoiceNumber(data.invoice.invoiceNumber || invoiceNumber);
        showToast(
          `Commercial Invoice ${data.invoice.invoiceNumber || invoiceNumber} saved to Invoices desk!`,
          'success'
        );
        if (onInvoiceSaved) {
          onInvoiceSaved(data.invoice);
        }
      } else {
        throw new Error(data.error || 'Failed to save invoice to server');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving invoice', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-100 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 my-auto flex flex-col max-h-[95vh]">
        {/* Top Control Bar (Non-Printable) */}
        <div className="no-print bg-white px-5 py-3.5 border-b border-slate-200 rounded-t-2xl flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-[#EA1D2C] border border-red-200 flex items-center justify-center font-bold text-sm">
              <svg className="w-4 h-4 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Commercial Invoice Desk</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold">
                  Excel-Template Parity
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Consolidating {selectedRecords.length} items for{' '}
                <span className="font-semibold text-slate-800">{clientName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Record Partial Payment Button */}
            <button
              type="button"
              onClick={() => {
                setPaymentAmountInput(String(balanceDueBdt > 0 ? balanceDueBdt : ''));
                setShowPaymentModal(true);
              }}
              className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>+ Record Payment</span>
            </button>

            {/* Save to Invoice Desk Button */}
            <button
              type="button"
              disabled={isSaving || isSaved}
              onClick={handleSaveToInvoiceDesk}
              className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isSaved
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 cursor-default'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              {isSaved ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Hosted ({savedInvoiceNumber})</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>{isSaving ? 'Saving...' : 'Save to Desk'}</span>
                </>
              )}
            </button>

            {/* Download PDF Button (Primary Action) */}
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPDF}
              className="h-9 px-4 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-60"
              title="Download professional PDF invoice directly without browser print popups"
            >
              {isGeneratingPdf ? (
                <>
                  <svg className="w-4 h-4 animate-spin stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download PDF Invoice</span>
                </>
              )}
            </button>

            {/* Direct Vector PDF Option */}
            <button
              type="button"
              onClick={handleDownloadVectorPDF}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              title="Download pure vector Mushak 6.3 PDF"
            >
              <svg className="w-3.5 h-3.5 text-slate-500 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Vector PDF</span>
            </button>

            {/* System Print (Fallback Icon) */}
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
              title="Print via system printer dialog"
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              title="Close modal"
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="18" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Printable Paper Canvas */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-200/70">
          <div
            id="printable-commercial-invoice"
            className="bg-white rounded-xl shadow-md border border-slate-300 p-6 sm:p-8 max-w-[820px] mx-auto text-slate-900 font-sans space-y-6"
          >
            {/* Header: GoShipping Brand & Invoice Title */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#EA1D2C] inline-block shrink-0" />
                  <span className="text-2xl font-black tracking-tight text-slate-900 font-['Manrope']">
                    Go<span className="text-[#EA1D2C]">Shipping</span>
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-700 mt-1">
                  China Sourcing &amp; Shipping to Bangladesh
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Dhaka Hub: Plot 14, Sector 7, Uttara, Dhaka | Hotline: +880 1711 000000 | billing@goshipping.com.bd
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  Website: goshipping.com.bd · Cross-Border Trade &amp; Customs Desk
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block px-3 py-1 rounded text-xs font-mono font-bold tracking-wider uppercase bg-[#EA1D2C] text-white">
                  ORDER INVOICE
                </span>
                <div className="text-sm font-mono font-extrabold text-slate-900 mt-2">
                  INVOICE NO: <span className="text-[#EA1D2C]">{invoiceNumber}</span>
                </div>
                <div className="text-xs font-medium text-slate-600 mt-0.5">
                  DATE: <span className="font-mono font-bold text-slate-900">{issueDate}</span>
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  CURRENCY: <span className="font-bold text-slate-800">BDT (৳)</span>
                </div>
              </div>
            </div>

            {/* BILL TO & CUSTOMER IDENTIFICATION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* BILL TO BOX */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>BILL TO</span>
                  <span className="text-emerald-700 font-semibold lowercase">verified consignee</span>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  <span className="text-slate-500 text-[11px]">Customer Name:</span>
                  <span className="col-span-2 font-extrabold text-slate-900 text-xs">
                    {clientName}
                  </span>
                </div>
                {contactPerson && contactPerson !== clientName && (
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500 text-[11px]">Attn / Person:</span>
                    <span className="col-span-2 font-semibold text-slate-800 text-[11px]">
                      {contactPerson}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-1 font-mono">
                  <span className="text-slate-500 text-[11px]">Phone / WhatsApp:</span>
                  <span className="col-span-2 font-bold text-slate-900 text-[11px]">
                    {mobileNo}
                  </span>
                </div>
                {primaryRecord.importerClient && (
                  <div className="grid grid-cols-3 gap-1 font-mono">
                    <span className="text-slate-500 text-[11px]">Business / Page:</span>
                    <span className="col-span-2 font-medium text-slate-800 text-[11px]">
                      {primaryRecord.importerClient}
                    </span>
                  </div>
                )}
                {shippingMark && shippingMark !== 'N/A' && (
                  <div className="grid grid-cols-3 gap-1 font-mono">
                    <span className="text-slate-500 text-[11px]">Shipping Mark:</span>
                    <span className="col-span-2 font-bold text-[#EA1D2C] text-[11px]">
                      {shippingMark}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 text-[11px]">Delivery Address:</span>
                  <span className="col-span-2 text-slate-700 text-[11px] leading-relaxed">
                    {deliveryAddress}
                  </span>
                </div>
              </div>

              {/* CONSIGNMENT & ROUTE SPECIFICATION */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>SHIPPING &amp; LOGISTICS ROUTE</span>
                  <span className="text-blue-700 font-bold">{shippingMethod}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Origin Hub:</span>
                    <span className="font-semibold text-slate-800">Guangzhou / Yiwu, China</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Destination Hub:</span>
                    <span className="font-semibold text-slate-800">Dhaka Hub (HSIA / Chittagong)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Consignments:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedRecords.length} Products ({totalPcs} Pcs)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Billed Weight:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {totalWeightKg > 0 ? `${totalWeightKg} KG` : 'Pending Weight'}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-200/60 mt-1 truncate" title={orderCodes}>
                  <span className="text-slate-400">Order IDs:</span> {orderCodes}
                </div>
              </div>
            </div>

            {/* PRODUCT DETAILS TABLE (Matching Excel Format) */}
            <div className="border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
              <div className="bg-[#EA1D2C] text-white px-3.5 py-2 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                <span>PRODUCT DETAILS</span>
                <span className="text-[11px] font-normal">{selectedRecords.length} Selected Line Items</span>
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-[10px] font-mono uppercase tracking-wider font-bold border-b border-slate-300">
                    <th className="py-2.5 px-3 border-r border-slate-200 w-16 text-center">Photo</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">Product / Details</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-24 text-center">SKU / Model</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-28 text-center">Tracking No.</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-14 text-center">Qty</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-24 text-right">Unit Price (৳)</th>
                    <th className="py-2.5 px-3 text-right w-28 font-bold">Total (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                  {selectedRecords.map((r, idx) => {
                    const unitPriceBdt = r.quantity > 0
                      ? Math.round(((Number(r.purchaseCostBdt) || 0) / r.quantity) * 100) / 100
                      : Math.round((Number(r.unitPriceRmb) || 0) * (Number(r.rmbRateBdt) || 19.5));
                    const lineTotal = Number(r.purchaseCostBdt) || (unitPriceBdt * r.quantity);

                    return (
                      <tr key={r.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                        {/* Product Photo */}
                        <td className="py-2.5 px-2 border-r border-slate-200 text-center">
                          <div className="w-10 h-10 mx-auto rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 overflow-hidden">
                            <svg className="w-5 h-5 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                          </div>
                        </td>

                        {/* Product / Details */}
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <div className="font-bold text-slate-900 text-xs">{r.itemDetails}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-amber-800">{r.supplierName}</span>
                            <span>·</span>
                            <span>¥{Number(r.unitPriceRmb).toFixed(2)} @ ৳{r.rmbRateBdt}</span>
                          </div>
                        </td>

                        {/* SKU / Model */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-medium text-slate-700">
                          {r.shippingMark || 'Standard'}
                        </td>

                        {/* Tracking No */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono">
                          <div className="font-bold text-slate-900 text-[11px]">{r.orderId}</div>
                          {r.chinaCourierTracking && (
                            <div className="text-[9px] text-slate-400 truncate max-w-[100px] mx-auto" title={r.chinaCourierTracking}>
                              CN: {r.chinaCourierTracking}
                            </div>
                          )}
                        </td>

                        {/* Qty */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-semibold">
                          {r.quantity}
                        </td>

                        {/* Unit Price (৳) */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-slate-700">
                          ৳{unitPriceBdt.toLocaleString()}
                        </td>

                        {/* Total (৳) */}
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900 bg-slate-50/40">
                          ৳{lineTotal.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAYMENT SUMMARY & CUSTOMER OVERALL BALANCE (EXCEL ALIGNED) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs pt-1">
              {/* Left Column: Settlement Bank Instructions & Customer Overall Outstanding Due */}
              <div className="space-y-4">
                {/* Highlighted Banner: Customer Total Outstanding Due Across All Active Consignments */}
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                      <span>CUSTOMER OVERALL ACCOUNT DUE (সকল অর্ডারের বকেয়া)</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-800">
                      {customerSummary ? `${customerSummary.totalOrders} Total Orders` : 'Loading...'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-[11px] text-amber-950 font-medium block">
                        Total Outstanding Across All Active Consignments:
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Including pending orders &amp; uncollected shipments
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black font-mono text-rose-700">
                        ৳{(customerSummary?.totalDueBdt ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {customerSummary && customerSummary.orders.filter((o) => o.purchaseCostDueBdt > 0).length > 0 && (
                    <div className="text-[10px] font-mono text-slate-600 pt-1.5 border-t border-amber-200/70 space-y-1">
                      <span className="font-semibold text-slate-700 block">Unsettled Consignments:</span>
                      <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1">
                        {customerSummary.orders
                          .filter((o) => o.purchaseCostDueBdt > 0)
                          .map((o) => (
                            <div key={o.id} className="flex items-center justify-between text-[10px] bg-white/70 px-2 py-0.5 rounded border border-amber-200/50">
                              <span className="font-bold text-slate-800">{o.orderId}</span>
                              <span className="text-slate-500 truncate max-w-[140px]">{o.itemDetails}</span>
                              <span className="text-rose-600 font-bold">Due: ৳{o.purchaseCostDueBdt.toLocaleString()}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Settlement Accounts */}
                <div className="rounded-lg border border-slate-200 p-3.5 space-y-2 bg-slate-50/40">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1">
                    OFFICIAL SETTLEMENT BANK &amp; WALLETS
                  </div>
                  <div className="text-[11px] text-slate-700 space-y-1.5 font-sans">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">1. Standard Chartered Bank:</span>
                      <span className="font-mono text-[10px] text-slate-700">01-8492049-01</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">2. The City Bank PLC:</span>
                      <span className="font-mono text-[10px] text-slate-700">1102948291001</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">3. bKash Merchant:</span>
                      <span className="font-mono text-[10px] text-[#EA1D2C] font-bold">01711-000000</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 border-t border-slate-200 pt-1 leading-relaxed">
                    <strong>Note:</strong> Final shipping and customs charges are calculated based on actual weight measured at Bangladesh entry gateway.
                  </p>
                </div>
              </div>

              {/* Right Column: Financial Summary Table (Excel Table Aligned) */}
              <div className="rounded-lg border border-slate-300 bg-white overflow-hidden self-start shadow-2xs">
                <div className="bg-slate-900 text-white px-3.5 py-2 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                  <span>PAYMENT SUMMARY</span>
                  <span className="text-[10px] text-slate-300">AMOUNT (৳)</span>
                </div>
                <table className="w-full text-xs font-mono">
                  <tbody className="divide-y divide-slate-100">
                    {/* Products Subtotal */}
                    <tr>
                      <td className="py-2 px-3.5 text-slate-700 font-sans font-medium">Products Subtotal:</td>
                      <td className="py-2 px-3.5 text-right font-bold text-slate-900 text-sm">
                        ৳{productsSubtotal.toLocaleString()}
                      </td>
                    </tr>

                    {/* Shipping / Other Charges (Editable) */}
                    <tr className="bg-sky-50/30">
                      <td className="py-2 px-3.5 text-slate-700 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span>Shipping / Other Charges:</span>
                          <span className="no-print text-[9px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-bold uppercase">
                            Editable
                          </span>
                        </div>
                      </td>
                      <td className="py-1 px-3 text-right">
                        {isGeneratingPdf ? (
                          <span className="font-mono font-bold text-sky-800 text-xs">
                            ৳{shippingCharges.toLocaleString()}
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-400">৳</span>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={shippingCharges}
                              onChange={(e) => setShippingCharges(Number(e.target.value) || 0)}
                              className="w-24 text-right h-7 px-1.5 font-mono font-bold text-sky-800 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Manual Discount (Editable) */}
                    <tr className="bg-amber-50/30">
                      <td className="py-2 px-3.5 text-slate-700 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span>Discount / Adjustment:</span>
                          <span className="no-print text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold uppercase">
                            Manual
                          </span>
                        </div>
                      </td>
                      <td className="py-1 px-3 text-right">
                        {isGeneratingPdf ? (
                          <span className="font-mono font-bold text-amber-700 text-xs">
                            - ৳{discountBdt.toLocaleString()}
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-amber-600">- ৳</span>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={discountBdt}
                              onChange={(e) => setDiscountBdt(Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-24 text-right h-7 px-1.5 font-mono font-bold text-amber-700 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* GRAND TOTAL */}
                    <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-300">
                      <td className="py-2 px-3.5 text-slate-900 font-sans text-xs uppercase tracking-wide">
                        GRAND TOTAL:
                      </td>
                      <td className="py-2 px-3.5 text-right text-base text-slate-900 font-black">
                        ৳{grandTotalBdt.toLocaleString()}
                      </td>
                    </tr>

                    {/* Paid / Advance Received (Editable) */}
                    <tr className="bg-emerald-50/40">
                      <td className="py-2 px-3.5 text-emerald-800 font-sans font-medium">
                        <div className="flex items-center justify-between">
                          <span>Paid / Advance:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentAmountInput(String(balanceDueBdt > 0 ? balanceDueBdt : ''));
                              setShowPaymentModal(true);
                            }}
                            className="no-print text-[10px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                          >
                            + Add Entry
                          </button>
                        </div>
                      </td>
                      <td className="py-1 px-3 text-right">
                        {isGeneratingPdf ? (
                          <span className="font-mono font-bold text-emerald-700 text-xs">
                            ৳{advancePaidBdt.toLocaleString()}
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-emerald-600">৳</span>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={advancePaidBdt}
                              onChange={(e) => setAdvancePaidBdt(Number(e.target.value) || 0)}
                              className="w-24 text-right h-7 px-1.5 font-mono font-bold text-emerald-700 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* BALANCE DUE */}
                    <tr className={`border-t-2 ${balanceDueBdt > 0 ? 'bg-red-50 text-rose-800 border-red-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}>
                      <td className="py-3 px-3.5 font-black font-sans text-xs uppercase tracking-wide">
                        {balanceDueBdt > 0 ? 'BALANCE DUE (INVOICE):' : 'INVOICE FULLY PAID:'}
                      </td>
                      <td className="py-3 px-3.5 text-right font-black text-lg">
                        ৳{balanceDueBdt.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Status Badge */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-sans">Payment Status:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                    paymentStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : paymentStatus === 'Partial'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                    {paymentStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* SHIPPING & PAYMENT TERMS (EXCEL SHEET ROWS 30-33) */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 text-[11px] space-y-2">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                SHIPPING &amp; PAYMENT POLICY
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Shipping Mode:</span>
                  <span className="font-semibold text-slate-900">{shippingMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Est. Delivery:</span>
                  <span className="font-semibold text-slate-900">Air: 7–14 days* | Sea: 30–45 days*</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Payment Status:</span>
                  <span className="font-semibold text-slate-900">{paymentStatus}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Payment Method:</span>
                  <span className="font-semibold text-slate-900">{paymentMethod}</span>
                </div>
              </div>
            </div>

            {/* Signatures & Footer Note */}
            <div className="pt-6 border-t border-slate-200 flex items-end justify-between text-[11px] text-slate-600">
              <div className="space-y-1">
                <div className="w-40 border-b border-slate-300" />
                <div className="text-[10px] text-slate-400">Customer Receiver Signature</div>
              </div>

              <div className="text-center space-y-0.5">
                <div className="font-bold text-slate-800">Thank you for choosing Go Shipping.</div>
                <div className="text-[10px] text-slate-400">
                  Trusted Import &amp; Logistics Partner | goshipping.com.bd
                </div>
              </div>

              <div className="space-y-1 text-right">
                <div className="w-40 border-b border-slate-900 ml-auto" />
                <div className="text-[10px] font-bold text-slate-800">Authorized Accounts Signatory</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK PAYMENT RECORDING MODAL (POPUP) — Clean Light Design */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-w-md w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center font-bold text-base shadow-2xs">
                  ৳
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Manrope']">
                    Record Partial Payment
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Record installment / collection against invoice
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-4 space-y-3.5 text-xs bg-white">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 text-[11px]">Apply Payment to Order</label>
                <select
                  value={selectedOrderForPayment}
                  onChange={(e) => {
                    setSelectedOrderForPayment(e.target.value);
                    const target = selectedRecords.find((r) => r.id === e.target.value);
                    if (target && target.purchaseCostDueBdt > 0) {
                      setPaymentAmountInput(String(target.purchaseCostDueBdt));
                    }
                  }}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-2xs cursor-pointer"
                >
                  {selectedRecords.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.orderId} — {r.itemDetails} (Due: ৳{r.purchaseCostDueBdt})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Due Pill for selected order */}
              {(() => {
                const cur = selectedRecords.find((r) => r.id === selectedOrderForPayment);
                if (!cur) return null;
                return (
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 grid grid-cols-3 divide-x divide-slate-200/70 text-center">
                    <div className="px-1">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Total Billed</span>
                      <span className="font-bold text-slate-900 font-mono text-xs block mt-0.5">৳{Number(cur.totalBillBdt).toLocaleString()}</span>
                    </div>
                    <div className="px-1">
                      <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider block">Already Paid</span>
                      <span className="font-bold text-emerald-600 font-mono text-xs block mt-0.5">৳{Number(cur.purchaseCostPaidBdt).toLocaleString()}</span>
                    </div>
                    <div className="px-1">
                      <span className="text-[10px] text-rose-600 font-semibold uppercase tracking-wider block">Balance Due</span>
                      <span className="font-bold text-rose-600 font-mono text-xs block mt-0.5">৳{Number(cur.purchaseCostDueBdt).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 text-xs">
                    Amount Received (৳) <span className="text-rose-500">*</span>
                  </label>
                  {(() => {
                    const cur = selectedRecords.find((r) => r.id === selectedOrderForPayment);
                    if (cur && cur.purchaseCostDueBdt > 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => setPaymentAmountInput(String(cur.purchaseCostDueBdt))}
                          className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>Pay Full Due: ৳{Number(cur.purchaseCostDueBdt).toLocaleString()}</span>
                        </button>
                      );
                    }
                    return null;
                  })()}
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
                    <option value="Bank Transfer">Bank Transfer (City / SCB)</option>
                    <option value="Cash">Cash in Hand</option>
                    <option value="Rocket">Rocket</option>
                    <option value="Upay">Upay</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 text-[11px]">Milestone / Purpose</label>
                  <select
                    value={paymentMilestoneInput}
                    onChange={(e) => setPaymentMilestoneInput(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-2xs cursor-pointer"
                  >
                    <option value="Commercial Invoice Payment">Commercial Invoice Payment</option>
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
                    placeholder="e.g. BK-9948201"
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 text-[11px]">
                    Note / Remark <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentNoteInput}
                    onChange={(e) => setPaymentNoteInput(e.target.value)}
                    placeholder="Customer paid via agent"
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 cursor-pointer text-xs font-semibold transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold cursor-pointer disabled:opacity-50 text-xs shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                >
                  {recordingPayment ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Recording...</span>
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
    </div>
  );
}
