import React, { useState, useEffect, useRef } from 'react';
import type { PublicTrackingResponse } from '../../server/services/tracking.service';
import type { ShipmentItem } from '../../server/services/shipment.service';
import {
  TRACKING_STATUSES,
  PHYSICAL_STAGES,
  TrackingStatusCode,
  calculatePhysicalProgress
} from '../../server/services/tracking-status';
import { formatBstDateTime } from '../../server/utils/date';

interface Props {
  initialTrackingNumber?: string;
  pollIntervalMs?: number;
}

export default function LiveTrackingIsland({
  initialTrackingNumber = 'GOSH-2026-9812',
  pollIntervalMs = 12000
}: Props) {
  const [query, setQuery] = useState(initialTrackingNumber);
  const [trackingData, setTrackingData] = useState<PublicTrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isTabActive, setIsTabActive] = useState(true);
  const [realtimeProvider, setRealtimeProvider] = useState<'pusher' | 'ably' | 'polling'>('polling');

  // Active view tab: 'timeline' | 'items' | 'carrier' | 'recipient' | 'map'
  const [activeTab, setActiveTab] = useState<'timeline' | 'items' | 'carrier' | 'recipient' | 'map'>('timeline');

  // Copy tracking number feedback
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Bill of lading preview modal
  const [showDocModal, setShowDocModal] = useState(false);

  // Non-intrusive Kumo toast for live updates
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastDetails, setToastDetails] = useState<{ statusLabel?: string; trackingNumber?: string } | null>(null);
  const [recentlyUpdatedEventId, setRecentlyUpdatedEventId] = useState<string | null>(null);

  // Available sample consignments for quick switcher
  const sampleCodes = [
    { code: 'GOSH-2026-9812', label: 'Air Express (Guangzhou → Dhaka)' },
    { code: 'GOSH-2026-4411', label: 'Sea Freight FCL (Shenzhen → Chittagong)' },
    { code: 'GOSH-2026-7733', label: 'Priority Linehaul (Yiwu → Dhaka)' }
  ];

  const lastHashRef = useRef<string | null>(null);
  const lastVersionRef = useRef<number>(1);
  const prevTrackingRef = useRef<PublicTrackingResponse | null>(null);

  // 1. Fetch Realtime Client Configuration
  useEffect(() => {
    fetch('/api/realtime/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.config?.provider) {
          setRealtimeProvider(data.config.provider);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Fetch tracking data with 304 conditional check
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
        setLastRefreshed(new Date());
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Tracking number not found');
      }

      const data = await res.json();
      if (data.tracking) {
        const newTracking: PublicTrackingResponse = data.tracking;

        // Detect if this is an automated live status update
        const prev = prevTrackingRef.current;
        if (
          prev &&
          prev.trackingNumber === newTracking.trackingNumber &&
          (prev.status !== newTracking.status ||
            prev.paymentStatus !== newTracking.paymentStatus ||
            prev.eventVersion !== newTracking.eventVersion ||
            prev.events.length !== newTracking.events.length)
        ) {
          // Trigger non-intrusive Kumo Toast
          const latest = newTracking.events[0];
          setToastMessage('Shipment status updated');
          setToastDetails({
            statusLabel: newTracking.statusLabel || latest?.statusLabel,
            trackingNumber: newTracking.trackingNumber
          });
          if (latest?.id) {
            setRecentlyUpdatedEventId(latest.id);
            setTimeout(() => setRecentlyUpdatedEventId(null), 8000);
          }
          // Auto dismiss toast after 4.5s
          setTimeout(() => {
            setToastMessage(null);
            setToastDetails(null);
          }, 4500);
        }

        prevTrackingRef.current = newTracking;
        lastHashRef.current = newTracking.lastHash;
        lastVersionRef.current = newTracking.eventVersion;
        setTrackingData(newTracking);
        setLastRefreshed(new Date());

        // Dispatch Search conversion across analytics
        if (!isSilentPoll && typeof window !== 'undefined' && (window as any).goShippingTrack) {
          (window as any).goShippingTrack('Search', {
            search_string: code,
            search_type: 'consignment_tracking',
            status: newTracking.status,
            origin: newTracking.originCity,
            destination: newTracking.destCity
          });
        }
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

  // 3. Initial load & tracking code change
  useEffect(() => {
    if (initialTrackingNumber) {
      setQuery(initialTrackingNumber);
      fetchTracking(initialTrackingNumber);
    }
  }, [initialTrackingNumber]);

  // 4. Tab visibility detection to pause polling when backgrounded
  useEffect(() => {
    const handleVisibilityChange = () => {
      const active = !document.hidden;
      setIsTabActive(active);
      // Immediately refetch authoritative state when returning to tab
      if (active && trackingData?.trackingNumber) {
        fetchTracking(trackingData.trackingNumber, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleOnline = () => {
      if (trackingData?.trackingNumber) {
        fetchTracking(trackingData.trackingNumber, true);
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [trackingData?.trackingNumber]);

  // 5. Adaptive Polling (12s active, paused when tab hidden)
  useEffect(() => {
    if (!isTabActive || !trackingData) return;

    const interval = setInterval(() => {
      fetchTracking(trackingData.trackingNumber, true);
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [isTabActive, trackingData?.trackingNumber, pollIntervalMs]);

  // 6. Listen for custom window event 'select-tracking-code'
  useEffect(() => {
    const handleSelectTracking = (e: any) => {
      if (e.detail?.code && e.detail.code !== trackingData?.trackingNumber) {
        setQuery(e.detail.code);
        fetchTracking(e.detail.code);
      }
    };
    window.addEventListener('select-tracking-code', handleSelectTracking);
    return () => window.removeEventListener('select-tracking-code', handleSelectTracking);
  }, [trackingData?.trackingNumber]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      fetchTracking(query.trim());
    }
  };

  const handleCopyTrackingNumber = () => {
    if (!trackingData) return;
    navigator.clipboard.writeText(trackingData.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyTrackingLink = () => {
    if (!trackingData) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://goshipping.com.bd';
    const link = `${origin}/tracking?code=${encodeURIComponent(trackingData.trackingNumber)}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // Status badge style helper
  const getStatusBadgeStyle = (status: TrackingStatusCode | string) => {
    const def = TRACKING_STATUSES[status as TrackingStatusCode];
    if (def) {
      return `${def.badgeBg} ${def.badgeText} ${def.badgeBorder}`;
    }
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  // Calculate progress
  const progress = trackingData
    ? calculatePhysicalProgress(trackingData.status, trackingData.events)
    : { completedStagesCount: 0, totalStagesCount: 8, percentage: 0, currentPhysicalStageIndex: 0, isComplete: false };

  return (
    <div className="w-full space-y-6 font-['Inter',sans-serif] text-slate-800 dark:text-slate-100">
      {/* ========================================================================= */}
      {/* NON-INTRUSIVE KUMO TOAST (Live Status Update Notification)                */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-sm bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xl p-4 flex items-start gap-3 transition-none motion-reduce:transition-none"
        >
          <div className="w-8 h-8 rounded-full bg-[#EA1D2C]/10 text-[#EA1D2C] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                {toastMessage}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Just now</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
              {toastDetails?.trackingNumber}: <span className="font-bold text-[#EA1D2C]">{toastDetails?.statusLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            aria-label="Dismiss toast"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 01. SEARCH & CONSIGNMENT SWITCHER BAR                                     */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <svg
              className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 stroke-[2]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter GoShipping Tracking Code (e.g. GOSH-2026-9812)..."
              className="w-full h-10 pl-10 pr-4 text-xs font-mono font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]/20 transition-none outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-none cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
              <span>Track Consignment</span>
            </button>

            <button
              type="button"
              onClick={() => trackingData && fetchTracking(trackingData.trackingNumber, false)}
              disabled={loading || !trackingData}
              title="Refresh tracking data from authoritative server"
              className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition-none cursor-pointer disabled:opacity-40"
            >
              <svg className={`w-3.5 h-3.5 stroke-[2] ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {trackingData && (
              <button
                type="button"
                onClick={handleCopyTrackingLink}
                title="Copy shareable direct tracking link"
                className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition-none cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 stroke-[2] text-[#EA1D2C]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span className="hidden sm:inline">{linkCopied ? 'Link Copied!' : 'Direct Link'}</span>
              </button>
            )}
          </div>
        </form>

        {/* Quick Sample Consignments Switcher */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Sample Consignments:</span>
            {sampleCodes.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  setQuery(s.code);
                  fetchTracking(s.code);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border transition-none cursor-pointer ${
                  trackingData?.trackingNumber === s.code
                    ? 'bg-[#F8E9EB] dark:bg-[#EA1D2C]/20 text-[#EA1D2C] border-[#EA1D2C]/30'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {s.code}
              </button>
            ))}
          </div>

          {/* Sync indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono">
              {realtimeProvider === 'pusher' ? 'Live Push Sync' : 'Adaptive Polling (12s)'}
            </span>
            {lastRefreshed && (
              <span className="text-slate-400 font-mono hidden md:inline">
                · Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ERROR STATE                                                               */}
      {/* ========================================================================= */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900/60 p-5 text-center">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 text-[#EA1D2C] mx-auto flex items-center justify-center mb-2">
            <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="font-bold text-sm text-red-900 dark:text-red-200 font-['Manrope',sans-serif]">
            Consignment Not Found
          </h3>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1 max-w-md mx-auto">{error}</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 02. REDESIGNED TRACKING HEADER (Section 5.A)                              */}
      {/* ========================================================================= */}
      {trackingData && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Top Brand & Metadata Bar */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EA1D2C]" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                GO SHIPPING | ORDER TRACKING
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDocModal(true)}
                className="text-[11px] font-semibold text-[#EA1D2C] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Waybill / BOL ({trackingData.billOfLadingNumber})</span>
              </button>
            </div>
          </div>

          {/* Main Header Body */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left Column: Code, Product & Route */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                    {trackingData.trackingNumber}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCopyTrackingNumber}
                    title="Copy tracking number"
                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-none cursor-pointer"
                  >
                    {copied ? (
                      <span className="text-[10px] text-emerald-600 font-semibold">Copied!</span>
                    ) : (
                      <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTrackingLink}
                    title="Copy shareable direct tracking link"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-none cursor-pointer"
                  >
                    <svg className="w-3 h-3 text-[#EA1D2C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span>{linkCopied ? 'Link Copied!' : 'Direct Link'}</span>
                  </button>

                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-tight border ${
                      trackingData.mode === 'air'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                        : trackingData.mode === 'sea'
                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {trackingData.mode.toUpperCase()} FREIGHT · {trackingData.serviceLevel.toUpperCase()}
                  </span>
                </div>

                {/* Product Name */}
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="text-slate-400 font-normal">Product:</span>
                  <span>{trackingData.productName}</span>
                </div>

                {/* Origin to Destination Route */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 pt-0.5">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {trackingData.originCity}, {trackingData.originCountry}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {trackingData.destCity}, {trackingData.destCountry}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono tabular-nums">{trackingData.totalPieces} Pcs</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono tabular-nums">{trackingData.totalWeightKg.toLocaleString()} KG</span>
                </div>
              </div>

              {/* Right Column: Status Badge, Payment Milestone, and Last Updated */}
              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Current Shipment Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide border shadow-2xs ${getStatusBadgeStyle(
                      trackingData.status
                    )}`}
                  >
                    {trackingData.statusLabel || trackingData.status.replace(/_/g, ' ')}
                  </span>

                  {/* Independent Payment Milestone Badge */}
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${
                      trackingData.paymentStatus === 'payment_received'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {trackingData.paymentStatus === 'payment_received' ? 'PAYMENT RECEIVED' : 'PAYMENT PENDING'}
                  </span>
                </div>

                {/* Last Updated Timestamp in BST format: 25 Oct 2026, 11:30 AM BST */}
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>Last Updated: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {trackingData.lastUpdatedBst || formatBstDateTime(trackingData.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 03. SHIPMENT PROGRESS INDICATOR (Section 5.B)                             */}
            {/* ========================================================================= */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-slate-500 dark:text-slate-400">Physical Movement Progress:</span>
                  <span className="font-bold text-[#EA1D2C] font-mono">
                    Stage {progress.completedStagesCount} of {progress.totalStagesCount} ({progress.percentage}%)
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 hidden sm:block">
                  Current Waypoint: <span className="font-medium text-slate-700 dark:text-slate-300">{trackingData.currentLocation}</span>
                </div>
              </div>

              {/* Progress Bar Line & Physical Stage Stepper */}
              <div className="relative pt-2 pb-1">
                {/* Background Track */}
                <div className="absolute top-5 left-3 right-3 h-1 bg-slate-200 dark:bg-slate-700 rounded-full z-0" />
                {/* Active Progress Fill */}
                <div
                  className="absolute top-5 left-3 h-1 bg-emerald-500 rounded-full z-0 transition-none motion-reduce:transition-none"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, ((progress.completedStagesCount - 1) / (progress.totalStagesCount - 1)) * 100)
                    )}%`
                  }}
                />

                {/* Stepper Nodes (8 Physical Stages) */}
                <div className="relative z-10 flex items-start justify-between">
                  {PHYSICAL_STAGES.map((stageKey, idx) => {
                    const stageDef = TRACKING_STATUSES[stageKey];
                    const isCompleted = idx < progress.completedStagesCount - 1;
                    const isCurrent = idx === progress.completedStagesCount - 1;
                    const isFuture = idx >= progress.completedStagesCount;

                    return (
                      <div key={stageKey} className="flex flex-col items-center group max-w-[70px] sm:max-w-[85px] text-center">
                        <div
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-none motion-reduce:transition-none ${
                            isCurrent
                              ? 'bg-[#EA1D2C] border-white text-white ring-2 ring-[#EA1D2C]/40 shadow-xs'
                              : isCompleted
                              ? 'bg-emerald-500 border-white text-white ring-1 ring-emerald-300'
                              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'
                          }`}
                        >
                          {isCompleted ? (
                            <svg className="w-3.5 h-3.5 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : isCurrent ? (
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>

                        <span
                          className={`mt-1.5 text-[9px] sm:text-[10px] leading-tight font-medium tracking-tight line-clamp-2 ${
                            isCurrent
                              ? 'font-bold text-[#EA1D2C]'
                              : isCompleted
                              ? 'text-slate-800 dark:text-slate-200 font-semibold'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {stageDef.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 04. TABS & DETAILED TRACKING SECTIONS                                     */}
      {/* ========================================================================= */}
      {trackingData && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Navigation Tab Header */}
          <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 text-xs font-semibold scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`px-4 sm:px-5 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-none cursor-pointer ${
                activeTab === 'timeline'
                  ? 'border-[#EA1D2C] text-[#EA1D2C] bg-slate-50/50 dark:bg-slate-800/40'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Timeline & Milestones ({trackingData.events.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`px-4 sm:px-5 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-none cursor-pointer ${
                activeTab === 'items'
                  ? 'border-[#EA1D2C] text-[#EA1D2C] bg-slate-50/50 dark:bg-slate-800/40'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <span>Cargo Packages & Items ({trackingData.items.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('carrier')}
              className={`px-4 sm:px-5 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-none cursor-pointer ${
                activeTab === 'carrier'
                  ? 'border-[#EA1D2C] text-[#EA1D2C] bg-slate-50/50 dark:bg-slate-800/40'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
              </svg>
              <span>Carrier & Linehaul</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recipient')}
              className={`px-4 sm:px-5 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-none cursor-pointer ${
                activeTab === 'recipient'
                  ? 'border-[#EA1D2C] text-[#EA1D2C] bg-slate-50/50 dark:bg-slate-800/40'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Consignee & Destination</span>
            </button>

            {trackingData.hasLiveGps && (
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`px-4 sm:px-5 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-none cursor-pointer ${
                  activeTab === 'map'
                    ? 'border-[#EA1D2C] text-[#EA1D2C] bg-slate-50/50 dark:bg-slate-800/40'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                <span>Live Corridor Telemetry</span>
              </button>
            )}
          </div>

          <div className="p-5 sm:p-6">
            {/* ========================================================================= */}
            {/* TAB CONTENT 1: VERTICAL TRACKING TIMELINE (Section 5.C)                   */}
            {/* ========================================================================= */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                    Verified Milestone History & Telemetry
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    All times in Bangladesh Standard Time (BST)
                  </span>
                </div>

                <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {trackingData.events.map((evt, idx) => {
                    const isLatest = idx === 0;
                    const isPayment = evt.statusCode === 'payment_received';
                    const isHighlighted = evt.id === recentlyUpdatedEventId;

                    return (
                      <div
                        key={evt.id}
                        className={`relative group transition-none motion-reduce:transition-none ${
                          isHighlighted ? 'p-3 rounded-lg bg-red-50/70 dark:bg-red-950/30 ring-1 ring-[#EA1D2C]/40' : ''
                        }`}
                      >
                        {/* Node Icon */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-none ${
                            isLatest && !isPayment
                              ? 'bg-[#EA1D2C] border-white text-white ring-4 ring-[#EA1D2C]/20 shadow-xs'
                              : isPayment
                              ? 'bg-emerald-600 border-white text-white ring-2 ring-emerald-300'
                              : 'bg-emerald-500 border-white text-white ring-1 ring-emerald-200'
                          }`}
                        >
                          {isPayment ? (
                            <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                              <line x1="1" y1="10" x2="23" y2="10" />
                            </svg>
                          ) : isLatest ? (
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          ) : (
                            <svg className="w-3 h-3 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        {/* Event Details */}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h4
                                className={`text-sm font-bold tracking-tight ${
                                  isLatest
                                    ? 'text-[#EA1D2C]'
                                    : isPayment
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {evt.statusLabel || evt.title}
                              </h4>
                              {isLatest && !isPayment && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-red-100 text-[#EA1D2C] dark:bg-red-950 dark:text-red-300 uppercase">
                                  Current Stage
                                </span>
                              )}
                              {isPayment && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                                  Financial Milestone
                                </span>
                              )}
                            </div>

                            {/* Actual Timestamp in Bangladesh Time: 25 Oct 2026, 08:15 PM BST */}
                            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                              {evt.occurredAtBst || formatBstDateTime(evt.eventTime)}
                            </span>
                          </div>

                          {/* Location */}
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>{evt.locationName}</span>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="text-[11px] font-mono uppercase text-slate-400">
                              Source: {evt.source}
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                            {evt.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB CONTENT 2: CARGO PACKAGES & ITEMS                                     */}
            {/* ========================================================================= */}
            {activeTab === 'items' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                    Cargo Manifest & Package Specifications
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    Total: {trackingData.totalWeightKg} KG · {trackingData.totalCbm} CBM
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Item Code</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Packaging</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Weight (KG)</th>
                        <th className="py-2.5 px-3 text-right">Volume (CBM)</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Declared Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {trackingData.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            {item.itemCode}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {item.description}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 uppercase">
                            {item.packagingType.replace(/_/g, ' ')}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">{item.quantity}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">{item.weightKg}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">{item.cbm}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.categoryTag}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                            {item.declaredValue ? `৳${item.declaredValue.toLocaleString()} BDT` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB CONTENT 3: CARRIER & LINEHAUL DETAILS                                 */}
            {/* ========================================================================= */}
            {activeTab === 'carrier' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                    International Linehaul Carrier
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Carrier Operator:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{trackingData.carrierName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Flight / Vessel / Convoy:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{trackingData.voyageOrFlightNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Master Waybill / BOL:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{trackingData.billOfLadingNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Origin Departure:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {formatBstDateTime(trackingData.departureTime)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                    Delivery Timeline & Customs Station
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estimated Destination ETA:</span>
                      <span className="font-mono font-semibold text-[#EA1D2C]">
                        {formatBstDateTime(trackingData.estimatedDelivery)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Target Terminal:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {trackingData.mode === 'air' ? 'HSIA Cargo Village, Dhaka' : 'Chittagong Port Terminal'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Service SLA:</span>
                      <span className="font-semibold text-slate-900 dark:text-white uppercase">{trackingData.serviceLevel} Express</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB CONTENT 4: CONSIGNEE & RECIPIENT                                      */}
            {/* ========================================================================= */}
            {activeTab === 'recipient' && (
              <div className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                  Consignee & Final Delivery Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Recipient Consignee:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{trackingData.recipientName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Destination City:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{trackingData.destCity}, {trackingData.destCountry}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block mb-0.5">Delivery Address:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{trackingData.recipientAddress}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB CONTENT 5: LIVE CORRIDOR GPS MAP                                      */}
            {/* ========================================================================= */}
            {activeTab === 'map' && trackingData.hasLiveGps && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Verified Coordinates: {trackingData.currentLat?.toFixed(4)}, {trackingData.currentLng?.toFixed(4)}
                  </span>
                  <span className="font-mono text-emerald-600 font-semibold">● Active GPS Telemetry Feed</span>
                </div>
                <div className="w-full h-64 sm:h-80 rounded-lg bg-slate-900 border border-slate-800 relative overflow-hidden flex items-center justify-center">
                  <div className="text-center space-y-2 p-6 z-10">
                    <div className="w-12 h-12 rounded-full bg-[#EA1D2C]/20 text-[#EA1D2C] flex items-center justify-center mx-auto ring-8 ring-[#EA1D2C]/10">
                      <svg className="w-6 h-6 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    </div>
                    <div className="font-mono font-bold text-white text-sm">
                      {trackingData.currentLocation}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      LAT: {trackingData.currentLat} · LNG: {trackingData.currentLng} · Speed: Transit Normal
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 05. BILL OF LADING / WAYBILL PREVIEW MODAL                                */}
      {/* ========================================================================= */}
      {showDocModal && trackingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                  Electronic Airway Bill / Bill of Lading
                </h3>
                <span className="text-xs font-mono text-slate-500">{trackingData.billOfLadingNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-slate-50 dark:bg-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Tracking Reference</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{trackingData.trackingNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Service Mode</span>
                  <span className="font-semibold text-slate-900 dark:text-white uppercase">{trackingData.mode} Freight ({trackingData.serviceLevel})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Shipper Origin</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{trackingData.originCity}, {trackingData.originCountry}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Consignee Destination</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{trackingData.destCity}, {trackingData.destCountry}</span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded p-3 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Weight:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{trackingData.totalWeightKg} KG</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Volume:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{trackingData.totalCbm} CBM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Package Units:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{trackingData.totalPieces} Pcs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Clearance:</span>
                  <span className="font-bold text-emerald-600 uppercase">{trackingData.paymentStatus.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-none"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-[#EA1D2C] text-white font-semibold text-xs hover:bg-[#D41523] transition-none"
              >
                Print Manifest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
