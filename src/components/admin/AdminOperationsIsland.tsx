import React, { useState, useEffect } from 'react';
import type { ShipmentRecord } from '../../server/services/shipment.service';
import type { QuoteRecord } from '../../server/services/quote.service';
import type { WarehouseRecord } from '../../server/services/warehouse.service';
import type { AuditEntry } from '../../server/services/audit.service';

interface Props {
  initialTab?: string;
}

export default function AdminOperationsIsland({ initialTab = 'overview' }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Form states for creating tracking events
  const [eventShipmentId, setEventShipmentId] = useState('');
  const [eventStatus, setEventStatus] = useState<ShipmentRecord['status']>('in_transit');
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventSubmitting, setEventSubmitting] = useState(false);

  // Form state for pricing a quote
  const [pricingQuoteId, setPricingQuoteId] = useState<string | null>(null);
  const [baseFreight, setBaseFreight] = useState('2200');
  const [fuelSurcharge, setFuelSurcharge] = useState('250');
  const [customsFee, setCustomsFee] = useState('150');
  const [handlingFee, setHandlingFee] = useState('75');
  const [transitDays, setTransitDays] = useState('3-5 days');
  const [pricingSubmitting, setPricingSubmitting] = useState(false);

  // Form state for creating a new master shipment
  const [showCreateShipmentModal, setShowCreateShipmentModal] = useState(false);
  const [newCustName, setNewCustName] = useState('Beximco Export Division');
  const [newOrigCity, setNewOrigCity] = useState('Dhaka');
  const [newDestCity, setNewDestCity] = useState('London');
  const [newMode, setNewMode] = useState<'air' | 'sea'>('air');
  const [newWeight, setNewWeight] = useState('1200');
  const [newCbm, setNewCbm] = useState('6.2');
  const [newPieces, setNewPieces] = useState('50');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [resShipments, resQuotes, resWh, resKpis, resAudit] = await Promise.all([
        fetch('/api/shipments').then((r) => r.json()),
        fetch('/api/quotes').then((r) => r.json()),
        fetch('/api/warehouses').then((r) => r.json()),
        fetch('/api/admin/overview').then((r) => r.json()),
        fetch('/api/admin/audit-logs').then((r) => r.json())
      ]);

      if (resShipments.success) setShipments(resShipments.shipments);
      if (resQuotes.success) setQuotes(resQuotes.quotes);
      if (resWh.success) setWarehouses(resWh.warehouses);
      if (resKpis.success) setKpis(resKpis.kpis);
      if (resAudit.success) setAuditLogs(resAudit.logs);

      if (resShipments.shipments?.[0]) {
        setEventShipmentId(resShipments.shipments[0].trackingNumber);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handlePostEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventShipmentId || !eventTitle || !eventLocation) {
      alert('Please fill out all tracking event fields');
      return;
    }
    setEventSubmitting(true);
    try {
      const res = await fetch('/api/tracking/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: eventShipmentId,
          status: eventStatus,
          title: eventTitle,
          description: eventDesc || 'Verified milestone clearance update.',
          locationName: eventLocation,
          source: 'warehouse'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to post event');
      }

      alert('Verified tracking milestone posted successfully!');
      setEventTitle('');
      setEventDesc('');
      loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEventSubmitting(false);
    }
  };

  const handlePriceQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingQuoteId) return;
    setPricingSubmitting(true);

    try {
      const res = await fetch(`/api/quotes/${pricingQuoteId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseFreightCharge: parseFloat(baseFreight) || 0,
          fuelSurcharge: parseFloat(fuelSurcharge) || 0,
          customsClearanceFee: parseFloat(customsFee) || 0,
          handlingFee: parseFloat(handlingFee) || 0,
          insuranceFee: 0,
          otherFees: 0,
          transitTimeDays: transitDays,
          notes: 'Official rate approved by commercial operations team.'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to price quote');
      }

      alert('Official pricing revision published to customer portal!');
      setPricingQuoteId(null);
      loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPricingSubmitting(false);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'usr-customer-01',
          customerName: newCustName,
          originCountry: 'Bangladesh',
          originCity: newOrigCity,
          destCountry: 'United Kingdom',
          destCity: newDestCity,
          mode: newMode,
          serviceLevel: 'standard',
          totalWeightKg: parseFloat(newWeight) || 100,
          totalCbm: parseFloat(newCbm) || 1,
          totalPieces: parseInt(newPieces) || 10
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error creating shipment');
      }

      const data = await res.json();
      alert(`Master shipment created with Tracking Number: ${data.shipment.trackingNumber}`);
      setShowCreateShipmentModal(false);
      loadAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Nav Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-px text-xs font-bold">
        {[
          { key: 'overview', label: 'Operations Overview' },
          { key: 'shipments', label: `Shipment Management (${shipments.length})` },
          { key: 'events', label: 'Log Tracking Event' },
          { key: 'quotes', label: `Quote Review & Pricing (${quotes.length})` },
          { key: 'warehouses', label: `Warehouses (${warehouses.length})` },
          { key: 'audit', label: `Audit Log (${auditLogs.length})` }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setTab(item.key);
              const url = new URL(window.location.href);
              url.searchParams.set('tab', item.key);
              window.history.pushState({}, '', url.toString());
            }}
            className={`px-4 py-2.5 rounded-t-lg transition-colors-fast whitespace-nowrap ${
              tab === item.key
                ? 'bg-white border-t-2 border-x border-slate-200 border-t-[#EA1D2C] text-[#EA1D2C]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & KPIs */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Consignments</span>
              <p className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">{kpis.activeShipments || shipments.length}</p>
              <span className="text-[11px] text-emerald-600 font-medium">98.4% On-time dispatch</span>
            </div>
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Quotes Queue</span>
              <p className="text-3xl font-extrabold text-[#EA1D2C] mt-2 tabular-nums">{kpis.pendingQuotes || 1}</p>
              <span className="text-[11px] text-amber-600 font-medium">Awaiting tariff calculation</span>
            </div>
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Customs Clearance Queue</span>
              <p className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">{kpis.customsHold || 1}</p>
              <span className="text-[11px] text-slate-500 font-medium">HSIA & Chittagong Point</span>
            </div>
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Warehouse Capacity</span>
              <p className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">{kpis.averageWarehouseCapacity || '70.7%'}</p>
              <span className="text-[11px] text-slate-500 font-medium">Dhaka, CTG, DXB, CAN</span>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Rapid Operations Dispatch</h4>
              <p className="text-xs text-slate-500">Create new master airway bill or log real-time checkpoint events</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateShipmentModal(true)}
                className="px-4 py-2 rounded-lg bg-[#EA1D2C] text-white text-xs font-bold hover:bg-[#D41523] transition-colors-fast"
              >
                + New Master Shipment
              </button>
              <button
                onClick={() => setTab('events')}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors-fast"
              >
                + Log Milestone Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Shipment Management */}
      {tab === 'shipments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Master Consignment Roster</h3>
              <p className="text-xs text-slate-500">All registered shipments across air, sea and multimodal routes</p>
            </div>
            <button
              onClick={() => setShowCreateShipmentModal(true)}
              className="px-4 py-2 rounded-lg bg-[#EA1D2C] text-white text-xs font-bold hover:bg-[#D41523] transition-colors-fast"
            >
              + Create Shipment
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tracking Code</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Carrier / AWB</th>
                  <th className="py-3 px-4">Gross Weight</th>
                  <th className="py-3 px-4">Current Waypoint</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors-fast">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.trackingNumber}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{s.customerName}</td>
                    <td className="py-3.5 px-4">
                      {s.originCity} → {s.destCity} <span className="uppercase text-[10px] text-slate-400 font-mono">({s.mode})</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {s.carrierWaybillNumber || s.carrierName}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums">{s.totalWeightKg} KG</td>
                    <td className="py-3.5 px-4 text-slate-700">{s.currentLocation}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setEventShipmentId(s.trackingNumber);
                          setTab('events');
                        }}
                        className="px-2.5 py-1 rounded bg-[#F8E9EB] text-[#EA1D2C] font-bold hover:bg-[#EA1D2C] hover:text-white transition-colors-fast"
                      >
                        + Event
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Log Milestone Tracking Event */}
      {tab === 'events' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 max-w-2xl space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Record Official Tracking Event</h3>
            <p className="text-xs text-slate-500">
              Updates recorded here immediately sync to the customer tracking timeline and public tracking endpoints.
            </p>
          </div>

          <form onSubmit={handlePostEvent} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Shipment</label>
              <select
                value={eventShipmentId}
                onChange={(e) => setEventShipmentId(e.target.value)}
                required
                className="w-full h-10 px-3 rounded border border-slate-300 bg-white font-mono"
              >
                {shipments.map((s) => (
                  <option key={s.id} value={s.trackingNumber}>
                    {s.trackingNumber} — {s.customerName} ({s.originCity} → {s.destCity})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Operational Status Stage</label>
              <select
                value={eventStatus}
                onChange={(e) => setEventStatus(e.target.value as any)}
                className="w-full h-10 px-3 rounded border border-slate-300 bg-white"
              >
                <option value="warehouse_received">Warehouse Received & Inspected</option>
                <option value="in_transit">In Transit (Air / Ocean / Feeder)</option>
                <option value="customs_clearance">Customs Clearance (Export / Import)</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered & POD Signed</option>
                <option value="exception">Operational Exception / Hold</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Milestone Title</label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="e.g. Cleared Export Customs at Dhaka HSIA Gateway"
                required
                className="w-full h-10 px-3 rounded border border-slate-300 text-sm focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Milestone Location Name</label>
              <input
                type="text"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="e.g. Dubai Cargo Terminal (DXB)"
                required
                className="w-full h-10 px-3 rounded border border-slate-300 text-sm focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Detailed Operational Log</label>
              <textarea
                rows={3}
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                placeholder="Container transshipped to feeder vessel / Flight departure confirmed..."
                className="w-full p-3 rounded border border-slate-300 text-sm focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={eventSubmitting}
              className="w-full h-11 rounded-lg bg-[#EA1D2C] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#D41523] active:bg-[#B7101C] transition-colors-fast disabled:opacity-50"
            >
              {eventSubmitting ? 'Recording Event...' : 'Publish Verified Milestone Event →'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Quotes Review & Pricing */}
      {tab === 'quotes' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-base">Inbound Customer Quotations</h3>
            <p className="text-xs text-slate-500">Inspect cargo requirements, calculate freight tariffs, and publish quotes</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Quote No</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Weight / Volume</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors-fast">
                    <td className="py-4 px-4 font-mono font-bold text-slate-900">{q.quoteNumber}</td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{q.guestName}</div>
                      <div className="text-[11px] text-slate-400">{q.guestEmail}</div>
                    </td>
                    <td className="py-4 px-4">
                      {q.originCity} → {q.destCity} <span className="uppercase text-[10px] text-slate-400 font-mono">({q.mode})</span>
                    </td>
                    <td className="py-4 px-4 font-mono tabular-nums">
                      {q.totalWeightKg} KG / {q.totalCbm} CBM
                    </td>
                    <td className="py-4 px-4 max-w-xs truncate text-slate-600">{q.cargoDescription}</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                        {q.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => {
                          setPricingQuoteId(q.id);
                        }}
                        className="px-3 py-1.5 rounded bg-[#EA1D2C] text-white font-bold hover:bg-[#D41523] transition-colors-fast"
                      >
                        Price & Publish →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      {pricingQuoteId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-base">Calculate Commercial Tariff</h4>
              <button onClick={() => setPricingQuoteId(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handlePriceQuote} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Base Freight Charge ($ USD)</label>
                <input
                  type="number"
                  value={baseFreight}
                  onChange={(e) => setBaseFreight(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded border border-slate-300 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bunker / Fuel Surcharge ($ USD)</label>
                <input
                  type="number"
                  value={fuelSurcharge}
                  onChange={(e) => setFuelSurcharge(e.target.value)}
                  className="w-full h-9 px-3 rounded border border-slate-300 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customs Clearance Fee ($ USD)</label>
                <input
                  type="number"
                  value={customsFee}
                  onChange={(e) => setCustomsFee(e.target.value)}
                  className="w-full h-9 px-3 rounded border border-slate-300 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">CFS / Terminal Handling ($ USD)</label>
                <input
                  type="number"
                  value={handlingFee}
                  onChange={(e) => setHandlingFee(e.target.value)}
                  className="w-full h-9 px-3 rounded border border-slate-300 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estimated Transit Time</label>
                <input
                  type="text"
                  value={transitDays}
                  onChange={(e) => setTransitDays(e.target.value)}
                  placeholder="e.g. 3-5 business days"
                  className="w-full h-9 px-3 rounded border border-slate-300"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPricingQuoteId(null)}
                  className="px-3 py-2 rounded border border-slate-300 font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pricingSubmitting}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {pricingSubmitting ? 'Publishing...' : 'Approve & Send Quote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 5: Warehouses */}
      {tab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map((wh) => (
            <div key={wh.id} className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                    {wh.code}
                  </span>
                  <h4 className="font-bold text-slate-900 text-base mt-1">{wh.name}</h4>
                  <p className="text-xs text-slate-500">{wh.city}, {wh.country}</p>
                </div>
                <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {wh.currentOccupancyPct}% Used
                </span>
              </div>
              <p className="text-xs text-slate-600">{wh.address}</p>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                <span>Manager: {wh.contactPerson}</span>
                <span>{wh.phone}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 6: Audit Logs */}
      {tab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-base">Immutable Security & Operations Audit Trail</h3>
            <p className="text-xs text-slate-500">Every sensitive admin action, pricing change, and status update is logged with caller IP</p>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{log.action}</span>
                    <span className="text-slate-400">by</span>
                    <span className="font-semibold text-slate-800">{log.userName || 'System'}</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Target: {log.entityType} ({log.entityId}) · IP: {log.ipAddress || 'Internal'}
                  </p>
                </div>
                <time className="text-slate-400 font-mono text-[11px] tabular-nums whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create Master Shipment */}
      {showCreateShipmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-base">Create Master Shipment Booking</h4>
              <button onClick={() => setShowCreateShipmentModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer / Shipper Name</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Origin City</label>
                  <input
                    type="text"
                    value={newOrigCity}
                    onChange={(e) => setNewOrigCity(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination City</label>
                  <input
                    type="text"
                    value={newDestCity}
                    onChange={(e) => setNewDestCity(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mode</label>
                  <select
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as any)}
                    className="w-full h-9 px-2 rounded border border-slate-300 bg-white"
                  >
                    <option value="air">Air Freight</option>
                    <option value="sea">Ocean Cargo</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Weight (KG)</label>
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    required
                    className="w-full h-9 px-2 rounded border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total CBM</label>
                  <input
                    type="number"
                    value={newCbm}
                    onChange={(e) => setNewCbm(e.target.value)}
                    required
                    className="w-full h-9 px-2 rounded border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateShipmentModal(false)}
                  className="px-3 py-2 rounded border border-slate-300 font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold"
                >
                  Create Master Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
