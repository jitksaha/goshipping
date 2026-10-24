import React, { useState, useEffect } from 'react';
import LiveTrackingIsland from '../marketing/LiveTrackingIsland';
import QuoteCalculatorIsland from '../marketing/QuoteCalculatorIsland';
import type { ShipmentRecord } from '../../server/services/shipment.service';
import type { QuoteRecord } from '../../server/services/quote.service';

interface Props {
  initialTab?: string;
  userEmail?: string;
}

export default function CustomerDashboardIsland({ initialTab = 'overview', userEmail = '' }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRecord | null>(null);
  const [selectedTrackingCode, setSelectedTrackingCode] = useState<string>('GOSH-2026-9812');
  const [loading, setLoading] = useState(true);

  // Sync tab with URL if changed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab && urlTab !== tab) {
      setTab(urlTab);
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resShipments, resQuotes] = await Promise.all([
        fetch('/api/shipments').then((r) => r.json()),
        fetch('/api/quotes').then((r) => r.json())
      ]);

      if (resShipments.success) setShipments(resShipments.shipments);
      if (resQuotes.success) setQuotes(resQuotes.quotes);
    } catch (err) {
      console.error('Error fetching dashboard records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeShipments = shipments.filter((s) => s.status !== 'delivered');
  const pendingQuotes = quotes.filter((q) => q.status === 'submitted' || q.status === 'under_review');
  const pricedQuotes = quotes.filter((q) => q.status === 'priced');

  return (
    <div className="space-y-6">
      {/* Tab Navigation Ribbon */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-px text-xs font-bold">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'shipments', label: `My Shipments (${shipments.length})` },
          { key: 'tracking', label: 'Live Tracking' },
          { key: 'quotes', label: `My Quotations (${quotes.length})` },
          { key: 'request-quote', label: '+ Request Quote' },
          { key: 'documents', label: 'Documents & Invoices' },
          { key: 'settings', label: 'Profile & Settings' }
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

      {/* Tab 1: Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Shipments</span>
              <p className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">{activeShipments.length}</p>
              <span className="text-[11px] text-emerald-600 font-medium">In-Transit & Customs nodes</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Priced Quotations</span>
              <p className="text-3xl font-extrabold text-[#EA1D2C] mt-2 tabular-nums">{pricedQuotes.length}</p>
              <span className="text-[11px] text-slate-500 font-medium">Ready for approval</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Review</span>
              <p className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">{pendingQuotes.length}</p>
              <span className="text-[11px] text-amber-600 font-medium">Airline/carrier scheduling</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Corporate Credit</span>
              <p className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">$50,000</p>
              <span className="text-[11px] text-slate-500 font-medium">Net-30 Commercial Terms</span>
            </div>
          </div>

          {/* Active Shipments Quick Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Active In-Flight Consignments</h3>
                <p className="text-xs text-slate-500">Consignments currently being handled across our global network</p>
              </div>
              <button
                onClick={() => setTab('shipments')}
                className="text-xs font-semibold text-[#EA1D2C] hover:underline"
              >
                View All ({shipments.length}) →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tracking Code</th>
                    <th className="py-3 px-4">Origin / Dest</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Gross Weight</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shipments.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors-fast">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.trackingNumber}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{s.originCity}</span> →{' '}
                        <span className="font-semibold text-slate-800">{s.destCity}</span>
                      </td>
                      <td className="py-3.5 px-4 uppercase font-mono">{s.mode}</td>
                      <td className="py-3.5 px-4 font-mono tabular-nums">{s.totalWeightKg} KG</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => {
                            setSelectedTrackingCode(s.trackingNumber);
                            setTab('tracking');
                          }}
                          className="px-2.5 py-1 rounded bg-[#F8E9EB] text-[#EA1D2C] font-bold hover:bg-[#EA1D2C] hover:text-white transition-colors-fast"
                        >
                          Track →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: My Shipments */}
      {tab === 'shipments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Consignment Registry</h3>
              <p className="text-xs text-slate-500">Complete record of historical and live shipments</p>
            </div>
            <button
              onClick={() => setTab('request-quote')}
              className="px-4 py-2 rounded-lg bg-[#EA1D2C] text-white text-xs font-bold hover:bg-[#D41523] transition-colors-fast"
            >
              + Create New Booking
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tracking Code</th>
                  <th className="py-3 px-4">Consignment Route</th>
                  <th className="py-3 px-4">Mode & Service</th>
                  <th className="py-3 px-4">Weight & Volume</th>
                  <th className="py-3 px-4">Current Waypoint</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors-fast">
                    <td className="py-4 px-4 font-mono font-bold text-slate-900">{s.trackingNumber}</td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">
                        {s.originCity}, {s.originCountry}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        ↓ to {s.destCity}, {s.destCountry}
                      </div>
                    </td>
                    <td className="py-4 px-4 uppercase font-mono">
                      {s.mode} · <span className="text-slate-500">{s.serviceLevel}</span>
                    </td>
                    <td className="py-4 px-4 font-mono tabular-nums">
                      {s.totalWeightKg} KG <span className="text-slate-400">/ {s.totalCbm} CBM</span>
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-700">{s.currentLocation}</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedTrackingCode(s.trackingNumber);
                          setTab('tracking');
                        }}
                        className="px-3 py-1.5 rounded bg-[#F8E9EB] text-[#EA1D2C] font-bold hover:bg-[#EA1D2C] hover:text-white transition-colors-fast"
                      >
                        Live Tracking
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Live Tracking */}
      {tab === 'tracking' && (
        <div className="space-y-4">
          <LiveTrackingIsland initialTrackingNumber={selectedTrackingCode} pollIntervalMs={20000} />
        </div>
      )}

      {/* Tab 4: My Quotations */}
      {tab === 'quotes' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Quotation Inquiries & Revisions</h3>
              <p className="text-xs text-slate-500">Track pricing proposals submitted by our commercial team</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Quote No</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Cargo Description</th>
                  <th className="py-3 px-4">Weight</th>
                  <th className="py-3 px-4">Priced Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((q) => {
                  const latestRev = q.revisions?.[0];
                  return (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors-fast">
                      <td className="py-4 px-4 font-mono font-bold text-slate-900">{q.quoteNumber}</td>
                      <td className="py-4 px-4 font-semibold text-slate-800">
                        {q.originCity} → {q.destCity}
                      </td>
                      <td className="py-4 px-4 max-w-xs truncate text-slate-600">{q.cargoDescription}</td>
                      <td className="py-4 px-4 font-mono tabular-nums">{q.totalWeightKg} KG</td>
                      <td className="py-4 px-4 font-mono font-bold text-slate-900">
                        {latestRev ? `$${latestRev.totalAmount.toLocaleString()} USD` : 'Pending Pricing'}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                          {q.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {latestRev ? (
                          <button
                            onClick={() => setSelectedQuote(q)}
                            className="px-3 py-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold hover:bg-emerald-600 hover:text-white transition-colors-fast"
                          >
                            View Rate Breakdown
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">In Review</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quote Rate Breakdown Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Itemized Quotation
                </span>
                <h4 className="text-xl font-mono font-bold text-slate-900">{selectedQuote.quoteNumber}</h4>
                <p className="text-xs text-slate-500">
                  {selectedQuote.originCity} → {selectedQuote.destCity} ({selectedQuote.mode.toUpperCase()})
                </p>
              </div>
              <button
                onClick={() => setSelectedQuote(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {selectedQuote.revisions?.[0] && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Base Freight Charge:</span>
                  <span className="font-mono font-semibold">${selectedQuote.revisions[0].baseFreightCharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Bunker / Fuel Surcharge:</span>
                  <span className="font-mono font-semibold">${selectedQuote.revisions[0].fuelSurcharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Customs Clearance & Documentation:</span>
                  <span className="font-mono font-semibold">${selectedQuote.revisions[0].customsClearanceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Terminal Handling & CFS:</span>
                  <span className="font-mono font-semibold">${selectedQuote.revisions[0].handlingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Cargo Transit Insurance:</span>
                  <span className="font-mono font-semibold">${selectedQuote.revisions[0].insuranceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
                  <span>Total All-Inclusive Quotation:</span>
                  <span className="font-mono text-base text-[#EA1D2C]">
                    ${selectedQuote.revisions[0].totalAmount.toFixed(2)} USD
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 italic bg-slate-50 p-3 rounded">
                  Notes: {selectedQuote.revisions[0].notes || 'Subject to airline/vessel space availability.'}
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setSelectedQuote(null)}
                className="px-4 py-2 rounded border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  alert('Quotation accepted! Converting into confirmed master booking.');
                  await fetch(`/api/quotes/${selectedQuote.id}/convert`, { method: 'POST' });
                  setSelectedQuote(null);
                  loadData();
                }}
                className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors-fast"
              >
                Accept & Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Request Quote Wizard */}
      {tab === 'request-quote' && (
        <div>
          <QuoteCalculatorIsland />
        </div>
      )}

      {/* Tab 6: Documents & Invoices */}
      {tab === 'documents' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Protected Document Vault</h3>
          <p className="text-xs text-slate-500">
            End-to-end encrypted invoices, Master Airway Bills (MAWB), and authenticated Customs Clearance documents.
          </p>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Airway Bill EK-176-92819382.pdf</p>
                <p className="text-slate-400">Shipment: GOSH-2026-9812 · Signed by Emirates SkyCargo · 1.4 MB</p>
              </div>
              <button
                onClick={() => alert('Downloading official encrypted PDF documentation...')}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
              >
                Download PDF
              </button>
            </div>
            <div className="py-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Commercial Tax Invoice INV-2026-1082.pdf</p>
                <p className="text-slate-400">Total: $2,700.00 USD · Apex Textiles Ltd · 450 KB</p>
              </div>
              <button
                onClick={() => alert('Downloading official encrypted PDF documentation...')}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Profile & Settings */}
      {tab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl space-y-6">
          <h3 className="font-bold text-slate-900 text-base">Company & Security Settings</h3>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Registered Name</label>
              <input
                type="text"
                disabled
                defaultValue="Apex Textiles Ltd"
                className="w-full h-10 px-3 rounded border border-slate-200 bg-slate-50 font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tax ID / BIN</label>
              <input
                type="text"
                disabled
                defaultValue="002918291-0102"
                className="w-full h-10 px-3 rounded border border-slate-200 bg-slate-50 font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Registered Billing Address</label>
              <textarea
                rows={2}
                disabled
                defaultValue="Export Processing Zone, Savar, Dhaka 1349, Bangladesh"
                className="w-full p-3 rounded border border-slate-200 bg-slate-50 text-slate-800"
              ></textarea>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Primary Operations Contact</label>
              <input
                type="text"
                disabled
                defaultValue="client@apextextiles.com (+880 1711 000000)"
                className="w-full h-10 px-3 rounded border border-slate-200 bg-slate-50 font-medium text-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
