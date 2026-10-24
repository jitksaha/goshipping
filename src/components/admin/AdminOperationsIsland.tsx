import React, { useState, useEffect } from 'react';
import type { ShipmentRecord } from '../../server/services/shipment.service';
import type { QuoteRecord } from '../../server/services/quote.service';

interface TruckVehicle {
  id: string;
  code: string;
  type: 'semitrailer' | 'box_truck' | 'van';
  status: 'Loading' | 'Not started' | 'Completed' | 'Ready';
  weightKg: number;
  capacityPct: number;
  route: string;
  driver: string;
  dock: string;
  loadProgress: number;
}

const INITIAL_TRUCKS: TruckVehicle[] = [
  {
    id: 'trk-01',
    code: 'TRC-204',
    type: 'box_truck',
    status: 'Loading',
    weightKg: 6500,
    capacityPct: 48,
    route: 'DAC → CTG',
    driver: 'Marcus Lee',
    dock: 'Dock #3',
    loadProgress: 48
  },
  {
    id: 'trk-02',
    code: 'TRC-118',
    type: 'box_truck',
    status: 'Not started',
    weightKg: 0,
    capacityPct: 0,
    route: 'DAC → DXB (Air)',
    driver: 'Hannah Cruz',
    dock: 'Dock #1',
    loadProgress: 0
  },
  {
    id: 'trk-03',
    code: 'TRC-551',
    type: 'semitrailer',
    status: 'Completed',
    weightKg: 8870,
    capacityPct: 92,
    route: 'CTG → SIN (Sea)',
    driver: 'Alexi Park',
    dock: 'Dock #7',
    loadProgress: 89
  },
  {
    id: 'trk-04',
    code: 'TRC-392',
    type: 'semitrailer',
    status: 'Ready',
    weightKg: 10000,
    capacityPct: 100,
    route: 'DAC → FRA (Air)',
    driver: 'David Kim',
    dock: 'Dock #5',
    loadProgress: 100
  },
  {
    id: 'trk-05',
    code: 'TRC-405',
    type: 'box_truck',
    status: 'Loading',
    weightKg: 850,
    capacityPct: 12,
    route: 'DAC → LHR',
    driver: 'Marcus Lee',
    dock: 'Dock #2',
    loadProgress: 15
  },
  {
    id: 'trk-06',
    code: 'TRC-622',
    type: 'van',
    status: 'Loading',
    weightKg: 7400,
    capacityPct: 70,
    route: 'CTG → CFS Dep',
    driver: 'Kamal Hossain',
    dock: 'Dock #8',
    loadProgress: 65
  }
];

