import React, { useState, useRef, useEffect } from 'react';

export interface ReferenceSelectOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
  chinaTracking?: string;
  orderId?: string;
  trackingCode?: string;
  shippingMark?: string;
  phone?: string;
}

export interface ReferenceSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ReferenceSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  searchable?: boolean;
}

/**
 * Calculate match score with highest priority given to China Domestic Tracking (Col D)
 */
function getOptionScore(opt: ReferenceSelectOption, rawQuery: string): number {
  const q = rawQuery.trim().toUpperCase();
  if (!q) return 0;
  const qClean = q.replace(/[^A-Z0-9]/g, '');

  // 1. TOP PRIORITY (Score 8000-10000): China Domestic Tracking (SF/ZTO) (Col D)
  const cn = (opt.chinaTracking || '').trim().toUpperCase();
  const cnClean = cn.replace(/[^A-Z0-9]/g, '');
  if (cn) {
    if (cn === q) return 10000;
    if (cnClean && qClean && cnClean === qClean) return 9500;
    if (qClean.length >= 4 && cnClean && cnClean.endsWith(qClean)) return 9200;
    if (qClean.length >= 4 && cnClean && (cnClean.includes(qClean) || qClean.includes(cnClean))) return 8500;
    if (q.length >= 4 && cn.includes(q)) return 8000;
  }

  // 2. PRIORITY 2 (Score 6000-7500): Order ID (Col A, e.g. GOS-00001, 00001, 1)
  const oid = (opt.orderId || '').trim().toUpperCase();
  const oidClean = oid.replace(/[^A-Z0-9]/g, '');
  if (oid) {
    if (oid === q) return 7500;
    if (oidClean && qClean && oidClean === qClean) return 7200;
    const numQ = q.match(/(\d+)$/);
    const numOid = oid.match(/(\d+)$/);
    if (numQ && numOid && parseInt(numQ[1], 10) === parseInt(numOid[1], 10)) {
      if (/^\d+$/.test(q) || q.startsWith('GOS') || q.startsWith('POS')) {
        return 7000;
      }
    }
    if (q.length >= 3 && oid.includes(q)) return 6500;
  }

  // 3. PRIORITY 3 (Score 4500-5500): Consignment Tracking Code (GOSH-XXXX) or Waybill
  const tc = (opt.trackingCode || '').trim().toUpperCase();
  if (tc) {
    if (tc === q) return 5500;
    if (q.length >= 4 && tc.includes(q)) return 5000;
  }

  // 4. PRIORITY 4 (Score 3500-4200): Shipping Mark (Col I)
  const mark = (opt.shippingMark || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (mark && qClean) {
    if (mark === qClean) return 4200;
    if (qClean.length >= 3 && (mark.includes(qClean) || qClean.includes(mark))) return 3800;
  }

  // 5. PRIORITY 5 (Score 2500-3200): Customer Phone / WhatsApp
  const phone = (opt.phone || '').replace(/\D/g, '');
  const qPhone = q.replace(/\D/g, '');
  if (phone && qPhone.length >= 4) {
    if (phone === qPhone || phone.endsWith(qPhone)) return 3200;
    if (phone.includes(qPhone)) return 2800;
  }

  // 6. PRIORITY 6 (Score 1500-2200): Label match (Customer Name, Product, etc.)
  const label = opt.label.toUpperCase();
  if (label.includes(q)) return 2000;

  // 7. PRIORITY 7 (Score 1000): Description match
  const desc = (opt.description || '').toUpperCase();
  if (desc.includes(q)) return 1200;

  // 8. PRIORITY 8 (Score 500): Badge match
  const badge = (opt.badge || '').toUpperCase();
  if (badge.includes(q)) return 800;

  return 0;
}

/**
 * Universal GoShipping ReferenceSelect Dropdown:
 * - Compact, sleek trigger with refined margin/padding & slightly smaller typography
 * - Floating rounded-xl menu card with elevation and soft shadow
 * - Selected item displays dark circular checkmark badge (● with white ✓)
 * - Optional micro-badge tag per option (e.g. "Air", "Sea", "Express", "BD", "MY")
 * - Dark mode compliant and accessible keyboard navigation
 * - Scrollable with compact items (py-1.5) and optional search filter
 */
export function ReferenceSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  className = '',
  disabled = false,
  size = 'md',
  searchable = false
}: ReferenceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      if (searchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, searchable]);

  const selectedOption =
    options.find((opt) => opt.value.toLowerCase() === value.toLowerCase()) ||
    options.find((opt) => opt.value === value) ||
    options.find((opt) => opt.label.toLowerCase() === value.toLowerCase());

  const filteredOptions = searchQuery.trim()
    ? options
        .map((opt) => ({ opt, score: getOptionScore(opt, searchQuery) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.opt)
    : options;

  // Sleek compact dimensions: reduced padding and slightly smaller, sharper font
  const heightClasses =
    size === 'sm'
      ? 'h-[30px] px-2 text-[11px]'
      : size === 'lg'
      ? 'h-10 px-3 text-xs'
      : 'h-[34px] px-2.5 text-xs';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full ${heightClasses} rounded-lg border bg-white dark:bg-slate-900 flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100 shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 focus:outline-none transition-none cursor-pointer ${
          isOpen
            ? 'border-slate-900 dark:border-slate-100 ring-1 ring-slate-900 dark:ring-slate-100'
            : 'border-slate-300 dark:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800' : ''}`}
      >
        <span className="truncate pr-1 text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform duration-150 shrink-0 ml-1.5 ${
            isOpen ? 'rotate-180 text-slate-900 dark:text-white' : ''
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Floating Dropdown Menu Card */}
      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+3px)] w-full min-w-[200px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-1 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Optional Search Filter for long lists */}
          {(searchable || options.length > 8) && (
            <div className="p-1.5 border-b border-slate-100 dark:border-slate-800">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/40">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500 text-center">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected =
                  opt.value.toLowerCase() === value.toLowerCase() ||
                  opt.value === value ||
                  opt.label.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs cursor-pointer select-none transition-none ${
                      isSelected
                        ? 'text-slate-900 dark:text-white font-semibold bg-slate-100/80 dark:bg-slate-800/80'
                        : 'text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shrink-0">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <span className="truncate text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {opt.description}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-[#334155] dark:bg-slate-600 flex items-center justify-center shrink-0 ml-1.5 shadow-2xs">
                        <svg
                          className="w-2.5 h-2.5 text-white stroke-[2.8]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReferenceSelect;
