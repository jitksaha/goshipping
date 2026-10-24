import React, { useState, useEffect, useRef } from 'react';
import type { PublicTrackingResponse } from '../../server/services/tracking.service';

interface Props {
  initialTrackingNumber?: string;
  pollIntervalMs?: number;
}

export default function LiveTrackingIsland({
  initialTrackingNumber = 'GOSH-2026-9812',
  pollIntervalMs = 25000
}: Props) {
  const [query, setQuery] = useState(initialTrackingNumber);
  const [trackingData, setTrackingData] = useState<PublicTrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [isTabActive, setIsTabActive] = useState(true);

  const lastHashRef = useRef<string | null>(null);

  // Function to fetch tracking data
  const fetchTracking = async (code: string, isSilentPoll = false) => {
    if (!code) return;
    if (!isSilentPoll) setLoading(true);
    setError(null);

    try {
      const url = new URL(`/api/tracking/${encodeURIComponent(code)}`, window.location.origin);
      if (isSilentPoll && lastHashRef.current) {
        url.searchParams.set('lastHash', lastHashRef.current);
      }

      const res = await fetch(url.toString(), {
        headers: isSilentPoll && lastHashRef.current ? { 'If-None-Match': `"${lastHashRef.current}"` } : {}
      });

      if (res.status === 304) {
        // Data unchanged, update heartbeat timestamp
        setLastRefreshed(new Date());
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Tracking number not found');
      }

      const data = await res.json();
      if (data.tracking) {
        setTrackingData(data.tracking);
        lastHashRef.current = data.tracking.lastHash;
        setLastRefreshed(new Date());
      }
    } catch (err: any) {
      if (!isSilentPoll) {
        setError(err.message || 'Unable to retrieve tracking details');
        setTrackingData(null);
      }
    } finally {
      if (!isSilentPoll) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (initialTrackingNumber) {
      fetchTracking(initialTrackingNumber);
    }
  }, [initialTrackingNumber]);

  // Tab visibility detection to pause background polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Adaptive polling interval
  useEffect(() => {
    if (!isPolling || !isTabActive || !trackingData) return;

    const timer = setInterval(() => {
      fetchTracking(trackingData.trackingNumber, true);
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [isPolling, isTabActive, trackingData, pollIntervalMs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      fetchTracking(query.trim());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in_transit':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'customs_clearance':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Search Header */}
      <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-200">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter GoShipping AWB or Tracking No (e.g. GOSH-2026-9812)"
              className="w-full h-12 pl-4 pr-10 text-sm md:text-base font-mono font-medium rounded-lg border border-slate-300 bg-white focus:border-[#EA1D2C] focus:ring-2 focus:ring-[#EA1D2C]/20 transition-all uppercase"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-12 px-6 rounded-lg bg-[#EA1D2C] text-white font-bold text-sm tracking-wide hover:bg-[#D41523] active:bg-[#B7101C] transition-colors-fast flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Track Consignment'}
          </button>
        </form>

        {/* Demo Fast Click Suggestions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Quick Test Records:</span>
          <button
            type="button"
            onClick={() => {
              setQuery('GOSH-2026-9812');
              fetchTracking('GOSH-2026-9812');
            }}
            className="px-2.5 py-1 rounded bg-white border border-slate-300 font-mono font-medium text-slate-700 hover:border-[#EA1D2C] hover:text-[#EA1D2C] transition-colors-fast"
          >
            GOSH-2026-9812 (Air Freight / In-Transit)
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('GOSH-2026-4411');
              fetchTracking('GOSH-2026-4411');
            }}
            className="px-2.5 py-1 rounded bg-white border border-slate-300 font-mono font-medium text-slate-700 hover:border-[#EA1D2C] hover:text-[#EA1D2C] transition-colors-fast"
          >
            GOSH-2026-4411 (Sea Cargo / Port Customs)
          </button>
        </div>
      </div>

      {/* Error View */}
      {error && (
        <div className="p-8 text-center bg-red-50/50">
          <div className="w-12 h-12 rounded-full bg-red-100 text-[#EA1D2C] flex items-center justify-center mx-auto mb-3 font-bold text-lg">
            !
          </div>
          <p className="text-sm font-semibold text-slate-900">{error}</p>
          <p className="text-xs text-slate-500 mt-1">Please verify your tracking reference number and try again.</p>
        </div>
      )}

      {/* Tracking Data View */}
      {trackingData && (
        <div className="p-6 md:p-8 space-y-8">
          {/* Header Summary Strip */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Airway Bill / Reference</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase ${getStatusColor(trackingData.status)}`}>
                  {trackingData.status.replace('_', ' ')}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-mono font-extrabold text-[#11181E] tracking-tight">
                {trackingData.trackingNumber}
              </h2>
            </div>

            {/* Polling Heartbeat Badge */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                <span className={`w-2 h-2 rounded-full ${isTabActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                {isTabActive ? `Auto-sync: every ${pollIntervalMs / 1000}s` : 'Polling paused (tab inactive)'}
              </span>
              <button
                type="button"
                onClick={() => fetchTracking(trackingData.trackingNumber, false)}
                className="text-slate-500 hover:text-[#EA1D2C] font-semibold transition-colors-fast"
              >
                ↻ Refresh Now
              </button>
            </div>
          </div>

          {/* Route & Progress Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-lg bg-slate-50 border border-slate-200 text-sm">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Origin</span>
              <p className="font-bold text-slate-900 text-base mt-0.5">{trackingData.originCity}</p>
              <p className="text-xs text-slate-500">{trackingData.originCountry}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Destination</span>
              <p className="font-bold text-slate-900 text-base mt-0.5">{trackingData.destCity}</p>
              <p className="text-xs text-slate-500">{trackingData.destCountry}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Node</span>
              <p className="font-bold text-slate-900 text-base mt-0.5">{trackingData.currentLocation}</p>
              <p className="text-xs text-slate-500">
                {trackingData.hasLiveGps ? (
                  <span className="text-emerald-700 font-medium">✓ Verified Carrier Coordinates</span>
                ) : (
                  <span>Waypoint Node Clearance</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Est. Arrival</span>
              <p className="font-bold text-[#EA1D2C] text-base mt-0.5 tabular-nums">
                {new Date(trackingData.estimatedDelivery).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
              <p className="text-xs text-slate-500 uppercase font-mono">{trackingData.mode} · {trackingData.serviceLevel}</p>
            </div>
          </div>

          {/* Verified Timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Verified Event Timeline & Milestones
              </h3>
              <span className="text-xs text-slate-400 font-medium">
                {trackingData.events.length} verified stage updates
              </span>
            </div>

            <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
              {trackingData.events.map((evt, idx) => (
                <div key={evt.id} className="relative group">
                  {/* Timeline Node Marker */}
                  <span
                    className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 bg-white ${
                      idx === 0 ? 'border-[#EA1D2C] ring-4 ring-[#EA1D2C]/15' : 'border-slate-400'
                    }`}
                  ></span>

                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">{evt.title}</h4>
                      <time className="text-xs font-mono font-medium text-slate-500 tabular-nums">
                        {new Date(evt.eventTime).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </time>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{evt.description}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">📍 {evt.locationName}</span>
                      <span className="text-slate-300">•</span>
                      <span className="uppercase font-mono">Source: {evt.source.replace('_', ' ')}</span>
                      {evt.hasGpsCoordinate && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-emerald-700 font-medium">
                            GPS: {evt.lat?.toFixed(4)}, {evt.lng?.toFixed(4)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
