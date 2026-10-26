import React, { useState, useRef, useEffect } from 'react';

export interface ReferenceSelectOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
}

export interface ReferenceSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ReferenceSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Dropdown selector styled exactly to reference:
 * - Clean trigger with text and chevron down
 * - Floating rounded menu card with soft shadow
 * - Selected item displays a solid dark circular checkmark badge (● with white ✓)
 * - Click-outside to close
 */
export function ReferenceSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  disabled = false,
}: ReferenceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption =
    options.find((opt) => opt.value.toLowerCase() === value.toLowerCase()) ||
    options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10 px-3.5 rounded-xl border bg-white flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs hover:border-slate-400 focus:outline-none transition-none cursor-pointer ${
          isOpen ? 'border-slate-800 ring-1 ring-slate-800' : 'border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform duration-150 shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-slate-900' : ''
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+6px)] w-full min-w-[190px] bg-white rounded-2xl border border-slate-200/90 shadow-xl z-40 py-1.5 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          {options.map((opt) => {
            const isSelected =
              opt.value.toLowerCase() === value.toLowerCase() || opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-xs sm:text-sm cursor-pointer select-none transition-none ${
                  isSelected
                    ? 'text-slate-900 font-bold bg-slate-50/60'
                    : 'text-slate-700 font-semibold hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate">{opt.label}</span>
                  {opt.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {opt.badge}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <span className="w-4.5 h-4.5 rounded-full bg-[#334155] flex items-center justify-center shrink-0 ml-2.5">
                    <svg
                      className="w-2.5 h-2.5 text-white stroke-[2.5]"
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
          })}
        </div>
      )}
    </div>
  );
}

export default ReferenceSelect;
