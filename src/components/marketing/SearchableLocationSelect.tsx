import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption {
  label: string;
  value: string;
  code?: string;
  badge?: string;
  description?: string;
  popular?: boolean;
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  required?: boolean;
}

export default function SearchableLocationSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select location...',
  searchPlaceholder = 'Search city, port, or hub code...',
  allowCustom = true,
  required = true
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q) ||
      (opt.code && opt.code.toLowerCase().includes(q)) ||
      (opt.description && opt.description.toLowerCase().includes(q)) ||
      (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  });

  const hasExactMatch = options.some(
    (opt) => opt.value.toLowerCase() === searchTerm.toLowerCase().trim() || opt.label.toLowerCase() === searchTerm.toLowerCase().trim()
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getBadgeStyle = (badge?: string) => {
    switch (badge) {
      case 'WAREHOUSE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'AIR HUB':
        return 'bg-sky-50 text-sky-700 border-sky-300';
      case 'SEA PORT':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'DOOR DELIVERY':
        return 'bg-rose-50 text-rose-700 border-rose-300';
      case 'EPZ':
        return 'bg-purple-50 text-purple-700 border-purple-300';
      case 'LAND PORT':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const selectedOption = options.find((opt) => opt.value === value || opt.label === value);

  return (
    <div className="relative font-['Inter',sans-serif]" ref={containerRef}>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm('');
        }}
        className={`w-full h-10 px-3 rounded-md border bg-white text-left text-sm flex items-center justify-between transition-none cursor-pointer ${
          isOpen
            ? 'border-[#EA1D2C] ring-2 ring-[#EA1D2C]/15 shadow-xs'
            : 'border-slate-300 hover:border-slate-400'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {selectedOption ? (
            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
              {selectedOption.label}
            </span>
          ) : value ? (
            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">{value}</span>
          ) : (
            <span className="text-slate-400 font-normal text-xs sm:text-sm truncate">{placeholder}</span>
          )}
        </div>

        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 ${isOpen ? 'rotate-180 text-[#EA1D2C]' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] sm:min-w-[340px] max-w-[420px] bg-white rounded-lg border border-slate-200 shadow-md overflow-hidden left-0 top-full">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative flex items-center">
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredOptions.length > 0) {
                      handleSelect(filteredOptions[0].value);
                    } else if (allowCustom && searchTerm.trim()) {
                      handleSelect(searchTerm.trim());
                    }
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs py-1">
            {filteredOptions.map((opt) => {
              const isSelected = opt.value === value || opt.label === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between gap-2 hover:bg-slate-50 transition-none cursor-pointer ${
                    isSelected ? 'bg-slate-100/90 font-semibold' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-slate-900 ${isSelected ? 'font-bold text-[#EA1D2C]' : 'font-medium'}`}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getBadgeStyle(opt.badge)}`}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    {opt.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {opt.description}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 text-[#EA1D2C] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}

            {/* Custom Entry Option */}
            {allowCustom && searchTerm.trim() && !hasExactMatch && (
              <button
                type="button"
                onClick={() => handleSelect(searchTerm.trim())}
                className="w-full text-left px-3.5 py-2.5 bg-red-50/50 hover:bg-red-50 text-slate-800 flex items-center justify-between gap-2 border-t border-slate-100 transition-none cursor-pointer"
              >
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block">Use custom location:</span>
                  <span className="font-bold text-[#EA1D2C] text-xs truncate block">
                    "{searchTerm.trim()}"
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EA1D2C] text-white flex-shrink-0 whitespace-nowrap">
                  Select ↵
                </span>
              </button>
            )}

            {filteredOptions.length === 0 && (!allowCustom || !searchTerm.trim()) && (
              <div className="py-6 text-center text-slate-400 text-xs">
                No matching locations found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden input to ensure form submission and required constraint if JS is active */}
      <input type="hidden" name={id} value={value} required={required} />
    </div>
  );
}
