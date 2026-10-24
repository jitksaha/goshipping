import React, { useState } from 'react';

export default function QuoteCalculatorIsland() {
  const [mode, setMode] = useState<'air' | 'sea'>('air');
  const [originCountry, setOriginCountry] = useState('Bangladesh');
  const [originCity, setOriginCity] = useState('Dhaka');
  const [destCountry, setDestCountry] = useState('Germany');
  const [destCity, setDestCity] = useState('Frankfurt');
  const [weightKg, setWeightKg] = useState('500');
  const [cbm, setCbm] = useState('2.5');
  const [quantity, setQuantity] = useState('20');
  const [packagingType, setPackagingType] = useState('carton');
  const [cargoDescription, setCargoDescription] = useState('RMG Garments & Textiles (Packed in export master cartons)');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<{ quoteNumber: string; route: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fast estimate calculation based on market indicative rates
  const numWeight = parseFloat(weightKg) || 0;
  const numCbm = parseFloat(cbm) || 0;
  // Air chargeable weight is max of gross weight vs volume weight (1 CBM = 167 kg)
  const airVolumetricKg = numCbm * 167;
  const airChargeableKg = Math.max(numWeight, airVolumetricKg);
  const estimatedAirCost = Math.round(airChargeableKg * 4.25 + 150); // Indicative rate
  const estimatedSeaCost = Math.round(Math.max(numCbm, 1) * 110 + 350); // Indicative LCL ocean

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
    } catch (err: any) {
      setError(err.message || 'Error creating quotation request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="quote-calculator" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 md:p-8 bg-[#11181E] text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#EA1D2C]">
              Enterprise Quotation Engine
            </span>
            <h3 className="text-xl md:text-2xl font-bold mt-1 text-white">
              Instant Freight Calculation & Official Booking
            </h3>
          </div>
          <div className="bg-slate-800/80 px-4 py-2.5 rounded-lg border border-slate-700 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Market Indicative Budget</span>
            <span className="text-xl md:text-2xl font-mono font-extrabold text-[#10B981] tabular-nums">
              ${currentEstimate.toLocaleString()} <span className="text-xs text-slate-300 font-normal">USD</span>
            </span>
          </div>
        </div>
      </div>

      {submittedQuote ? (
        <div className="p-8 md:p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>
          <h4 className="text-2xl font-bold text-slate-900">Quotation Request Successfully Registered</h4>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Your quotation reference number is{' '}
            <strong className="text-slate-900 font-mono text-base px-2 py-1 bg-slate-100 rounded border border-slate-300">
              {submittedQuote.quoteNumber}
            </strong>
            . Our commercial pricing team will inspect airline space/vessel schedules and deliver an itemized quote within 2 business hours.
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSubmittedQuote(null);
                setGuestName('');
              }}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors-fast"
            >
              Submit Another Quote
            </button>
            <a
              href="/login"
              className="px-5 py-2.5 rounded-lg bg-[#EA1D2C] text-white font-bold text-xs hover:bg-[#D41523] transition-colors-fast"
            >
              Login to Track Quote
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Select Shipping Mode
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setMode('air')}
                className={`py-3 px-4 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-colors-fast ${
                  mode === 'air'
                    ? 'border-[#EA1D2C] bg-[#F8E9EB] text-[#EA1D2C]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                ✈ Air Freight (Express / 3-5 Days)
              </button>
              <button
                type="button"
                onClick={() => setMode('sea')}
                className={`py-3 px-4 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-colors-fast ${
                  mode === 'sea'
                    ? 'border-[#EA1D2C] bg-[#F8E9EB] text-[#EA1D2C]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                🚢 Ocean Cargo (LCL / FCL)
              </button>
            </div>
          </div>

          {/* Route Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Origin Country</label>
              <input
                type="text"
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Origin City / Port</label>
              <input
                type="text"
                value={originCity}
                onChange={(e) => setOriginCity(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Country</label>
              <input
                type="text"
                value={destCountry}
                onChange={(e) => setDestCountry(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination City</label>
              <input
                type="text"
                value={destCity}
                onChange={(e) => setDestCity(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              />
            </div>
          </div>

          {/* Cargo Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Gross Weight (KG)</label>
              <input
                type="number"
                step="any"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 font-mono tabular-nums focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Volume (CBM)</label>
              <input
                type="number"
                step="any"
                value={cbm}
                onChange={(e) => setCbm(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 font-mono tabular-nums focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Packaging & Pieces</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-20 h-10 px-3 text-sm rounded-md border border-slate-300 font-mono tabular-nums focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
                  placeholder="Qty"
                />
                <select
                  value={packagingType}
                  onChange={(e) => setPackagingType(e.target.value)}
                  className="flex-1 h-10 px-2 text-sm rounded-md border border-slate-300 bg-white"
                >
                  <option value="carton">Cartons</option>
                  <option value="pallet">Pallets</option>
                  <option value="crate">Wooden Crates</option>
                  <option value="drum">Steel Drums</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Commodity / Cargo Description</label>
            <input
              type="text"
              value={cargoDescription}
              onChange={(e) => setCargoDescription(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
            />
          </div>

          {/* Contact Details */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              Official Quotation Recipient Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person / Company</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Textiles Ltd"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  placeholder="commercial@company.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  required
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                <input
                  type="tel"
                  placeholder="+880 1711 000000"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  required
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 rounded-lg bg-[#EA1D2C] text-white font-bold text-sm hover:bg-[#D41523] active:bg-[#B7101C] transition-colors-fast shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Quotation Request →'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
