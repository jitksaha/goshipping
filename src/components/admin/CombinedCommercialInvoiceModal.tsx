import React, { useState, useMemo } from 'react';
import type { PosLedgerRecord } from '../../server/services/posLedger.service';

interface CombinedCommercialInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: PosLedgerRecord[];
  onInvoiceSaved?: (invoice: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function CombinedCommercialInvoiceModal({
  isOpen,
  onClose,
  selectedRecords,
  onInvoiceSaved,
  showToast
}: CombinedCommercialInvoiceModalProps) {
  if (!isOpen || selectedRecords.length === 0) return null;

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedInvoiceNumber, setSavedInvoiceNumber] = useState<string | null>(null);

  // Auto-generate invoice number based on current year and sequence or timestamp
  const initialInvoiceNum = useMemo(() => {
    const year = new Date().getFullYear();
    const randSeq = String(Math.floor(1000 + Math.random() * 9000));
    return `GS-INV-${year}-${randSeq}`;
  }, []);

  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNum);
  const [issueDate, setIssueDate] = useState(() => new Date().toLocaleDateString('en-GB'));
  const [deliveryAddress, setDeliveryAddress] = useState(
    'House 12, Road 4, Sector 7, Uttara Model Town, Dhaka-1230, Bangladesh'
  );
  const [shippingMethod, setShippingMethod] = useState(selectedRecords[0]?.serviceType || 'Air Priority Cargo');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>(() => {
    const allPaid = selectedRecords.every((r) => r.paymentStatus === 'Paid');
    return allPaid ? 'paid' : 'pending';
  });

  // Client Details derived from first record
  const primaryRecord = selectedRecords[0];
  const clientName = primaryRecord.importerClient || primaryRecord.customerName || 'Commercial Consignee';
  const contactPerson = primaryRecord.customerName;
  const mobileNo = primaryRecord.mobileNo || '+880 1711 000000';
  const shippingMark = primaryRecord.shippingMark || 'N/A';
  const orderCodes = selectedRecords.map((r) => r.orderId).join(', ');

  // Summary Computations
  const totals = useMemo(() => {
    const totalPcs = selectedRecords.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
    const totalWeightKg = selectedRecords.reduce(
      (acc, r) => acc + (Number(r.bdWeightKg || r.cnWeightKg) || 0),
      0
    );
    const totalPurchaseRmb = selectedRecords.reduce(
      (acc, r) => acc + (Number(r.totalPurchaseRmb) || 0),
      0
    );
    const totalPurchaseBdt = selectedRecords.reduce(
      (acc, r) => acc + (Number(r.purchaseCostBdt) || 0),
      0
    );
    const totalFreightBdt = selectedRecords.reduce(
      (acc, r) => acc + (Number(r.internationalFreightBdt) || 0),
      0
    );
    const grandTotalBdt = selectedRecords.reduce((acc, r) => acc + (Number(r.totalBillBdt) || 0), 0);
    const advancePaidBdt = selectedRecords.reduce(
      (acc, r) => acc + (Number(r.purchaseCostPaidBdt) || 0),
      0
    );
    const balanceDueBdt = Math.max(0, grandTotalBdt - advancePaidBdt);

    return {
      totalPcs,
      totalWeightKg: Math.round(totalWeightKg * 100) / 100,
      totalPurchaseRmb: Math.round(totalPurchaseRmb * 100) / 100,
      totalPurchaseBdt: Math.round(totalPurchaseBdt),
      totalFreightBdt: Math.round(totalFreightBdt),
      grandTotalBdt: Math.round(grandTotalBdt),
      advancePaidBdt: Math.round(advancePaidBdt),
      balanceDueBdt: Math.round(balanceDueBdt)
    };
  }, [selectedRecords]);

  // Handle Print Action
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
        totalWeightKg: totals.totalWeightKg,
        items: selectedRecords.map((r, idx) => ({
          itemId: `itm-${r.orderId || idx + 1}`,
          itemCode: r.orderId,
          description: r.itemDetails,
          packagingType: 'carton',
          arrivedQuantity: r.quantity,
          totalQuantity: r.quantity,
          weightKg: Number(r.bdWeightKg || r.cnWeightKg) || 1,
          ratePerKg: Number(r.shippingRatePerKgBdt) || 950,
          amountBDT: Number(r.totalBillBdt) || 0
        })),
        baseFreight: totals.totalFreightBdt,
        subtotal: totals.grandTotalBdt,
        totalBDT: totals.grandTotalBdt,
        advancePaid: totals.advancePaidBdt,
        balanceDue: totals.balanceDueBdt,
        status: paymentStatus,
        issueDate,
        paymentMethod: 'Bank Wire / bKash Merchant',
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
          `Commercial Invoice ${data.invoice.invoiceNumber || invoiceNumber} saved & hosted to Invoices desk!`,
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
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-100 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 my-auto flex flex-col max-h-[94vh]">
        {/* Top Control Bar (Non-Printable) */}
        <div className="no-print bg-white px-5 py-3.5 border-b border-slate-200 rounded-t-2xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-[#EA1D2C] border border-red-200 flex items-center justify-center font-bold text-sm">
              <svg className="w-4 h-4 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Combined Commercial Invoice &amp; Print Desk
              </h2>
              <p className="text-[11px] text-slate-500">
                Consolidating {selectedRecords.length} orders for{' '}
                <span className="font-semibold text-slate-800">{clientName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Save & Host Button */}
            <button
              type="button"
              disabled={isSaving || isSaved}
              onClick={handleSaveToInvoiceDesk}
              className={`h-9 px-3.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isSaved
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 cursor-default'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              {isSaved ? (
                <>
                  <svg className="w-4 h-4 text-emerald-600 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Hosted in Invoices ({savedInvoiceNumber})</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>{isSaving ? 'Hosting...' : 'Save to Invoices Desk'}</span>
                </>
              )}
            </button>

            {/* Print Commercial Invoice Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-4 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <svg className="w-4 h-4 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print Commercial Invoice</span>
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
            className="bg-white rounded-xl shadow-md border border-slate-300 p-6 sm:p-8 max-w-[800px] mx-auto text-slate-900 font-sans space-y-6"
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
                  China Sourcing &amp; International Freight Forwarding Desk
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Dhaka Hub: Plot 14, Sector 7, Uttara, Dhaka | Hotline: +880 1711 000000 | billing@goshipping.com.bd
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  Website: goshipping.com.bd · Cross-Border Trade &amp; Customs Desk
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase bg-slate-900 text-white">
                  Commercial Invoice
                </span>
                <div className="text-base font-mono font-extrabold text-[#EA1D2C] mt-1.5">
                  {invoiceNumber}
                </div>
                <div className="text-xs font-medium text-slate-600 mt-0.5">
                  Date: <span className="font-mono font-bold text-slate-900">{issueDate}</span>
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  Currency: <span className="font-bold text-slate-800">BDT (৳)</span>
                </div>
              </div>
            </div>

            {/* Billed To (Customer) & Logistics Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Box 1: Billed To / Consignee */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>BILL TO (IMPORTER / CLIENT)</span>
                  <span className="text-emerald-700 font-semibold lowercase">verified client</span>
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900">{clientName}</div>
                  {contactPerson && contactPerson !== clientName && (
                    <div className="text-slate-600 text-xs font-medium">Attn: {contactPerson}</div>
                  )}
                </div>
                <div className="text-slate-600 flex items-center gap-1.5 font-mono text-[11px]">
                  <span>Phone/WA:</span>
                  <span className="font-bold text-slate-800">{mobileNo}</span>
                </div>
                {shippingMark && shippingMark !== 'N/A' && (
                  <div className="text-slate-600 flex items-center gap-1.5 font-mono text-[11px]">
                    <span>Shipping Mark:</span>
                    <span className="font-bold text-[#EA1D2C] px-1.5 py-0.2 rounded bg-red-50 border border-red-200">
                      {shippingMark}
                    </span>
                  </div>
                )}
                <div className="text-slate-600 text-[11px] leading-relaxed pt-0.5">
                  <span className="text-slate-400">Address:</span> {deliveryAddress}
                </div>
              </div>

              {/* Box 2: Consignment & Logistics Summary */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>CONSIGNMENT &amp; ROUTE SPECIFICATION</span>
                  <span className="text-blue-700 font-semibold">{shippingMethod}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Origin Corridor:</span>
                    <span className="font-semibold text-slate-800">Guangzhou / Yiwu, China</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Destination Hub:</span>
                    <span className="font-semibold text-slate-800">Dhaka Hub (HSIA / Port)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Consignments:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedRecords.length} Orders ({totals.totalPcs} pcs)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Billed Cargo Weight:</span>
                    <span className="font-mono font-bold text-slate-900">{totals.totalWeightKg} KG</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono pt-1 truncate border-t border-slate-200/60 mt-1" title={orderCodes}>
                  <span className="text-slate-400">Orders:</span> {orderCodes}
                </div>
              </div>
            </div>

            {/* PRODUCT DETAILS TABLE */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-mono uppercase tracking-wider">
                    <th className="py-2.5 px-3 border-r border-slate-800 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 border-r border-slate-800">Product Specifications &amp; Order</th>
                    <th className="py-2.5 px-3 border-r border-slate-800 w-16 text-center">Qty</th>
                    <th className="py-2.5 px-3 border-r border-slate-800 text-right">Unit (¥)</th>
                    <th className="py-2.5 px-3 border-r border-slate-800 text-right">Purchase (৳)</th>
                    <th className="py-2.5 px-3 border-r border-slate-800 text-center">Weight</th>
                    <th className="py-2.5 px-3 border-r border-slate-800 text-right">Rate</th>
                    <th className="py-2.5 px-3 border-r border-slate-800 text-right">Freight (৳)</th>
                    <th className="py-2.5 px-3 text-right font-extrabold">Total (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                  {selectedRecords.map((r, idx) => {
                    const weight = Number(r.bdWeightKg || r.cnWeightKg) || 0;
                    return (
                      <tr key={r.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                        <td className="py-2 px-3 border-r border-slate-200 font-mono text-center text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200">
                          <div className="font-semibold text-slate-900">{r.itemDetails}</div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-[#EA1D2C]">{r.orderId}</span>
                            <span>·</span>
                            <span>{r.supplierName}</span>
                            {r.chinaCourierTracking && (
                              <>
                                <span>·</span>
                                <span className="text-slate-400">SF: {r.chinaCourierTracking}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-center font-mono font-medium">
                          {r.quantity}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono text-slate-600">
                          ¥{Number(r.unitPriceRmb).toFixed(2)}
                          <span className="block text-[9px] text-slate-400 font-sans">
                            @{Number(r.rmbRateBdt).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-semibold text-slate-900">
                          ৳{Number(r.purchaseCostBdt).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-700">
                          {weight} KG
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono text-slate-500">
                          ৳{r.shippingRatePerKgBdt}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-semibold text-sky-800">
                          ৳{Number(r.internationalFreightBdt).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/30">
                          ৳{Number(r.totalBillBdt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Grid: Payment Summary & Bank Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              {/* Left Column: Settlement & Payment Instructions */}
              <div className="rounded-lg border border-slate-200 p-3.5 space-y-2 bg-slate-50/30">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                  OFFICIAL SETTLEMENT BANK ACCOUNTS
                </div>
                <div className="text-[11px] text-slate-700 space-y-1 font-sans">
                  <div>
                    <span className="font-bold text-slate-900">1. Standard Chartered Bank:</span>
                    <div className="font-mono text-[10px] text-slate-600 pl-3">
                      A/C: <strong className="text-slate-900">01-8492049-01</strong> · Gulshan-2 Branch
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">2. The City Bank PLC:</span>
                    <div className="font-mono text-[10px] text-slate-600 pl-3">
                      A/C: <strong className="text-slate-900">1102948291001</strong> · Principal Branch
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">3. bKash Merchant:</span>
                    <div className="font-mono text-[10px] text-slate-600 pl-3">
                      Wallet: <strong className="text-slate-900">01711-000000</strong> (Payment Counter 1)
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 border-t border-slate-200 pt-1.5 leading-relaxed">
                  <strong>Notice:</strong> Final shipping/customs charges are calculated based on physical weight or CBM measured at Bangladesh customs gateway.
                </div>
              </div>

              {/* Right Column: Financial Summary Table */}
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden self-start">
                <div className="bg-slate-100 px-3.5 py-1.5 border-b border-slate-200 font-mono font-bold text-[10px] uppercase tracking-wider text-slate-700">
                  PAYMENT &amp; SETTLEMENT SUMMARY (BDT)
                </div>
                <table className="w-full text-xs font-mono">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-1.5 px-3.5 text-slate-600 font-sans">China Sourcing / Purchase Total:</td>
                      <td className="py-1.5 px-3.5 text-right font-medium text-slate-900">
                        ৳{totals.totalPurchaseBdt.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3.5 text-slate-600 font-sans">International Freight Charges:</td>
                      <td className="py-1.5 px-3.5 text-right font-medium text-sky-800">
                        ৳{totals.totalFreightBdt.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3.5 text-slate-600 font-sans">Customs &amp; Terminal Clearance:</td>
                      <td className="py-1.5 px-3.5 text-right text-slate-400">৳0.00 (Included)</td>
                    </tr>
                    <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                      <td className="py-2 px-3.5 text-slate-900 font-sans">GROSS TOTAL BILLED:</td>
                      <td className="py-2 px-3.5 text-right text-sm text-slate-900">
                        ৳{totals.grandTotalBdt.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3.5 text-emerald-700 font-sans">Paid / Advance Received:</td>
                      <td className="py-1.5 px-3.5 text-right font-semibold text-emerald-700">
                        ৳{totals.advancePaidBdt.toLocaleString()}
                      </td>
                    </tr>
                    <tr className={`border-t-2 ${totals.balanceDueBdt > 0 ? 'bg-red-50 text-rose-800 border-red-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}>
                      <td className="py-2.5 px-3.5 font-black font-sans text-xs uppercase tracking-wide">
                        {totals.balanceDueBdt > 0 ? 'NET BALANCE DUE:' : 'INVOICE FULLY PAID:'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-extrabold text-base">
                        ৳{totals.balanceDueBdt.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
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
                  Trusted China-to-Bangladesh Sourcing &amp; Express Forwarder
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
    </div>
  );
}
