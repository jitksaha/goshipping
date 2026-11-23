import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Testimonial } from '../../data/testimonials';

export interface TestimonialRecord extends Testimonial {
  avatarUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
}

interface Props {
  initialTestimonials?: TestimonialRecord[];
}

export default function HomeReviewsSliderIsland({ initialTestimonials = [] }: Props) {
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>(initialTestimonials);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isHoveredRef = useRef(false);

  // Sync fresh testimonials from API on mount and when window gains focus
  const fetchFreshTestimonials = useCallback(async () => {
    try {
      const res = await fetch('/api/testimonials');
      const data = await res.json();
      if (data.success && Array.isArray(data.testimonials) && data.testimonials.length > 0) {
        setTestimonials(data.testimonials);
      }
    } catch {
      // Graceful fallback to initial SSR data
    }
  }, []);

  useEffect(() => {
    fetchFreshTestimonials();

    // Re-fetch when user refocuses tab to catch newly published admin reviews
    const handleFocus = () => {
      fetchFreshTestimonials();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchFreshTestimonials]);

  // Keep hover state in ref for animation frame callback without stale closures
  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    setIsPaused(false);
  };

  // Ultra-smooth, slow continuous horizontal scroller with zero vertical movement
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || testimonials.length === 0) return;

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let lastTime = performance.now();
    const speed = 0.55; // Pixels per frame (~33-36px per second: calm, elegant, readable)

    const step = (time: number) => {
      if (!isHoveredRef.current && el) {
        // Half-width seamless loop point (since we render items duplicated)
        const halfWidth = el.scrollWidth / 2;
        if (el.scrollLeft >= halfWidth) {
          el.scrollLeft -= halfWidth;
        } else {
          el.scrollLeft += speed;
        }
      }
      lastTime = time;
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [testimonials]);

  // Manual smooth scroll navigation buttons
  const scrollManual = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = 390; // Card width + gap
    el.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth'
    });
  };

  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  // Duplicate items for infinite continuous scroller loop
  const displayItems = [...testimonials, ...testimonials];

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-white border-b border-slate-200 overflow-hidden font-['Inter',sans-serif]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 sm:mb-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          {/* Section Titles */}
          <div>
            <span className="text-xs font-bold text-[#EA1D2C] uppercase tracking-wider block mb-2 font-mono">
              /CLIENT FEEDBACK &amp; REVIEWS
            </span>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-[#11181E] tracking-tight leading-[1.12] font-['Manrope',sans-serif]">
              What Our Importers Say.
            </h2>
            <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed font-normal mt-2 max-w-2xl">
              Real verified experiences from Bangladeshi merchants, e-commerce sellers, and commercial importers relying on GoShipping express cargo.
            </p>
          </div>

          {/* Controls: Navigation Arrows & Auto-Scroll Status */}
          <div className="flex items-center gap-3 self-start lg:self-end shrink-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600 select-none">
              <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
              <span>{isPaused ? 'Paused on hover' : 'Auto-scrolling'}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollManual('left')}
                className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-none cursor-pointer shadow-2xs hover:border-slate-300"
                aria-label="Previous Reviews"
                title="Scroll Left"
              >
                <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scrollManual('right')}
                className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-none cursor-pointer shadow-2xs hover:border-slate-300"
                aria-label="Next Reviews"
                title="Scroll Right"
              >
                <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Smooth Horizontal Rail: Strict uniform height to prevent ANY vertical up/down jumping */}
      <div
        className="relative w-full overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseEnter}
        onTouchEnd={handleMouseLeave}
      >
        {/* Subtle Edge Gradients for polished fade-out at viewport boundary */}
        <div className="absolute left-0 inset-y-0 w-8 sm:w-16 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 inset-y-0 w-8 sm:w-16 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />

        {/* Scrollable Container with fixed vertical boundary */}
        <div
          ref={scrollRef}
          className="flex items-stretch gap-5 sm:gap-6 px-4 sm:px-6 overflow-x-auto overflow-y-hidden scroll-smooth select-none cursor-grab active:cursor-grabbing no-scrollbar"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {displayItems.map((t, idx) => (
            <div
              key={`${t.id}-${idx}`}
              className="w-[310px] sm:w-[380px] h-[255px] min-h-[255px] max-h-[255px] p-5 sm:p-6 rounded-xl bg-slate-50 border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/90 shrink-0 flex flex-col justify-between shadow-2xs transition-colors text-left"
            >
              {/* Card Top: Stars & Verified Badge */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: t.rating || 5 }).map((_, sIdx) => (
                      <svg key={sIdx} className="w-4 h-4 fill-current shrink-0" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Verified Importer</span>
                  </span>
                </div>

                {/* Card Middle: Quote with line-clamp to ensure constant height */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal line-clamp-4">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              {/* Card Bottom: Client Info & Category Tag */}
              <div className="pt-3.5 border-t border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  {t.avatarUrl ? (
                    <img
                      src={t.avatarUrl}
                      alt={t.clientName}
                      className="w-9 h-9 rounded-md object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-[#EA1D2C] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {t.initial || (t.clientName ? t.clientName.charAt(0).toUpperCase() : 'C')}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {t.clientName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {t.roleOrCompany || t.location || 'Verified Business Client'}
                    </div>
                  </div>
                </div>

                {t.tag && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
                    {t.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
