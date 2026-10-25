import React, { useState } from 'react';
import SearchableLocationSelect from './SearchableLocationSelect';
import QuoteFaqSection from './QuoteFaqSection';
import {
  ORIGIN_COUNTRIES,
  CHINA_ORIGIN_HUB,
  DEST_DELIVERY_HUBS,
  DEST_PICKUP_HUBS,
  DEST_COUNTRIES,
  getCitiesForCountry
} from './shippingLocations';

interface Props {
  defaultGuestName?: string;
  defaultGuestEmail?: string;
  defaultGuestPhone?: string;
  initialMode?: 'air' | 'sea' | 'hand_carry';
  showFaq?: boolean;
  onQuoteCreated?: (newQuote: any) => void;
  onViewQuotes?: () => void;
}

export default function QuoteCalculatorIsland({
  defaultGuestName = '',
  defaultGuestEmail = '',
  defaultGuestPhone = '',
  initialMode = 'air',
  showFaq = true,
  onQuoteCreated,
  onViewQuotes
}: Props = {}) {
  const [mode, setMode] = useState<'air' | 'sea' | 'hand_carry'>(initialMode);
  const [originCountry, setOriginCountry] = useState('China');
  const [originCity, setOriginCity] = useState('Guangzhou');
  const [destCountry, setDestCountry] = useState('Bangladesh');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [destCity, setDestCity] = useState('Dhaka');
  const [destAddress, setDestAddress] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [weightKg, setWeightKg] = useState('50');
  const [cbm, setCbm] = useState('0.4');
  const [quantity, setQuantity] = useState('10');
  const [packagingType, setPackagingType] = useState('carton');
  const [cargoDescription, setCargoDescription] = useState('E-commerce Parcels, Garments & Accessories (1688 / Factory)');
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('Garments, Apparel & Fashion Wear');
  const [productUrl, setProductUrl] = useState('');
  const [productImages, setProductImages] = useState<{ id: string; name: string; url: string; size: string }[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState(defaultGuestName);
  const [guestEmail, setGuestEmail] = useState(defaultGuestEmail);
  const [guestPhone, setGuestPhone] = useState(defaultGuestPhone);

  const handleFulfillmentChange = (type: 'delivery' | 'pickup') => {
    setFulfillmentType(type);
    if (destCity !== 'Dhaka' && destCity !== 'Chittagong') {
      setDestCity('Dhaka');
    }
  };

  const destDeliveryOptions = DEST_DELIVERY_HUBS.map((h) => ({
    label: h.city,
    value: h.city,
    code: h.code,
    badge: h.badge,
    description: h.description
  }));

  const destPickupOptions = DEST_PICKUP_HUBS.map((h) => ({
    label: h.city,
    value: h.city,
    code: h.code,
    badge: h.badge,
    description: h.description
  }));

  const [submitting, setSubmitting] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<{ quoteNumber: string; route: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Live Calendar Arrival Estimator
  const calculateArrivalDates = (daysMin: number, daysMax: number) => {
    const now = new Date();
    const minD = new Date(now.getTime() + daysMin * 24 * 60 * 60 * 1000);
    const maxD = new Date(now.getTime() + daysMax * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(minD)} – ${fmt(maxD)}`;
  };

  const airDates = calculateArrivalDates(7, 14);
  const seaDates = calculateArrivalDates(30, 45);
  const handCarryDates = calculateArrivalDates(1, 2);

  const currentSla = mode === 'air' ? '7–14 Days' : mode === 'sea' ? '30–45 Days' : '24–48 Hours';
  const currentArrivalRange = mode === 'air' ? airDates : mode === 'sea' ? seaDates : handCarryDates;

  const numWeight = parseFloat(weightKg) || 0;
  const numCbm = parseFloat(cbm) || 0;
  const airVolumetricKg = numCbm * 167;
  const airChargeableKg = Math.max(numWeight, airVolumetricKg);

  const estimatedAirCost = Math.round(airChargeableKg * 750 + 2500);
  const estimatedSeaCost = Math.round(Math.max(numCbm, 0.5) * 18500 + 4500);

  const PRODUCT_CATEGORIES = [
    'Garments, Apparel & Fashion Wear',
    'Fabrics, Textiles, Yarn & Accessories',
    'Electronics, Smart Gadgets & Mobile Accessories',
    'Machinery, Industrial Equipment & Spare Parts',
    'Footwear, Bags & Leather Goods',
    'Beauty, Cosmetics & Personal Care',
    'Home, Kitchenware & Plastic Items',
    'Toys, Baby Care & Stationery',
    'Automotive & Motorcycle Spare Parts',
    'Hardware, Electrical Tools & Lighting',
    'General Commercial Cargo / Other'
  ];

  const handleImageFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImageError(null);

    const maxFiles = 5;
    if (productImages.length + files.length > maxFiles) {
      setImageError(`You can attach up to ${maxFiles} product photos.`);
      return;
    }

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setImageError('Please select valid image files (JPG, PNG, WEBP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setImageError(`Image "${file.name}" exceeds 5MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setProductImages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              url: result,
              size: `${(file.size / 1024).toFixed(0)} KB`
            }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeProductImage = (id: string) => {
    setProductImages((prev) => prev.filter((img) => img.id !== id));
  };

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
      const serviceType = fulfillmentType === 'delivery' ? 'door_to_door' : 'port_to_port';
      const cargoDescParts = [
        productName.trim() ? `Product: ${productName.trim()}` : '',
        productCategory ? `Category: ${productCategory}` : '',
        productUrl.trim() ? `URL: ${productUrl.trim()}` : '',
        cargoDescription.trim(),
        destAddress.trim()
          ? `[Fulfillment: ${fulfillmentType === 'delivery' ? 'Doorstep Delivery' : 'Hub Self-Pickup'}, Delivery Address: ${destAddress.trim()}]`
          : `[Fulfillment: ${fulfillmentType === 'delivery' ? 'Doorstep Delivery' : 'Hub Self-Pickup'}]`
      ].filter(Boolean).join(' | ');

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
          serviceType,
          productName: productName.trim() || undefined,
          productCategory,
          productUrl: productUrl.trim() || undefined,
          productImages: productImages.map((img) => img.url),
          cargoDescription: cargoDescParts,
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
        route: `${originCity} → ${destCity} (${fulfillmentType === 'delivery' ? 'Doorstep Delivery' : 'Hub Pickup'})`
      });

      if (onQuoteCreated) {
        onQuoteCreated(data.quote);
      }

      if (typeof window !== 'undefined' && (window as any).goShippingTrack) {
        (window as any).goShippingTrack('Lead', {
          quote_number: data.quote.quoteNumber,
          mode,
          origin: `${originCity}, China (${CHINA_ORIGIN_HUB.address})`,
          destination: `${destCity}, Bangladesh (${fulfillmentType === 'delivery' ? 'Doorstep Delivery' : 'Hub Pickup'})`,
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
    <div id="quote-calculator" className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* 01. Brand Header */}
      <div className="bg-gradient-to-r from-red-50/90 via-rose-50/50 to-white text-slate-900 px-5 sm:px-6 py-4 border-b border-red-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-primary)] text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
            Go
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-['Manrope',sans-serif]">
                Ship for Me: Book Your Shipping Order
              </h3>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-100 text-[#EA1D2C] font-bold border border-red-200">
                <span>China</span>
                <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span>Bangladesh</span>
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Guangzhou &amp; Yiwu China warehouse intake, full customs clearance &amp; Bangladesh door delivery.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-red-200 text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Accepting New Orders</span>
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
            Your Shipping Request Has Been Received
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
                setFulfillmentType('delivery');
                setDestCity('Dhaka');
                setDestAddress('');
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

          {/* Master 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-8 space-y-4">
              {/* Procedure Micro-Bar */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/40 shrink-0">
                    How it works
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate sm:whitespace-normal leading-tight">
                    Order from 1688, Taobao, or Chinese factory. We assign your unique <strong>Shipping Mark</strong> and deliver to Bangladesh.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 hidden sm:inline-flex">
                  <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Door Delivery Included</span>
                </span>
              </div>

              {/* STEP 1: TRANSPORT MODE SELECTOR */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-100 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2 font-['Manrope',sans-serif]">
                    <span className="w-5 h-5 rounded-full bg-[#EA1D2C] text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    <span className="text-sm">Ship by</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#EA1D2C] bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-900/60 font-mono">
                    {mode === 'air' ? (
                      <>
                        <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
                        </svg>
                        <span>Air · Est: {airDates}</span>
                      </>
                    ) : mode === 'sea' ? (
                      <>
                        <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                          <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
                          <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
                          <line x1="12" y1="1" x2="12" y2="5" />
                        </svg>
                        <span>Sea · Est: {seaDates}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>P2P Hand carry · Est: {handCarryDates}</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Air Card */}
                  <button
                    type="button"
                    onClick={() => setMode('air')}
                    className={`p-3.5 rounded-xl text-left transition-none cursor-pointer flex flex-col justify-between border ${
                      mode === 'air'
                        ? 'border-2 border-[#EA1D2C] bg-red-50/70 dark:bg-red-950/30 text-slate-900 dark:text-white ring-1 ring-[#EA1D2C]/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          mode === 'air' ? 'bg-[#EA1D2C] text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          <svg className="w-5 h-5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
                          </svg>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-[#EA1D2C]">7–14 Days</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif] block">
                        Air
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Scheduled air cargo flight from Guangzhou to Dhaka.
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Est. Arrival:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-[10.5px]">{airDates}</span>
                    </div>
                  </button>

                  {/* Sea Card */}
                  <button
                    type="button"
                    onClick={() => setMode('sea')}
                    className={`p-3.5 rounded-xl text-left transition-none cursor-pointer flex flex-col justify-between border ${
                      mode === 'sea'
                        ? 'border-2 border-[#EA1D2C] bg-red-50/70 dark:bg-red-950/30 text-slate-900 dark:text-white ring-1 ring-[#EA1D2C]/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          mode === 'sea' ? 'bg-[#EA1D2C] text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          <svg className="w-5 h-5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                            <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
                            <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
                            <line x1="12" y1="1" x2="12" y2="5" />
                          </svg>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">30–45 Days</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif] block">
                        Sea
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Economical ocean container freight to Chittagong / Dhaka.
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Est. Arrival:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-[10.5px]">{seaDates}</span>
                    </div>
                  </button>

                  {/* P2P Transfer (Hand carry) Card */}
                  <button
                    type="button"
                    onClick={() => setMode('hand_carry')}
                    className={`p-3.5 rounded-xl text-left transition-none cursor-pointer flex flex-col justify-between border ${
                      mode === 'hand_carry'
                        ? 'border-2 border-[#EA1D2C] bg-red-50/70 dark:bg-red-950/30 text-slate-900 dark:text-white ring-1 ring-[#EA1D2C]/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          mode === 'hand_carry' ? 'bg-[#EA1D2C] text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          <svg className="w-5 h-5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">24–48 Hours</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif] block">
                          P2P Transfer
                        </span>
                        <span className="text-[10px] font-medium text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60">
                          Hand carry
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Fast person-to-person transfer via verified flight couriers &amp; agent hubs.
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Est. Arrival:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-[10.5px]">{handCarryDates}</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* STEP 2: SHIPPING ROUTE & WAREHOUSES */}
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-red-100 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2 font-['Manrope',sans-serif]">
                    <span className="w-5 h-5 rounded-full bg-[#EA1D2C] text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    <span className="text-sm">Shipping Route &amp; Warehouses</span>
                  </span>
                  <div className="inline-flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                    <span>{originCountry} ({originCity})</span>
                    <svg className="w-3.5 h-3.5 text-[#EA1D2C] stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span>{destCountry} ({destCity})</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Origin Section */}
                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"></span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-['Manrope',sans-serif]">
                          Origin Location (From)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">China Warehouse</span>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Origin Country</label>
                          <div className="h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            China
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">China Warehouse</label>
                          <div className="h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            Guangzhou (CAN)
                          </div>
                        </div>
                      </div>

                      {/* Origin Warehouse Address */}
                      <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 text-[11px] mb-0.5">
                              <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              <span>Guangzhou Warehouse Address:</span>
                            </span>
                            <p className="font-mono text-slate-800 dark:text-slate-200 text-xs leading-relaxed select-all">
                              {CHINA_ORIGIN_HUB.address}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {CHINA_ORIGIN_HUB.chineseAddress}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(`${CHINA_ORIGIN_HUB.address} (${CHINA_ORIGIN_HUB.chineseAddress})`);
                              setCopiedAddress(true);
                              setTimeout(() => setCopiedAddress(false), 2000);
                            }}
                            className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium hover:bg-emerald-100/50 cursor-pointer shrink-0 transition-none"
                          >
                            {copiedAddress ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Destination Section */}
                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EA1D2C] ring-2 ring-red-200 dark:ring-red-900"></span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-['Manrope',sans-serif]">
                          Destination Location (To)
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Dhaka &amp; Chittagong
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Destination Country</label>
                        <div className="h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          <span>Bangladesh</span>
                          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            Dhaka &amp; Chittagong
                          </span>
                        </div>
                      </div>

                      {/* Fulfillment Method Toggle */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Fulfillment Option (Delivery or Pickup)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleFulfillmentChange('delivery')}
                            className={`p-2 rounded-lg border text-left transition-none cursor-pointer flex flex-col gap-0.5 ${
                              fulfillmentType === 'delivery'
                                ? 'border-[#EA1D2C] bg-red-50/70 dark:bg-red-950/40 text-[#EA1D2C] ring-1 ring-[#EA1D2C]'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                            }`}
                          >
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-current stroke-[2] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M10 17h4V5H2v12h3m9 0h2l3 3v-7h-5v4ZM7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
                              </svg>
                              <span>Doorstep Delivery</span>
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              Dhaka &amp; Chittagong city
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleFulfillmentChange('pickup')}
                            className={`p-2 rounded-lg border text-left transition-none cursor-pointer flex flex-col gap-0.5 ${
                              fulfillmentType === 'pickup'
                                ? 'border-[#EA1D2C] bg-red-50/70 dark:bg-red-950/40 text-[#EA1D2C] ring-1 ring-[#EA1D2C]'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                            }`}
                          >
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-current stroke-[2] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M11 11h2M11 15h2M16 11h2M16 15h2M9 21v-4h6v4M3 7l9-4 9 4" />
                              </svg>
                              <span>Hub / Depot Self-Pickup</span>
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              Airport &amp; seaport depot
                            </span>
                          </button>
                        </div>
                      </div>

                      {fulfillmentType === 'delivery' ? (
                        <div className="space-y-2.5">
                          <SearchableLocationSelect
                            id="dest-city-select"
                            label="Delivery Destination City"
                            value={destCity}
                            onChange={(val) => setDestCity(val)}
                            options={destDeliveryOptions}
                            placeholder="Select Dhaka or Chittagong..."
                            searchPlaceholder="Search Dhaka or Chittagong..."
                            allowCustom={false}
                          />

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Street / Shop Address in {destCity} (Optional)
                            </label>
                            <input
                              type="text"
                              value={destAddress}
                              onChange={(e) => setDestAddress(e.target.value)}
                              placeholder={`House, Road, Thana or Landmark in ${destCity}...`}
                              className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <SearchableLocationSelect
                            id="dest-city-select"
                            label="Self-Pickup Hub / City"
                            value={destCity}
                            onChange={(val) => setDestCity(val)}
                            options={destPickupOptions}
                            placeholder="Select pickup city..."
                            searchPlaceholder="Search Dhaka or Chittagong depot..."
                            allowCustom={false}
                          />
                          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-[11px] mb-0.5">
                              <svg className="w-3.5 h-3.5 text-red-600 shrink-0 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              <span>{destCity === 'Dhaka' ? 'Bangladesh Central Pickup Hub (Dhaka):' : 'Chittagong Port CFS Depot:'}</span>
                            </span>
                            <p className="text-slate-900 dark:text-white font-medium text-[11.5px] leading-relaxed">
                              {destCity === 'Dhaka'
                                ? '43/31, Sabujkanon, Dhaka- 1214, Bangladesh.'
                                : 'GoShipping CFS Terminal, CPA Seaport Zone, Agrabad Commercial Area, Chittagong'}
                            </p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                              <svg className="w-3 h-3 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>Zero local dispatch fee. Collect with your Tracking Number / B/L.</span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 3: PRODUCT DETAILS & CARGO WEIGHT */}
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-red-100 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="flex items-center gap-2 font-['Manrope',sans-serif] font-bold text-sm">
                    <span className="w-5 h-5 rounded-full bg-[#EA1D2C] text-white flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Product Details &amp; Cargo Weight</span>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Volumetric Eq: {airVolumetricKg.toFixed(1)} KG ({numCbm} CBM × 167)
                  </span>
                </div>

                {/* Sub-Section 1: Product Identification */}
                <div className="p-3.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#EA1D2C] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
                    </svg>
                    <span>Product Info &amp; Category</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Product Name / Item Title <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cotton T-Shirts, Smart Watch, LED Flood Light..."
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C] outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Product Category <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <select
                        value={productCategory}
                        onChange={(e) => {
                          setProductCategory(e.target.value);
                          if (!cargoDescription || cargoDescription.includes('(1688 / Factory)')) {
                            setCargoDescription(`${e.target.value} (1688 / Factory)`);
                          }
                        }}
                        className="w-full h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C] outline-none cursor-pointer"
                      >
                        {PRODUCT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Product / Supplier Link (1688 / Taobao / Alibaba URL) <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://detail.1688.com/... or Taobao / factory link"
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C] outline-none"
                      />
                    </div>
                  </div>

                  {/* Product Picture Upload */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Product Pictures &amp; Photos <span className="text-slate-400 font-normal">(Upload samples, carton labels or catalog pictures)</span>
                      </label>
                      <span className="text-[10px] font-mono font-medium text-slate-500">
                        {productImages.length}/5 Attached
                      </span>
                    </div>

                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#EA1D2C] dark:hover:border-[#EA1D2C] rounded-xl p-3 bg-white dark:bg-slate-900 cursor-pointer transition-none group">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleImageFiles(e.target.files)}
                      />
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 group-hover:text-[#EA1D2C]">
                        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        <span className="text-xs font-semibold">
                          Click to upload or drag &amp; drop product photos
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        PNG, JPG, WEBP up to 5MB each (Max 5 photos)
                      </span>
                    </label>

                    {imageError && (
                      <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-red-600 shrink-0 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{imageError}</span>
                      </p>
                    )}

                    {productImages.length > 0 && (
                      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {productImages.map((img, idx) => (
                          <div
                            key={img.id}
                            className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 aspect-square flex items-center justify-center"
                          >
                            <img
                              src={img.url}
                              alt={`Product preview ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeProductImage(img.id)}
                              aria-label="Remove image"
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-700 cursor-pointer transition-none"
                            >
                              ×
                            </button>
                            <span className="absolute bottom-1 left-1 text-[9px] font-mono bg-black/60 text-white px-1 py-0.2 rounded backdrop-blur-xs">
                              {img.size}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Section 2: Weight & Volume Details */}
                <div className="space-y-3 pt-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                      <path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
                    </svg>
                    <span>Weight &amp; Volume Details</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                        <option value="bag">Woven Bags / Sacks</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Additional Notes / Instructions
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
                      placeholder="Special handling instructions, carton markings, or specifications..."
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Official Recipient Details */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="text-xs font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  Contact Information
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

            {/* Right Column: Ledger & Consignment Review */}
            <div className="lg:col-span-4">
              <div className="sticky top-4 bg-gradient-to-b from-[#FFF5F5] via-rose-50/40 to-white rounded-xl border border-red-200/90 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-red-100 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EA1D2C]"></span>
                    <span className="text-xs font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Order Summary
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-[#EA1D2C] font-bold border border-red-200">
                    Customs Verified
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-white border border-red-100/90 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Estimated Shipping Cost
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Pre-Assessed
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Customs &amp; Taxes Included
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Final shipping charges and customs will be verified upon package arrival at our China warehouse based on actual weight and volume.
                  </p>
                </div>

                {/* Itemized Specifications */}
                <div className="space-y-2.5 py-3 border-y border-red-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Service Mode:</span>
                    <span className="font-semibold text-slate-900">
                      {mode === 'air' ? 'Air Freight' : mode === 'sea' ? 'Sea Freight' : 'P2P Transfer (Hand carry)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Transit SLA:</span>
                    <span className="font-semibold text-[#EA1D2C]">
                      {currentSla}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-50/80 dark:bg-red-950/40 border border-red-200/90 dark:border-red-900/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Estimated Arrival Date
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Real-Time Calendar
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#EA1D2C] font-mono">
                      {currentArrivalRange}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Calculated from real-time dispatch date upon intake at Guangzhou hub.
                    </p>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Route Corridor:</span>
                    <span className="font-semibold text-slate-900">{originCity} → {destCity}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Product Item:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                      {productName.trim() || 'General Cargo'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Category:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                      {productCategory}
                    </span>
                  </div>
                  {productImages.length > 0 && (
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-slate-500 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                            <circle cx="12" cy="13" r="3" />
                          </svg>
                          <span>Product Photos:</span>
                        </span>
                        <span className="text-[#EA1D2C] font-mono font-bold">{productImages.length} Attached</span>
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                        {productImages.map((img) => (
                          <img
                            key={img.id}
                            src={img.url}
                            alt="preview"
                            className="w-9 h-9 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Declared Volume:</span>
                    <span className="font-semibold font-mono text-slate-900 tabular-nums">
                      {mode === 'sea'
                        ? `${Math.max(numCbm, 0.5).toFixed(2)} CBM`
                        : `${airChargeableKg.toFixed(1)} KG`}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Packages:</span>
                    <span className="font-semibold text-slate-900">
                      {quantity || '1'} {packagingType || 'Cartons'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Customs Brokerage:</span>
                    <span className="font-semibold text-emerald-700">Full Brokerage Included</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Fulfillment:</span>
                    <span className="font-semibold text-slate-900">
                      {fulfillmentType === 'delivery'
                        ? `Doorstep Delivery (${destCity})`
                        : destCity === 'Dhaka'
                        ? 'Pickup: 43/31, Sabujkanon, Dhaka'
                        : `Depot Self-Pickup (${destCity})`}
                    </span>
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
                      <span>Submitting Your Request…</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span>Submit Shipping Request</span>
                      <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </button>

                {/* Guarantees Matrix */}
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 pt-1 border-t border-red-100">
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>China Warehouse Address</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>No Hidden Costs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Live Tracking</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Clear Invoicing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible/Interactive FAQ Section Below Form */}
          {showFaq && <QuoteFaqSection />}
        </form>
      )}
    </div>
  );
}
