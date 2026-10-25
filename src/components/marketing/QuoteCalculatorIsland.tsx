import React, { useState } from 'react';
import SearchableLocationSelect from './SearchableLocationSelect';
import {
  ORIGIN_COUNTRIES,
  DEST_COUNTRIES,
  getCitiesForCountry
} from './shippingLocations';

interface Props {
  defaultGuestName?: string;
  defaultGuestEmail?: string;
  defaultGuestPhone?: string;
  initialMode?: 'air' | 'sea';
  onQuoteCreated?: (newQuote: any) => void;
  onViewQuotes?: () => void;
}

export default function QuoteCalculatorIsland({
  defaultGuestName = '',
  defaultGuestEmail = '',
  defaultGuestPhone = '',
  initialMode = 'air',
  onQuoteCreated,
  onViewQuotes
}: Props = {}) {
  const [mode, setMode] = useState<'air' | 'sea'>(initialMode);
  const [originCountry, setOriginCountry] = useState('China');
  const [originCity, setOriginCity] = useState('Guangzhou');
  const [destCountry, setDestCountry] = useState('Bangladesh');
  const [destCity, setDestCity] = useState('Dhaka');
  const [weightKg, setWeightKg] = useState('50');
  const [cbm, setCbm] = useState('0.4');
  const [quantity, setQuantity] = useState('10');
  const [packagingType, setPackagingType] = useState('carton');
  const [cargoDescription, setCargoDescription] = useState('E-commerce Parcels, Garments & Accessories (1688 / Factory)');
  const [guestName, setGuestName] = useState(defaultGuestName);
  const [guestEmail, setGuestEmail] = useState(defaultGuestEmail);
  const [guestPhone, setGuestPhone] = useState(defaultGuestPhone);

  // Dynamic linked location change handlers
  const handleOriginCountryChange = (newCountry: string) => {
    setOriginCountry(newCountry);
    const hubs = getCitiesForCountry(ORIGIN_COUNTRIES, newCountry);
    if (hubs.length > 0) {
      setOriginCity(hubs[0].city);
    }
  };

  const handleDestCountryChange = (newCountry: string) => {
    setDestCountry(newCountry);
    const hubs = getCitiesForCountry(DEST_COUNTRIES, newCountry);
    if (hubs.length > 0) {
      setDestCity(hubs[0].city);
    }
  };

  // Formatted dropdown options
  const originCountryOptions = ORIGIN_COUNTRIES.map((c) => ({
    label: c.country,
    value: c.country,
    code: c.code,
    badge: c.popular ? 'POPULAR' : undefined,
    description: `${c.hubs.length} verified trade hubs & ports`
  }));

  const originCityHubs = getCitiesForCountry(ORIGIN_COUNTRIES, originCountry);
  const originCityOptions = originCityHubs.map((h) => ({
    label: h.city,
    value: h.city,
    code: h.code,
    badge: h.badge,
    description: h.description
  }));

  const destCountryOptions = DEST_COUNTRIES.map((c) => ({
    label: c.country,
    value: c.country,
    code: c.code,
    badge: c.popular ? 'POPULAR' : undefined,
    description: `${c.hubs.length} delivery gateways & EPZs`
  }));

  const destCityHubs = getCitiesForCountry(DEST_COUNTRIES, destCountry);
  const destCityOptions = destCityHubs.map((h) => ({
    label: h.city,
    value: h.city,
    code: h.code,
    badge: h.badge,
    description: h.description
  }));

  const [submitting, setSubmitting] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<{ quoteNumber: string; route: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fast estimate calculation based on market indicative rates in BDT
  const numWeight = parseFloat(weightKg) || 0;
  const numCbm = parseFloat(cbm) || 0;
  // Air chargeable weight is max of gross weight vs volume weight (1 CBM = 167 kg)
  const airVolumetricKg = numCbm * 167;
  const airChargeableKg = Math.max(numWeight, airVolumetricKg);
  // BDT Rates: Air ~৳750/KG + handling ৳2,500; Sea ~৳18,500/CBM + ৳4,500 documentation
  const estimatedAirCost = Math.round(airChargeableKg * 750 + 2500);
  const estimatedSeaCost = Math.round(Math.max(numCbm, 0.5) * 18500 + 4500);

  const currentEstimate = mode === 'air' ? estimatedAirCost : estimatedSeaCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !guestEmail || !guestPhone) {
      setError('Please provide your name, business email and contact phone number.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName,
          guestEmail,
          guestPhone,
          originCountry,
          originCity,
          destCountry,
          destCity,
          mode,
          cargoDescription,
          packagingType,
          quantity: parseInt(quantity) || 1,
          totalWeightKg: numWeight,
          totalCbm: numCbm
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit quote request');
      }

      setSubmittedQuote({
        quoteNumber: data.quote.quoteNumber,
        route: `${originCity} → ${destCity}`
      });

      if (onQuoteCreated) {
        onQuoteCreated(data.quote);
      }

      // Dispatch Lead conversion across GTM, Meta Pixel, TikTok & LinkedIn
      if (typeof window !== 'undefined' && (window as any).goShippingTrack) {
        (window as any).goShippingTrack('Lead', {
          quote_number: data.quote.quoteNumber,
          mode,
          origin: `${originCity}, ${originCountry}`,
          destination: `${destCity}, ${destCountry}`,
          weight_kg: numWeight,
          volume_cbm: numCbm,
          cargo_type: cargoDescription,
          value: currentEstimate,
          currency: 'BDT'
        });
      }
    } catch (err: any) {
      setError(err.message || 'Error creating quotation request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="quote-calculator" className="w-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* ========================================================================= */}
      {/* 01. SOFT RED BRAND HEADER BAR (REPLACED PITCH BLACK)                      */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-red-50/90 via-rose-50/50 to-white text-slate-900 px-5 sm:px-6 py-4 border-b border-red-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-primary)] text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
            Go
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-['Manrope',sans-serif]">
                Ship for Me: Direct Cargo Booking &amp; Consignment Request
              </h3>
              <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded bg-red-100 text-[#EA1D2C] font-bold border border-red-200">
                China ➔ Bangladesh
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Guangzhou &amp; Yiwu China warehouse intake, full customs clearance &amp; Bangladesh door delivery.
            </p>
          </div>
        </div>

        {/* Header Right Status Pill */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-red-200 text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Commercial Cargo Intake Open</span>
          </span>
        </div>
      </div>

      {submittedQuote ? (
        <div className="p-8 sm:p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
            <svg aria-hidden="true" className="w-8 h-8 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white">
            Ship for Me Booking Registered
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Your booking reference is{' '}
            <strong className="text-slate-900 dark:text-white font-mono text-sm px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
              {submittedQuote.quoteNumber}
            </strong>
            . Our operations concierge will assign your unique China warehouse shipping mark and notify your supplier within 2 business hours.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSubmittedQuote(null);
                setGuestName(defaultGuestName);
                setOriginCountry('China');
                setOriginCity('Guangzhou');
                setDestCountry('Bangladesh');
                setDestCity('Dhaka');
              }}
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-none cursor-pointer"
            >
              Book Another Shipment
            </button>
            {onViewQuotes ? (
              <button
                type="button"
                onClick={onViewQuotes}
                className="px-5 py-2.5 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-semibold text-xs transition-none cursor-pointer shadow-xs whitespace-nowrap"
              >
                View in My Quotations
              </button>
            ) : (
              <a
                href="/login"
                className="px-5 py-2.5 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-semibold text-xs transition-none cursor-pointer shadow-xs inline-flex items-center whitespace-nowrap"
              >
                Login to Track Shipment
              </a>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 lg:p-6 bg-slate-50/60 dark:bg-slate-950/40">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 02. MASTER 2-COLUMN COMPACT LAYOUT (Form Left 8 cols, Ledger Right 4 cols) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* --------------------------------------------------------------------- */}
            {/* LEFT COLUMN: Concise Inputs & Route Matrix (8 cols)                   */}
            {/* --------------------------------------------------------------------- */}
            <div className="lg:col-span-8 space-y-4">
              {/* How it Works / Procedure Micro-Callout */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/40 shrink-0">
                    Procedure
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate sm:whitespace-normal leading-tight">
                    Order from 1688, Taobao, or Chinese factory. We assign your unique <strong>Shipping Mark</strong> and deliver to Bangladesh.
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 hidden sm:inline">
                  ✓ Door Delivery Included
                </span>
              </div>

              {/* ================================================================= */}
              {/* STEP 1: TRANSPORT MODE SELECTOR (AIR FLIGHT VS OCEAN VESSEL)       */}
              {/* ================================================================= */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-100 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2 font-['Manrope',sans-serif]">
                    <span className="w-5 h-5 rounded-full bg-[#EA1D2C] text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    <span className="text-sm">Select Shipping Mode (Air vs Sea)</span>
                  </span>
                  <span className="text-[11px] font-bold text-[#EA1D2C] bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-900/60">
                    {mode === 'air' ? '✈️ Air Express Active' : '🚢 Ocean Cargo Active'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Air Express Card */}
                  <button
                    type="button"
                    onClick={() => setMode('air')}
                    className={`p-3.5 rounded-xl text-left transition-none cursor-pointer flex items-start gap-3 border ${
                      mode === 'air'
                        ? 'border-2 border-[#EA1D2C] bg-red-50/70 dark:bg-red-950/30 text-slate-900 dark:text-white ring-1 ring-[#EA1D2C]/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      mode === 'air' ? 'bg-[#EA1D2C] text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      <svg className="w-5 h-5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif]">Air Express (Cargo Flight)</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-[#EA1D2C]">7–14 Days</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Daily direct scheduled air cargo from Guangzhou (CAN) &amp; Shenzhen to Dhaka HSIA. Best for garments, tech &amp; urgent orders.
                      </p>
                    </div>
                  </button>

                  {/* Sea Freight Card */}
                  <button
                    type="button"
                    onClick={() => setMode('sea')}
                    className={`p-3.5 rounded-xl text-left transition-none cursor-pointer flex items-start gap-3 border ${
                      mode === 'sea'
                        ? 'border-2 border-[#EA1D2C] bg-red-50/70 dark:bg-red-950/30 text-slate-900 dark:text-white ring-1 ring-[#EA1D2C]/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      mode === 'sea' ? 'bg-[#EA1D2C] text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      <svg className="w-5 h-5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                        <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
                        <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
                        <line x1="12" y1="1" x2="12" y2="5" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif]">Ocean Cargo (Container)</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">35–45 Days</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Economical LCL consolidation &amp; FCL containers from Ningbo / Yiwu / Guangzhou to Chittagong / Dhaka.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* ================================================================= */}
              {/* STEP 2: SPACIOUS FREIGHT CORRIDOR (ORIGIN & DESTINATION)          */}
              {/* ================================================================= */}
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-red-100 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2 font-['Manrope',sans-serif]">
                    <span className="w-5 h-5 rounded-full bg-[#EA1D2C] text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    <span className="text-sm">Freight Corridor &amp; Gateways</span>
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                    <span>{originCountry} ({originCity})</span>
                    <span className="text-[#EA1D2C]">➔</span>
                    <span>{destCountry} ({destCity})</span>
                  </div>
                </div>

                {/* 2 Spacious Columns for Origin & Destination */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ORIGIN SECTION */}
                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"></span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-['Manrope',sans-serif]">
                          Origin Location (From)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Export Warehouse</span>
                    </div>

                    <div className="space-y-3">
                      <SearchableLocationSelect
                        id="origin-country-select"
                        label="Origin Country"
                        value={originCountry}
                        onChange={handleOriginCountryChange}
                        options={originCountryOptions}
                        placeholder="Select origin country..."
                        searchPlaceholder="Search country (China, Hong Kong, etc)..."
                        allowCustom={true}
                      />

                      <SearchableLocationSelect
                        id="origin-city-select"
                        label="Origin Hub / CFS Warehouse / Port"
                        value={originCity}
                        onChange={(val) => setOriginCity(val)}
                        options={originCityOptions}
                        placeholder="Select origin hub..."
                        searchPlaceholder="Search city, port, or warehouse (Guangzhou, Yiwu)..."
                        allowCustom={true}
                      />
                    </div>
                  </div>

                  {/* DESTINATION SECTION */}
                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EA1D2C] ring-2 ring-red-200 dark:ring-red-900"></span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-['Manrope',sans-serif]">
                          Destination Location (To)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Delivery Depot</span>
                    </div>

                    <div className="space-y-3">
                      <SearchableLocationSelect
                        id="dest-country-select"
                        label="Destination Country"
                        value={destCountry}
                        onChange={handleDestCountryChange}
                        options={destCountryOptions}
                        placeholder="Select destination country..."
                        searchPlaceholder="Search destination country (Bangladesh)..."
                        allowCustom={true}
                      />

                      <SearchableLocationSelect
                        id="dest-city-select"
                        label="Destination Hub / City / Delivery Terminal"
                        value={destCity}
                        onChange={(val) => setDestCity(val)}
                        options={destCityOptions}
                        placeholder="Select delivery station..."
                        searchPlaceholder="Search city, district or airport (Dhaka, Chittagong)..."
                        allowCustom={true}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cargo Dimensions & Specifications */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-[var(--color-brand-primary)] stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                    <span>Cargo Specifications</span>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Volumetric Eq: {airVolumetricKg.toFixed(1)} KG ({numCbm} CBM × 167)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Weight */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Gross Weight
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        required
                        className="w-full h-9 pl-3 pr-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] font-medium text-slate-400 select-none">
                        KG
                      </span>
                    </div>
                  </div>

                  {/* CBM */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Volume
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={cbm}
                        onChange={(e) => setCbm(e.target.value)}
                        required
                        className="w-full h-9 pl-3 pr-11 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] font-medium text-slate-400 select-none">
                        CBM
                      </span>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Pieces Qty
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full h-9 pl-3 pr-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] font-medium text-slate-400 select-none">
                        Pcs
                      </span>
                    </div>
                  </div>

                  {/* Packaging Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Packaging
                    </label>
                    <select
                      value={packagingType}
                      onChange={(e) => setPackagingType(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none cursor-pointer"
                    >
                      <option value="carton">Cartons</option>
                      <option value="pallet">Pallets</option>
                      <option value="crate">Wooden Crates</option>
                      <option value="drum">Steel Drums</option>
                    </select>
                  </div>
                </div>

                {/* Commodity Description & Quick Category Pills */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Commodity or Cargo Description
                    </label>
                    <div className="flex items-center gap-1">
                      {['Garments', 'Fabrics', 'Electronics', 'Machinery'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCargoDescription(`${cat} & Commercial Goods (1688 / Factory)`)}
                          className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-none cursor-pointer"
                        >
                          +{cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={cargoDescription}
                    onChange={(e) => setCargoDescription(e.target.value)}
                    required
                    className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                  />
                </div>
              </div>

              {/* Official Recipient Details */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="text-xs font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  Official Quotation Recipient Details
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Company or Person
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Textiles Ltd"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      placeholder="client@company.com"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      required
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone / WhatsApp
                    </label>
                    <input
                      type="tel"
                      placeholder="+880 1711 000000"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      required
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* --------------------------------------------------------------------- */}
            {/* RIGHT COLUMN: Soft Red Ledger & Consignment Review Card (4 cols)       */}
            {/* --------------------------------------------------------------------- */}
            <div className="lg:col-span-4">
              <div className="sticky top-4 bg-gradient-to-b from-[#FFF5F5] via-rose-50/40 to-white rounded-xl border border-red-200/90 shadow-xs p-5 space-y-4">
                {/* Header Badge */}
                <div className="flex items-center justify-between border-b border-red-100 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EA1D2C]"></span>
                    <span className="text-xs font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Consignment Overview
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-[#EA1D2C] font-bold border border-red-200">
                    Customs Verified
                  </span>
                </div>

                {/* Tariff Assessment Notice (Replaced Estimated Dynamic Pricing) */}
                <div className="p-3.5 rounded-lg bg-white border border-red-100/90 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Tariff &amp; Freight Rates
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Pre-Assessed
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Tariff Assessed by Operations Desk
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Official freight charges and customs duty will be assessed upon cargo intake at our China CFS (Guangzhou / Yiwu) based on actual carton measurements and HS code. An itemized invoice will be dispatched before final shipping.
                  </p>
                </div>

                {/* Itemized Cargo Specifications */}
                <div className="space-y-2.5 py-3 border-y border-red-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Service Mode:</span>
                    <span className="font-semibold text-slate-900">{mode === 'air' ? 'Air Express (7–14d Direct)' : 'Ocean Freight (35–45d FCL/LCL)'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Route Corridor:</span>
                    <span className="font-semibold text-slate-900">{originCity} → {destCity}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Declared Volume:</span>
                    <span className="font-semibold font-mono text-slate-900 tabular-nums">
                      {mode === 'air' ? `${airChargeableKg.toFixed(1)} KG (Equiv)` : `${Math.max(numCbm, 0.5).toFixed(2)} CBM`}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Packages:</span>
                    <span className="font-semibold text-slate-900">
                      {quantity || '1'} {packagingType || 'Cartons'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Transit SLA:</span>
                    <span className="font-semibold text-[#EA1D2C]">{mode === 'air' ? '7–14 Days Transit' : '35–45 Days Transit'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Customs Brokerage:</span>
                    <span className="font-semibold text-emerald-700">Full Brokerage Included</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Doorstep Drop:</span>
                    <span className="font-semibold text-slate-900">Included Across Bangladesh</span>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] active:bg-[#B91C1C] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-none cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <svg aria-hidden="true" className="w-4 h-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                      </svg>
                      <span>Transmitting Booking Request…</span>
                    </>
                  ) : (
                    <span>Submit Ship for Me Request &rarr;</span>
                  )}
                </button>

                {/* Guarantees Matrix */}
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 pt-1 border-t border-red-100">
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>China Hub Mark</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Zero Hidden Levies</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Live Telemetry</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Official Invoice</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
