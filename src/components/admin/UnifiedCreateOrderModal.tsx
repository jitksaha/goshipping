import React, { useState, useMemo } from 'react';

interface UnifiedCreateOrderModalProps {
  isOpen: boolean;
  initialTab?: 'sourcing' | 'freight';
  onClose: () => void;
  onOrderCreated: (orderType: 'sourcing' | 'freight', record?: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  customers?: any[];
}

export default function UnifiedCreateOrderModal({
  isOpen,
  initialTab = 'sourcing',
  onClose,
  onOrderCreated,
  showToast,
  customers = []
}: UnifiedCreateOrderModalProps) {
  const [activeTab, setActiveTab] = useState<'sourcing' | 'freight'>(initialTab);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial tab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // -------------------------------------------------------------
  // TAB 1: Sourcing & Purchase (POS) State
  // -------------------------------------------------------------
  const [posForm, setPosForm] = useState({
    customerName: '',
    mobileNo: '',
    importerClient: '',
    shippingMark: '',
    websiteOrderNo: '',
    itemDetails: '',
    chinaCourierTracking: '',
    supplierName: 'Taobao',
    quantity: 1,
    unitPriceRmb: 0,
    rmbRateBdt: 19.5,
    purchaseCostPaidBdt: 0,
    serviceType: 'Sourcing & Shipping',
    cnWeightKg: 0,
    shippingRatePerKgBdt: 850,
    bdCourierName: 'Steadfast',
    bdTrackingNo: '',
    remark: ''
  });

  const posCalculations = useMemo(() => {
    const qty = Number(posForm.quantity) || 0;
    const rmb = Number(posForm.unitPriceRmb) || 0;
    const rate = Number(posForm.rmbRateBdt) || 19.5;
    const paidBdt = Number(posForm.purchaseCostPaidBdt) || 0;
    const weight = Number(posForm.cnWeightKg) || 0;
    const freightRate = Number(posForm.shippingRatePerKgBdt) || 850;

    const totalRmb = Math.round(qty * rmb * 100) / 100;
    const purchaseCostBdt = Math.round(totalRmb * rate * 100) / 100;
    const intlFreightBdt = Math.round(weight * freightRate * 100) / 100;
    const totalBillBdt = Math.round((purchaseCostBdt + intlFreightBdt) * 100) / 100;
    const purchaseDueBdt = Math.max(0, Math.round((totalBillBdt - paidBdt) * 100) / 100);

    let paymentStatus: 'Due' | 'Paid' | 'Partial' = 'Due';
    if (paidBdt >= totalBillBdt && totalBillBdt > 0) {
      paymentStatus = 'Paid';
    } else if (paidBdt > 0) {
      paymentStatus = 'Partial';
    }

    return { totalRmb, purchaseCostBdt, intlFreightBdt, totalBillBdt, purchaseDueBdt, paymentStatus };
  }, [posForm]);

  const handlePosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posForm.customerName.trim()) {
      showToast('Please enter customer or buyer name', 'error');
      return;
    }
    if (!posForm.itemDetails.trim()) {
      showToast('Please enter product description', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...posForm,
        orderDate: new Date().toISOString().split('T')[0],
        cnDate: new Date().toISOString().split('T')[0],
        currentStatus: 'Processing',
        totalBillBdt: posCalculations.totalBillBdt,
        paymentStatus: posCalculations.paymentStatus
      };

      const res = await fetch('/api/admin/pos-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create POS sourcing order');
      }

      showToast(`Sourcing order ${data.record?.orderId || ''} created successfully!`, 'success');
      onOrderCreated('sourcing', data.record);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error creating sourcing order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: Freight Shipment Consignment State
  // -------------------------------------------------------------
  const [freightForm, setFreightForm] = useState({
    customerId: '',
    customerName: '',
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    type: 'air' as 'air' | 'sea' | 'express',
    origin: 'Guangzhou, China',
    destination: 'Dhaka, Bangladesh',
    weight: 1,
    packages: 1,
    declaredValue: 0,
    shippingMark: '',
    specialHandling: [] as string[],
    remarks: ''
  });

