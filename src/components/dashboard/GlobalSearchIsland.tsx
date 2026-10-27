import React, { useState, useEffect, useRef } from 'react';

interface Props {
  portalType?: 'customer' | 'admin';
}

interface SearchItem {
  id: string;
  category: 'shipment' | 'quote' | 'page' | 'action';
  title: string;
  subtitle: string;
  badge?: string;
  tabKey?: string;
  trackingCode?: string;
  href?: string;
}

export default function GlobalSearchIsland({ portalType = 'customer' }: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shipments, setShipments] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine keyboard modifier (Mac: ⌘, Windows/Linux: Ctrl)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? '⌘ F' : 'Ctrl F';

  // Fetch live consignments and quotes for search index
  useEffect(() => {
    let isMounted = true;
    const fetchSearchData = async () => {
      try {
        const [resShipments, resQuotes] = await Promise.all([
          fetch('/api/shipments').then((r) => r.json()).catch(() => ({ shipments: [] })),
          fetch('/api/quotes').then((r) => r.json()).catch(() => ({ quotes: [] }))
        ]);
        if (isMounted) {
          if (resShipments.shipments) setShipments(resShipments.shipments);
          if (resQuotes.quotes) setQuotes(resQuotes.quotes);
        }
      } catch (err) {
        // Fallback gracefully to default items
      }
    };
    fetchSearchData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Global hotkey: ⌘F, Ctrl+F, ⌘K, Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Base pages and quick navigation items
  const customerPages: SearchItem[] = [
    {
      id: 'page-overview',
      category: 'page',
      title: 'Overview',
      subtitle: 'Shipments, tracking & billing summary',
      badge: 'PAGE',
      tabKey: 'overview',
      href: '/dashboard?tab=overview'
    },
    {
      id: 'page-shipments',
      category: 'page',
      title: 'My Shipments',
      subtitle: 'Active and historical freight consignments',
      badge: 'PAGE',
      tabKey: 'shipments',
      href: '/dashboard?tab=shipments'
    },
    {
      id: 'page-tracking',
      category: 'page',
      title: 'Live Cargo Tracker',
      subtitle: 'Real-time waypoint telemetry & customs milestones',
      badge: 'TRACKING',
      tabKey: 'tracking',
      href: '/dashboard?tab=tracking'
    },
    {
      id: 'page-quotes',
      category: 'page',
      title: 'My Rate Quotes',
      subtitle: 'Itemized commercial quotations in BDT',
      badge: 'RATES',
      tabKey: 'quotes',
      href: '/dashboard?tab=quotes'
    },
    {
      id: 'page-calc',
      category: 'page',
      title: 'Ship for Me / Rate Calc',
      subtitle: 'Calculate shipping rates & book freight consignments',
      badge: 'BOOKING',
      tabKey: 'request-quote',
      href: '/dashboard?tab=request-quote'
    },
    {
      id: 'page-docs',
      category: 'page',
      title: 'Documents & Invoices',
      subtitle: 'Airway bills, bills of lading & tax invoices',
      badge: 'COMPLIANCE',
      tabKey: 'documents',
      href: '/dashboard?tab=documents'
    },
    {
      id: 'page-profile',
      category: 'page',
      title: 'Profile & Settings',
      subtitle: 'Corporate credentials, BIN number & contact info',
      badge: 'ACCOUNT',
      tabKey: 'settings',
      href: '/dashboard?tab=settings'
    },
    {
      id: 'act-new-booking',
      category: 'action',
      title: '+ New Freight Booking',
      subtitle: 'Request quotation & assign China warehouse mark',
      badge: 'ACTION',
      tabKey: 'request-quote',
      href: '/dashboard?tab=request-quote'
    }
  ];

  const adminPages: SearchItem[] = [
    {
      id: 'adm-overview',
      category: 'page',
      title: 'Dashboard Overview',
      subtitle: 'Global cargo operations & throughput metrics',
      badge: 'ADMIN',
      tabKey: 'overview',
      href: '/admin?tab=overview'
    },
    {
      id: 'adm-shipments',
      category: 'page',
      title: 'Shipments & Tracking',
      subtitle: 'Live multi-modal consignment management',
      badge: 'OPERATIONS',
      tabKey: 'shipments',
      href: '/admin?tab=shipments'
    },
    {
      id: 'adm-quotes',
      category: 'page',
      title: 'Rate Quotations',
      subtitle: 'Customer tariff calculation & issuance in BDT',
      badge: 'SALES',
      tabKey: 'quotes',
      href: '/admin?tab=quotes'
    },
    {
      id: 'adm-warehouses',
      category: 'page',
      title: 'China & BD Warehouses',
      subtitle: 'Guangzhou, Yiwu, Shenzhen & HSIA receiving hubs',
      badge: 'WAREHOUSES',
      tabKey: 'warehouses',
      href: '/admin?tab=warehouses'
    },
    {
      id: 'adm-customers',
      category: 'page',
      title: 'Customers & Importers',
      subtitle: 'Verified corporate accounts & importer registry',
      badge: 'MANAGEMENT',
      tabKey: 'customers',
      href: '/admin?tab=customers'
    },
    {
      id: 'adm-audit',
      category: 'page',
      title: 'Audit & Security Logs',
      subtitle: 'Immutable operations audit trail & telemetry events',
      badge: 'SECURITY',
      tabKey: 'audit',
      href: '/admin?tab=audit'
    }
  ];

  const baseItems = portalType === 'admin' ? adminPages : customerPages;

  // Build searchable items list
  const searchItems: SearchItem[] = [
    ...baseItems,
    ...shipments.map((s) => ({
      id: `shp-${s.id}`,
      category: 'shipment' as const,
      title: `${s.trackingNumber} · ${s.customerName}`,
      subtitle: `${s.customerName} · ${s.customerEmail || ''} · ${s.customerPhone || ''} · ${s.originCity} → ${s.destCity} · ${s.mode.toUpperCase()} (${s.status.replace(/_/g, ' ')})`,
      badge: s.mode.toUpperCase(),
      tabKey: portalType === 'admin' ? 'orders' : 'tracking',
      trackingCode: s.trackingNumber,
      href: portalType === 'admin' ? `/admin?tab=orders&search=${encodeURIComponent(s.trackingNumber)}` : `/dashboard?tab=tracking&code=${encodeURIComponent(s.trackingNumber)}`
    })),
    ...quotes.map((q) => {
      const amount = q.revisions?.[0]?.totalAmount;
      const amountText = amount ? ` · ৳${amount.toLocaleString()} BDT` : '';
      return {
        id: `qte-${q.id}`,
        category: 'quote' as const,
        title: `${q.quoteNumber} · ${q.guestName}`,
        subtitle: `${q.guestName} · ${q.guestEmail || ''} · ${q.guestPhone || ''} · ${q.originCity} → ${q.destCity}${amountText} · ${q.cargoDescription?.slice(0, 40) || ''}`,
        badge: 'QUOTE',
        tabKey: 'quotes',
        href: portalType === 'admin' ? `/admin?tab=quotes` : `/dashboard?tab=quotes`
      };
    })
  ];

  // Live filtering
  const qClean = query.trim().toLowerCase();
  const results = qClean
    ? searchItems.filter(
        (item) =>
          item.title.toLowerCase().includes(qClean) ||
          item.subtitle.toLowerCase().includes(qClean) ||
          (item.badge && item.badge.toLowerCase().includes(qClean))
      )
    : baseItems.slice(0, 6);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle item selection
  const handleSelect = (item: SearchItem) => {
    setIsOpen(false);
    setQuery('');

    // If currently on /dashboard
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
      if (item.href && !item.href.startsWith('/dashboard')) {
        window.location.href = item.href;
        return;
      }
      const targetTab = item.tabKey || 'overview';
      const url = new URL(window.location.href);
      url.searchParams.set('tab', targetTab);
      if (item.trackingCode) {
        url.searchParams.set('code', item.trackingCode);
      } else {
        url.searchParams.delete('code');
      }
      window.history.pushState({}, '', url.toString());

      // Dispatch custom events to coordinate dashboard island and sidebar
      window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { detail: targetTab }));
      window.dispatchEvent(new CustomEvent('dashboard-tab-changed', { detail: targetTab }));
      if (item.trackingCode) {
        window.dispatchEvent(new CustomEvent('select-tracking-code', { detail: { code: item.trackingCode } }));
      }
      return;
    }

    // If currently on /admin
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      if (item.href && !item.href.startsWith('/admin')) {
        window.location.href = item.href;
        return;
      }
      const targetTab = item.tabKey || 'overview';
      const url = new URL(window.location.href);
      url.searchParams.set('tab', targetTab);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { detail: targetTab }));
      window.dispatchEvent(new CustomEvent('dashboard-tab-changed', { detail: targetTab }));
      return;
    }

    // Default link navigation
    if (item.href) {
      window.location.href = item.href;
    }
  };

  // Keyboard navigation within results
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < results.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Bar Input */}
      <div className="relative flex items-center">
        <svg
          className="w-3.5 h-3.5 absolute left-3 text-slate-400 stroke-[2] pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          id="global-sidebar-search"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search shipments, quotes..."
          className="w-full h-8 pl-8 pr-12 text-xs rounded-lg border border-slate-200 bg-slate-50/70 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C]/20 transition-none outline-none font-medium"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            title="Clear search"
          >
            <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : (
          <span
            onClick={() => {
              inputRef.current?.focus();
              setIsOpen(true);
            }}
            className="absolute right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-slate-200/80 text-slate-600 border border-slate-300/60 cursor-pointer select-none"
            title="Press to search"
          >
            {shortcutLabel}
          </span>
        )}
      </div>

      {/* Dropdown Live Results Panel */}
      {isOpen && (
        <div className="absolute left-0 top-10 w-72 sm:w-80 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden text-xs">
          {/* Header indicator */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>{qClean ? `Results for "${qClean}"` : 'Quick Navigation & Shortcuts'}</span>
            <span className="font-mono text-slate-400 font-normal">ESC to close</span>
          </div>

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 p-1">
            {results.length > 0 ? (
              results.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-none flex items-start gap-2.5 cursor-pointer ${
                      isSelected ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {/* Category Icon */}
                    <div className="mt-0.5 shrink-0 text-slate-500">
                      {item.category === 'shipment' ? (
                        <svg className="w-3.5 h-3.5 stroke-[2] text-[#EA1D2C]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="m7.5 4.27 9 5.15" />
                          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                        </svg>
                      ) : item.category === 'quote' ? (
                        <svg className="w-3.5 h-3.5 stroke-[2] text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      ) : item.category === 'action' ? (
                        <svg className="w-3.5 h-3.5 stroke-[2] text-[#EA1D2C]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 stroke-[2] text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-slate-900 truncate font-mono">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono tracking-tight shrink-0 ${
                              item.badge === 'AIR'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : item.badge === 'SEA'
                                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                : item.badge === 'ROAD'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : item.badge === 'QUOTE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500">No records found for "{query}"</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (window.location.pathname.startsWith('/dashboard')) {
                      window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { detail: 'tracking' }));
                    } else {
                      window.location.href = `/tracking?code=${encodeURIComponent(query)}`;
                    }
                  }}
                  className="mt-2 text-xs font-semibold text-[#EA1D2C] hover:underline block mx-auto"
                >
                  Track "{query}" in Cargo Tracker →
                </button>
              </div>
            )}
          </div>

          {/* Footer tips */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
        </div>
      )}
    </div>
  );
}
