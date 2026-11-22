import React, { useState, useEffect, useRef } from 'react';
import {
  TRACKING_STATUSES,
  normalizeStatusCode,
  type TrackingStatusCode
} from '../../server/services/tracking-status';

export interface StatusItemConfig {
  code: TrackingStatusCode;
  label: string; // Exact uppercase label matching Google Sheet Col F
  displayTitle: string; // User-facing descriptive title with step number
  stepBadge?: string;
  description: string;
  badgeClass: string;
  dotClass: string;
}

export const STATUS_DROPDOWN_OPTIONS: StatusItemConfig[] = [
  {
    code: 'purchased',
    label: 'PURCHASED CHINA WAREHOUSE',
    displayTitle: '1. Purchased (China Warehouse)',
    stepBadge: 'Step 1',
    description: 'Manifest created, awaiting CN warehouse arrival',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200',
    dotClass: 'bg-slate-500'
  },
  {
    code: 'cn_warehouse_received',
    label: 'CN WAREHOUSE RECEIVED',
    displayTitle: '2. CN Warehouse Received',
    stepBadge: 'Step 2',
    description: 'Measured, weighed & sorted at China hub',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    dotClass: 'bg-blue-500'
  },
  {
    code: 'dispatched_from_china',
    label: 'DISPATCHED FROM CHINA',
    displayTitle: '3. Dispatched from China',
    stepBadge: 'Step 3',
    description: 'Departed China via international carrier',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
    dotClass: 'bg-indigo-500'
  },
  {
    code: 'arrived_dhaka_airport',
    label: 'ARRIVED DHAKA AIRPORT',
    displayTitle: '4. Arrived Dhaka Airport',
    stepBadge: 'Step 4',
    description: 'Landed at HSIA Cargo Village, Dhaka',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    dotClass: 'bg-purple-500'
  },
  {
    code: 'awaiting_customs',
    label: 'AWAITING CUSTOMS CLEARANCE',
    displayTitle: '5. Awaiting Customs Clearance',
    stepBadge: 'Step 5',
    description: 'Under customs appraisal & duty assessment',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
    dotClass: 'bg-amber-500 animate-pulse'
  },
  {
    code: 'bd_warehouse_received',
    label: 'BD WAREHOUSE RECEIVED',
    displayTitle: '6. BD Warehouse Received',
    stepBadge: 'Step 6',
    description: 'Released from customs & sorted at Dhaka hub',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
    dotClass: 'bg-sky-500'
  },
  {
    code: 'payment_received',
    label: 'PAYMENT RECEIVED',
    displayTitle: 'Payment Received (Cleared)',
    stepBadge: 'Finance',
    description: 'Tariffs and handling charges settled in full',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    dotClass: 'bg-emerald-500'
  },
  {
    code: 'out_for_delivery',
    label: 'OUT FOR DELIVERY',
    displayTitle: '7. Out for Delivery',
    stepBadge: 'Step 7',
    description: 'Courier van dispatched for doorstep delivery',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100',
    dotClass: 'bg-orange-500'
  },
  {
    code: 'delivered',
    label: 'DELIVERED',
    displayTitle: '8. Delivered',
    stepBadge: 'Done',
    description: 'Delivered to consignee with proof of delivery',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100',
    dotClass: 'bg-emerald-600'
  }
];

export interface StatusQuickDropdownProps {
  shipmentId?: string;
  currentStatus?: string;
  onUpdate: (firstArg: string, secondArg: string) => Promise<void> | void;
  openUpward?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function StatusQuickDropdown({
  shipmentId,
  currentStatus = 'PURCHASED CHINA WAREHOUSE',
  onUpdate,
  openUpward = false,
  disabled = false,
  className = ''
}: StatusQuickDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const normalized = normalizeStatusCode(currentStatus);
  const activeConfig =
    STATUS_DROPDOWN_OPTIONS.find((opt) => opt.code === normalized) ||
    STATUS_DROPDOWN_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = async (config: StatusItemConfig) => {
    if (config.code === normalized && currentStatus === config.label) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    setIsOpen(false);
    try {
      if (shipmentId) {
        await onUpdate(shipmentId, config.label);
      } else {
        await onUpdate(config.label, config.code);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || isUpdating}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs transition-colors cursor-pointer select-none text-left whitespace-nowrap ${
          activeConfig.badgeClass
        } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
        title="Click to change order status directly"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeConfig.dotClass}`} />
        <span className="truncate max-w-[145px] sm:max-w-[180px]">
          {currentStatus || activeConfig.label}
        </span>
        <svg
          className={`w-2.5 h-2.5 text-current opacity-60 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-72 rounded-xl bg-white shadow-2xl border border-slate-200 py-1 text-xs text-slate-800 left-0 ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
          style={{ minWidth: '270px' }}
        >
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/80 rounded-t-xl">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C]" />
              Update Shipment Stage
            </span>
            <span className="font-mono text-[9px] text-slate-400">9 stages</span>
          </div>

          <div className="max-h-68 overflow-y-auto py-1 divide-y divide-slate-50">
            {STATUS_DROPDOWN_OPTIONS.map((config) => {
              const isSelected = config.code === normalized;
              return (
                <button
                  key={config.code}
                  type="button"
                  onClick={() => handleSelect(config)}
                  className={`w-full px-3 py-2 text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-red-50/60 text-slate-900 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${config.dotClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs truncate ${
                          isSelected ? 'font-bold text-slate-900' : 'font-medium'
                        }`}
                      >
                        {config.displayTitle}
                      </span>
                      {isSelected ? (
                        <svg
                          className="w-3.5 h-3.5 text-[#EA1D2C] shrink-0 ml-1.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : config.stepBadge ? (
                        <span className="text-[9px] font-mono px-1 rounded bg-slate-100 text-slate-500 shrink-0 ml-1">
                          {config.stepBadge}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 font-normal">
                      {config.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