export default function AdminOperationsIsland({ initialTab = 'warehouses' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [trucks, setTrucks] = useState<TruckVehicle[]>(INITIAL_TRUCKS);
  const [searchTruck, setSearchTruck] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [quickShipmentModal, setQuickShipmentModal] = useState(false);

  // Quick shipment form
  const [customerName, setCustomerName] = useState('Apex Textiles Ltd');
  const [originCity, setOriginCity] = useState('Dhaka');
  const [destCity, setDestCity] = useState('Frankfurt');
  const [mode, setMode] = useState<'air' | 'sea'>('air');
  const [weightKg, setWeightKg] = useState('1250');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Read query param if changed
    const url = new URL(window.location.href);
    const tabParam = url.searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, []);

  const loadData = async () => {
    try {
      const [resShip, resQte] = await Promise.all([
        fetch('/api/shipments').then((r) => r.json()),
        fetch('/api/quotes').then((r) => r.json())
      ]);
      if (resShip.success) setShipments(resShip.shipments);
      if (resQte.success) setQuotes(resQte.quotes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateQuickShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'usr-customer-01',
          customerName,
          originCountry: 'Bangladesh',
          originCity,
          destCountry: 'Germany',
          destCity,
          mode,
          serviceLevel: 'express',
          totalWeightKg: parseFloat(weightKg) || 500,
          totalCbm: (parseFloat(weightKg) || 500) / 167,
          totalPieces: 15
        })
      });

      if (!res.ok) throw new Error('Shipment creation failed');
      const data = await res.json();
      alert(`Master Shipment dispatched! Tracking ID: ${data.shipment.trackingNumber}`);
      setQuickShipmentModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTrucks = trucks.filter((t) => {
    const matchesSearch = t.code.toLowerCase().includes(searchTruck.toLowerCase()) || t.driver.toLowerCase().includes(searchTruck.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top Application Header Bar matching reference image */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-8 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight font-['Manrope',sans-serif]">
            Warehouse operations
          </h1>
        </div>

        {/* Right Header Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors-fast"
          >
            <svg className="w-3.5 h-3.5 stroke-[2] text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            <span>Refresh</span>
          </button>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none flex items-center gap-1.5 pl-3 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors-fast cursor-pointer"
            >
              <option value="all">Filter: All Status</option>
              <option value="Loading">Loading</option>
              <option value="Not started">Not started</option>
              <option value="Completed">Completed</option>
              <option value="Ready">Ready</option>
            </select>
            <svg className="w-3 h-3 absolute right-2.5 top-3 pointer-events-none text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Notification & profile pills */}
          <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors-fast">
            <svg className="w-4 h-4 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors-fast">
            <svg className="w-4 h-4 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {/* Primary Quick Shipment Button in Green (#10B981) matching reference */}
          <button
            onClick={() => setQuickShipmentModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#10B981] text-white text-xs font-bold hover:bg-[#059669] transition-colors-fast shadow-sm"
          >
            <span>+</span>
            <span>Quick shipment</span>
          </button>
        </div>
      </header>

      {/* Scrollable Dashboard Content */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* TOP CARD: Warehouse overview with 4 metrics */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
              Warehouse overview
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Last updated: Today, 14:32 PM</span>
              <button className="text-slate-400 hover:text-slate-600 font-bold px-1">⋮</button>
            </div>
          </div>

          {/* 4 Stat Columns with clean divider lines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-4 sm:gap-0 pt-1">
            {/* Stat 1 */}
            <div className="sm:pr-6 space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <svg className="w-4 h-4 text-slate-400 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                  <path d="M15 18H9" />
                  <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                  <circle cx="17" cy="18" r="2" />
                  <circle cx="7" cy="18" r="2" />
                </svg>
                <span>Trucks inside</span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-['Manrope',sans-serif] tracking-tight tabular-nums">
                12
              </div>
              <p className="text-[11px] text-slate-400">Active status</p>
            </div>

            {/* Stat 2 */}
            <div className="sm:px-6 space-y-1 pt-3 sm:pt-0">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <svg className="w-4 h-4 text-slate-400 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="m7.5 4.27 9 5.15" />
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                </svg>
                <span>Unassigned shipments</span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-['Manrope',sans-serif] tracking-tight tabular-nums">
                48
              </div>
              <p className="text-[11px] text-slate-400">Pending status</p>
            </div>

            {/* Stat 3 */}
            <div className="sm:px-6 space-y-1 pt-3 sm:pt-0">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <svg className="w-4 h-4 text-slate-400 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 2v20" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>Active loading docks</span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-['Manrope',sans-serif] tracking-tight tabular-nums">
                6/10
              </div>
              <p className="text-[11px] text-slate-400">60% total usage</p>
            </div>

            {/* Stat 4 */}
            <div className="sm:pl-6 space-y-1 pt-3 sm:pt-0">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <svg className="w-4 h-4 text-slate-400 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Dispatch ready</span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-['Manrope',sans-serif] tracking-tight tabular-nums">
                04
              </div>
              <p className="text-[11px] text-slate-400">Ready for today</p>
            </div>
          </div>
        </div>

        {/* FLEET / TRUCKS SECTION */}
        <div className="space-y-4">
          {/* Section Controls Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
              Trucks currently in warehouse
            </h2>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={searchTruck}
                  onChange={(e) => setSearchTruck(e.target.value)}
                  placeholder="Search for truck ID"
                  className="h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 w-44 sm:w-56"
                />
                <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none flex items-center gap-1.5 pl-3 pr-7 h-8 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <option value="all">Filter</option>
                  <option value="Loading">Loading</option>
                  <option value="Completed">Completed</option>
                  <option value="Ready">Ready</option>
                  <option value="Not started">Not started</option>
                </select>
                <svg className="w-3 h-3 absolute right-2.5 top-2.5 pointer-events-none text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <svg className="w-3.5 h-3.5 stroke-[2] text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>Grid</span>
              </button>
            </div>
          </div>

          {/* 3-Column Truck Cards Grid matching reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTrucks.map((truck) => {
              // Status badge colors
              const getBadge = (status: TruckVehicle['status']) => {
                switch (status) {
                  case 'Loading':
                    return { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50/70 border-amber-200/60' };
                  case 'Completed':
                    return { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50/70 border-emerald-200/60' };
                  case 'Ready':
                    return { dot: 'bg-sky-500', text: 'text-sky-700', bg: 'bg-sky-50/70 border-sky-200/60' };
                  default:
                    return { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' };
                }
              };

              const badge = getBadge(truck.status);

              return (
                <div
                  key={truck.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow duration-200 flex flex-col justify-between space-y-4"
                >
                  {/* Top Row: Status Pill */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                      {truck.status}
                    </span>
                  </div>

                  {/* Truck Code & Side-view Illustration Container */}
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                        {truck.code}
                      </h3>
                      <span className="text-xs text-slate-500 font-medium tabular-nums font-mono">
                        {truck.weightKg.toLocaleString()} kg • ({truck.capacityPct}%)
                      </span>
                    </div>

                    {/* Clean Side-View Truck Graphic */}
                    <div className="py-2 flex items-center justify-center">
                      <svg viewBox="0 0 280 100" fill="none" className="w-full h-24 max-w-[240px]">
                        {/* Chassis / Wheels */}
                        <rect x="30" y="70" width="220" height="6" rx="2" fill="#334155" />
                        <circle cx="65" cy="78" r="14" fill="#0F172A" />
                        <circle cx="65" cy="78" r="7" fill="#CBD5E1" />
                        <circle cx="215" cy="78" r="14" fill="#0F172A" />
                        <circle cx="215" cy="78" r="7" fill="#CBD5E1" />
                        <circle cx="240" cy="78" r="14" fill="#0F172A" />
                        <circle cx="240" cy="78" r="7" fill="#CBD5E1" />

                        {/* Cab Unit */}
                        <path d="M20 70V45C20 40 25 36 30 36H55L65 52H75V70H20Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" />
                        <path d="M30 40H52L60 52H30V40Z" fill="#0284C7" opacity="0.3" />
                        <rect x="18" y="58" width="6" height="5" rx="1" fill="#F59E0B" />

                        {/* Cargo Container Box */}
                        <rect x="80" y="16" width="180" height="54" rx="3" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
                        {/* Corrugation lines on container */}
                        <line x1="100" y1="20" x2="100" y2="66" stroke="#E2E8F0" strokeWidth="2" />
                        <line x1="120" y1="20" x2="120" y2="66" stroke="#E2E8F0" strokeWidth="2" />
                        <line x1="140" y1="20" x2="140" y2="66" stroke="#E2E8F0" strokeWidth="2" />
                        <line x1="160" y1="20" x2="160" y2="66" stroke="#E2E8F0" strokeWidth="2" />
                        <line x1="180" y1="20" x2="180" y2="66" stroke="#E2E8F0" strokeWidth="2" />
                        <line x1="200" y1="20" x2="200" y2="66" stroke="#E2E8F0" strokeWidth="2" />
                        <line x1="220" y1="20" x2="220" y2="66" stroke="#E2E8F0" strokeWidth="2" />
                        <line x1="240" y1="20" x2="240" y2="66" stroke="#E2E8F0" strokeWidth="2" />

                        {/* Subtle Brand Stencil on Container */}
                        <text x="110" y="47" fontFamily="'Manrope', sans-serif" fontWeight="800" fontSize="11" fill="#94A3B8" letterSpacing="-0.5">/GOSHIPPING</text>
                      </svg>
                    </div>
                  </div>

                  {/* Route & Driver row */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 font-['Manrope',sans-serif]">
                      {truck.route}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {truck.driver} • <strong className="text-slate-700">{truck.dock}</strong>
                    </span>
                  </div>

                  {/* Load Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>Load progress</span>
                      <span className="font-mono tabular-nums text-slate-700 font-bold">{truck.loadProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#10B981] transition-all duration-300"
                        style={{ width: `${truck.loadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RECENT MASTER SHIPMENTS TABLE FOR FULL OPERATIONAL DISPATCH */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                Active Master Airway Bills & Ocean Manifests
              </h2>
              <p className="text-xs text-slate-400">Directly synchronized with carrier integrations and customs</p>
            </div>
            <a href="/admin?tab=shipments" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              View All Master Shipments ({shipments.length}) →
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100 text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Tracking Code</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Weight / Pieces</th>
                  <th className="py-2.5 px-3">Current Waypoint</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors-fast">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{s.trackingNumber}</td>
                    <td className="py-3 px-3 font-medium text-slate-800">{s.customerName}</td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800">{s.originCity}</span> →{' '}
                      <span className="font-semibold text-slate-800">{s.destCity}</span>
                      <span className="text-[10px] font-mono uppercase text-slate-400 ml-1.5">({s.mode})</span>
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-600">
                      {s.totalWeightKg} KG / {s.totalPieces} pcs
                    </td>
                    <td className="py-3 px-3 text-slate-700">{s.currentLocation}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* QUICK SHIPMENT MODAL */}
      {quickShipmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                + Quick Shipment Dispatch
              </h3>
              <button onClick={() => setQuickShipmentModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuickShipment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Origin City</label>
                  <input
                    type="text"
                    value={originCity}
                    onChange={(e) => setOriginCity(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination City</label>
                  <input
                    type="text"
                    value={destCity}
                    onChange={(e) => setDestCity(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shipping Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as any)}
                    className="w-full h-9 px-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="air">Air Cargo (Express)</option>
                    <option value="sea">Ocean Container (FCL)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gross Weight (KG)</label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickShipmentModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-bold"
                >
                  {submitting ? 'Dispatching...' : 'Dispatch Shipment →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