  const handleFreightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freightForm.customerName.trim() && !freightForm.customerId) {
      showToast('Please select or enter customer name', 'error');
      return;
    }
    if (!freightForm.recipientName.trim()) {
      showToast('Please enter recipient / consignee contact name', 'error');
      return;
    }
    if (!freightForm.recipientPhone.trim()) {
      showToast('Please enter recipient contact phone', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: freightForm.customerId || 'usr-walkin',
        customerName: freightForm.customerName.trim() || 'Direct Consignee',
        origin: freightForm.origin,
        destination: freightForm.destination,
        type: freightForm.type,
        weight: Number(freightForm.weight) || 1,
        packages: Number(freightForm.packages) || 1,
        declaredValue: Number(freightForm.declaredValue) || 0,
        shippingMark: freightForm.shippingMark.trim() || 'GOSH-CARGO',
        specialHandling: freightForm.specialHandling,
        recipientName: freightForm.recipientName.trim(),
        recipientPhone: freightForm.recipientPhone.trim(),
        recipientAddress: freightForm.recipientAddress.trim() || `${freightForm.destination}`,
        remarks: freightForm.remarks.trim()
      };

      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create freight consignment');
      }

      showToast(`Freight shipment ${data.shipment?.trackingNumber || ''} registered successfully!`, 'success');
      onOrderCreated('freight', data.shipment);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error registering freight shipment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-8 shadow-2xl border border-slate-200 max-h-[94vh] overflow-y-auto space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-['Manrope',sans-serif]">
              Create New Order
            </h2>
            <p className="text-xs text-slate-500">
              Select order type: Sourcing & Purchase (POS) or Freight Consignment Only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-none cursor-pointer"
            title="Close dialog"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Unified Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('sourcing')}
            className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-none cursor-pointer ${
              activeTab === 'sourcing'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            <span>Sourcing (POS)</span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-red-50 text-[#EA1D2C]">
              RMB + Sheet
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('freight')}
            className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-none cursor-pointer ${
              activeTab === 'freight'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="m7.5 4.27 9 5.15" />
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
            <span>Freight Only</span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
              Cargo Tracking
            </span>
          </button>
        </div>

        {/* TAB 1: SOURCING (POS) FORM */}
        {activeTab === 'sourcing' && (
          <form onSubmit={handlePosSubmit} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer / Buyer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Textiles / Rahman"
                  value={posForm.customerName}
                  onChange={(e) => setPosForm({ ...posForm, customerName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="e.g. 01711000000"
                  value={posForm.mobileNo}
                  onChange={(e) => setPosForm({ ...posForm, mobileNo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shipping Mark</label>
                <input
                  type="text"
                  placeholder="e.g. GS-DH-09"
                  value={posForm.shippingMark}
                  onChange={(e) => setPosForm({ ...posForm, shippingMark: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier Platform</label>
                <select
                  value={posForm.supplierName}
                  onChange={(e) => setPosForm({ ...posForm, supplierName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                >
                  <option value="1688">1688 Factory</option>
                  <option value="Taobao">Taobao</option>
                  <option value="Tmall">Tmall</option>
                  <option value="Alibaba">Alibaba B2B</option>
                  <option value="Pinduoduo">Pinduoduo</option>
                  <option value="Direct Supplier">Direct China Factory</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Product Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cotton Fabrics 500m / Mobile Display Modules"
                  value={posForm.itemDetails}
                  onChange={(e) => setPosForm({ ...posForm, itemDetails: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Financial / RMB Calculations Strip */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-4">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span>Financial &amp; Pricing Computation</span>
                <span className="font-mono text-slate-500">Auto Formula</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={posForm.quantity}
                    onChange={(e) => setPosForm({ ...posForm, quantity: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Unit RMB (¥)</label>
                  <input
                    type="number"
                    step="any"
                    value={posForm.unitPriceRmb}
                    onChange={(e) => setPosForm({ ...posForm, unitPriceRmb: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">RMB Rate (৳)</label>
                  <input
                    type="number"
                    step="any"
                    value={posForm.rmbRateBdt}
                    onChange={(e) => setPosForm({ ...posForm, rmbRateBdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Weight (KG)</label>
                  <input
                    type="number"
                    step="any"
                    value={posForm.cnWeightKg}
                    onChange={(e) => setPosForm({ ...posForm, cnWeightKg: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Freight/KG (৳)</label>
                  <input
                    type="number"
                    step="any"
                    value={posForm.shippingRatePerKgBdt}
                    onChange={(e) => setPosForm({ ...posForm, shippingRatePerKgBdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Live Cost Summary Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Total RMB:</span>
                  <span className="font-mono font-bold text-slate-900">¥{posCalculations.totalRmb.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Purchase Cost (BDT):</span>
                  <span className="font-mono font-bold text-slate-900">৳{posCalculations.purchaseCostBdt.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Freight Bill:</span>
                  <span className="font-mono font-bold text-slate-900">৳{posCalculations.intlFreightBdt.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Total Payable:</span>
                  <span className="font-mono font-bold text-[#EA1D2C]">৳{posCalculations.totalBillBdt.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Advance Payment & Local Delivery */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Advance Paid (BDT)</label>
                <input
                  type="number"
                  step="any"
                  value={posForm.purchaseCostPaidBdt}
                  onChange={(e) => setPosForm({ ...posForm, purchaseCostPaidBdt: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">BD Delivery Courier</label>
                <select
                  value={posForm.bdCourierName}
                  onChange={(e) => setPosForm({ ...posForm, bdCourierName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                >
                  <option value="Steadfast">Steadfast Courier</option>
                  <option value="Pathao">Pathao Courier</option>
                  <option value="RedX">RedX Express</option>
                  <option value="Paperfly">Paperfly</option>
                  <option value="Sundarban">Sundarban Courier</option>
                  <option value="SA Paribahan">SA Paribahan</option>
                  <option value="Office Pickup">GoShipping Warehouse Pickup</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">China Tracking No.</label>
                <input
                  type="text"
                  placeholder="e.g. SF123456789"
                  value={posForm.chinaCourierTracking}
                  onChange={(e) => setPosForm({ ...posForm, chinaCourierTracking: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold transition-none shadow-xs cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? 'Syncing...' : 'Save Order & Sync to Sheet'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: FREIGHT SHIPMENT ONLY FORM */}
        {activeTab === 'freight' && (
          <form onSubmit={handleFreightSubmit} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Customer Account / Client *</label>
                {customers.length > 0 ? (
                  <select
                    value={freightForm.customerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const found = customers.find((c) => c.id === id);
                      setFreightForm({
                        ...freightForm,
                        customerId: id,
                        customerName: found ? found.companyName || found.fullName : '',
                        recipientName: found ? found.fullName : '',
                        recipientPhone: found ? found.phone || '' : '',
                        recipientAddress: found ? found.address || '' : ''
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                  >
                    <option value="">Select registered customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName || c.fullName} ({c.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Textiles Ltd"
                    value={freightForm.customerName}
                    onChange={(e) => setFreightForm({ ...freightForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shipping Mark</label>
                <input
                  type="text"
                  placeholder="e.g. GOSH-AIR-88"
                  value={freightForm.shippingMark}
                  onChange={(e) => setFreightForm({ ...freightForm, shippingMark: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Consignment Mode</label>
                <select
                  value={freightForm.type}
                  onChange={(e) => setFreightForm({ ...freightForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                >
                  <option value="air">Air Express (3-5 Days)</option>
                  <option value="express">Air Standard (7-10 Days)</option>
                  <option value="sea">Sea Cargo (25-35 Days)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Origin Port</label>
                <input
                  type="text"
                  value={freightForm.origin}
                  onChange={(e) => setFreightForm({ ...freightForm, origin: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination City</label>
                <input
                  type="text"
                  value={freightForm.destination}
                  onChange={(e) => setFreightForm({ ...freightForm, destination: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gross Weight (KG) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={freightForm.weight}
                  onChange={(e) => setFreightForm({ ...freightForm, weight: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cartons / Packages</label>
                <input
                  type="number"
                  min="1"
                  value={freightForm.packages}
                  onChange={(e) => setFreightForm({ ...freightForm, packages: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Declared Value (BDT)</label>
                <input
                  type="number"
                  step="any"
                  value={freightForm.declaredValue}
                  onChange={(e) => setFreightForm({ ...freightForm, declaredValue: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>
            </div>

            {/* Recipient Details */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                Consignee Delivery Coordinates (Bangladesh)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Consignee Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Recipient Full Name"
                    value={freightForm.recipientName}
                    onChange={(e) => setFreightForm({ ...freightForm, recipientName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Recipient Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="Recipient WhatsApp / Phone"
                    value={freightForm.recipientPhone}
                    onChange={(e) => setFreightForm({ ...freightForm, recipientPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Delivery Address</label>
                  <input
                    type="text"
                    placeholder="House/Road, Area, District"
                    value={freightForm.recipientAddress}
                    onChange={(e) => setFreightForm({ ...freightForm, recipientAddress: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold transition-none shadow-xs cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? 'Registering...' : 'Register Freight & Generate Tracking'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
