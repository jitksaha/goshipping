import React, { useState, useEffect, useRef } from 'react';
import { HOME_BANNERS, type HeroBanner } from '../../data/homeBanners';

export default function HomeHeroBannerIsland({ initialBanners }: { initialBanners?: HeroBanner[] }) {
  const [banners, setBanners] = useState<HeroBanner[]>(
    initialBanners && initialBanners.length > 0 ? initialBanners : HOME_BANNERS
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  // Direct Image Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState('sr.shaishob@gmail.com');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/banners')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.banners) && data.banners.length > 0) {
          setBanners(data.banners);
        }
      })
      .catch(() => {});
  }, []);

  const safeBanners = banners.length > 0 ? banners : HOME_BANNERS;
  const current = safeBanners[currentIndex % safeBanners.length] || safeBanners[0];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % safeBanners.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + safeBanners.length) % safeBanners.length);
  };

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    setSelectedFile(file);
    setUploadError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const executeUpload = async () => {
    if (!selectedFile) {
      setUploadError('অনুগ্রহ করে একটি ছবি নির্বাচন করুন।');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('bannerId', current.id);

      const res = await fetch('/api/admin/banners/upload', {
        method: 'POST',
        body: formData
      });

      if (res.status === 403 || res.status === 401) {
        setNeedsAuth(true);
        setUploading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload banner image');
      }

      // Update state immediately
      setBanners((prev) =>
        prev.map((b) => (b.id === current.id ? { ...b, imageUrl: data.url } : b))
      );
      setUploadSuccess(true);
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess(false);
        setSelectedFile(null);
        setPreviewUrl(null);
        setNeedsAuth(false);
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || 'ব্যানার আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploading(false);
    }
  };

  const handleQuickLoginAndUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setUploadError(null);
    try {
      const authRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const authData = await authRes.json();
      if (!authRes.ok) {
        throw new Error(authData.error || 'ভুল ইমেইল বা পাসওয়ার্ড');
      }
      setNeedsAuth(false);
      await executeUpload();
    } catch (err: any) {
      setUploadError(err.message || 'অথেন্টিকেশন ব্যর্থ হয়েছে');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="relative bg-white border-b border-slate-200 overflow-hidden font-['Inter',sans-serif]">
      {/* Banner Indicator Bar on Top if multiple banners */}
      {safeBanners.length > 1 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EA1D2C] animate-pulse" />
            <span className="font-mono font-bold text-slate-700 text-[11px] uppercase tracking-wider hidden sm:inline">
              {current.badge}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {safeBanners.map((b, idx) => (
              <button
                key={b.id || idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 transition-all rounded-full cursor-pointer ${
                  idx === currentIndex % safeBanners.length ? 'w-6 bg-[#EA1D2C]' : 'w-2 bg-slate-200 hover:bg-slate-300'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={handlePrev}
                className="w-6 h-6 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center text-xs transition-none cursor-pointer"
                title="Previous Banner"
              >
                ‹
              </button>
              <button
                onClick={handleNext}
                className="w-6 h-6 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center text-xs transition-none cursor-pointer"
                title="Next Banner"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Banner Body inspired by img_01.png */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Bengali High-Converting Copy & Actions */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">
            
            {/* Category / Service Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#EA1D2C] text-xs font-bold font-mono tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C] animate-pulse" />
              <span>{current.badge}</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-1.5 sm:space-y-2">
              <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-extrabold text-[#11181E] tracking-tight leading-[1.2] font-['Noto_Sans_Bengali','Manrope',sans-serif]">
                {current.headlineBengali}
              </h1>
              <p className="text-base sm:text-xl font-bold text-[#EA1D2C] tracking-tight leading-snug font-['Noto_Sans_Bengali','Manrope',sans-serif]">
                {current.headlineAccent}
              </p>
            </div>

            {/* Subtitle Description */}
            <p className="text-xs sm:text-base text-slate-600 leading-relaxed font-normal max-w-2xl font-['Noto_Sans_Bengali','Inter',sans-serif]">
              {current.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
              <a
                href={current.primaryCtaLink}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 sm:py-3.5 rounded-lg bg-[#EA1D2C] text-white text-xs sm:text-sm font-bold hover:bg-[#D41523] active:bg-[#B91C1C] transition-colors shadow-md shadow-red-500/20 cursor-pointer min-h-[44px] font-['Noto_Sans_Bengali','Manrope',sans-serif]"
              >
                <span>{current.primaryCtaText}</span>
              </a>

              {current.secondaryCtaText && current.secondaryCtaLink && (
                <a
                  href={current.secondaryCtaLink}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors shadow-xs cursor-pointer min-h-[44px] font-['Noto_Sans_Bengali','Manrope',sans-serif]"
                >
                  <span>{current.secondaryCtaText}</span>
                </a>
              )}
            </div>

            {/* 3 Checkpoint Badges like img_01.png */}
            <div className="pt-4 border-t border-slate-200/80">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-700">
                {(current.features || []).map((feat) => (
                  <span key={feat} className="inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[#EA1D2C] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{feat}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Composition with Market/Cargo Frame & Fast-Track Box */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-xl group">
              <div className="aspect-[4/3] w-full relative overflow-hidden">
                <img
                  src={current.imageUrl}
                  alt={current.imageAlt}
                  className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                {/* Direct Image Upload Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(true);
                    setUploadError(null);
                    setNeedsAuth(false);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-4 left-4 bg-black/75 hover:bg-black/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-xs border border-white/20 shadow-md flex items-center gap-1.5 transition-all opacity-90 hover:opacity-100 cursor-pointer z-10"
                  title="ব্যানার ছবি সরাসরি আপলোড করুন"
                >
                  <svg className="w-3.5 h-3.5 text-[#FFDE00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>ব্যানার ছবি আপডেট</span>
                </button>

                {/* China Flag Badge Overlay */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xs border border-slate-200 px-3 py-1.5 rounded-full shadow-md flex items-center gap-2">
                  <span className="w-4 h-3 rounded-xs bg-[#DE2910] relative flex items-center justify-center text-[8px] text-[#FFDE00] font-black leading-none">
                    ★
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 font-mono">CHINA HUB</span>
                </div>

                {/* Stencil Label */}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-300">
                    {current.taglineSmall || 'Guangzhou · Yiwu · Shenzhen ⇄ Dhaka'}
                  </div>
                  <div className="text-base font-bold text-white mt-0.5 font-['Manrope']">
                    GoShipping Express Cargo
                  </div>
                </div>
              </div>
            </div>

            {/* Fast Track Floating Card */}
            <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200 shadow-md">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#EA1D2C] animate-pulse" />
                  <span>দ্রুত পার্সেল ট্র্যাকিং (Live Track)</span>
                </span>
                <a href="/tracking" className="text-[#EA1D2C] text-[11px] hover:underline font-semibold">
                  Full Portal →
                </a>
              </div>
              <form action="/tracking" method="GET" className="flex gap-2">
                <input
                  type="text"
                  name="code"
                  placeholder="GOSH-XXXX ট্র্যাকিং কোড বা ফোন..."
                  className="flex-1 h-9 px-3 rounded-md border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA1D2C]"
                  required
                />
                <button
                  type="submit"
                  className="h-9 px-4 rounded-md bg-[#EA1D2C] text-white font-bold text-xs hover:bg-[#D41523] transition-none cursor-pointer shrink-0"
                >
                  Track
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>

      {/* Direct Banner Image Upload Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#EA1D2C]" />
                  <span>হিরো ব্যানার ছবি সরাসরি আপলোড</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  স্লাইড: {current.badge || current.title} ({current.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setUploadError(null);
                  setNeedsAuth(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold transition-none cursor-pointer"
                title="বন্ধ করুন"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {uploadSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-3">
                  <svg className="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>ব্যানার ছবি সফলভাবে আপলোড ও আপডেট করা হয়েছে!</span>
                </div>
              ) : (
                <>
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileChange(e.target.files?.[0])}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                  />

                  {/* Dropzone / Upload Area */}
                  {!previewUrl ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileChange(file);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                        isDragging
                          ? 'border-[#EA1D2C] bg-red-50/50'
                          : 'border-slate-300 hover:border-[#EA1D2C] bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-12 h-12 mx-auto rounded-full bg-red-100 text-[#EA1D2C] flex items-center justify-center mb-3">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        ডিভাইস থেকে ছবি আপলোড করতে ক্লিক করুন
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        অথবা ছবিটি ড্র্যাগ করে এখানে এনে ছেড়ে দিন (PNG, JPG, WebP)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-[16/9] max-h-52">
                        <img
                          src={previewUrl}
                          alt="New Banner Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl(null);
                          }}
                          className="absolute top-2 right-2 bg-black/75 hover:bg-black text-white text-xs px-2.5 py-1 rounded-md cursor-pointer"
                        >
                          ✕ পরিবর্তন করুন
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                        <span className="font-mono truncate max-w-[260px]">{selectedFile?.name}</span>
                        <span>{selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}</span>
                      </div>
                    </div>
                  )}

                  {/* Admin Auth Notice / Form if Session not signed in */}
                  {needsAuth && (
                    <form
                      onSubmit={handleQuickLoginAndUpload}
                      className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3"
                    >
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                          ব্যানার পরিবর্তনের জন্য অ্যাডমিন পারমিশন প্রয়োজন। অনুগ্রহ করে আপনার অ্যাডমিন ক্রেডেনশিয়াল দিন:
                        </p>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="Admin Email"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA1D2C] bg-white"
                          required
                        />
                        <input
                          type="password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="Admin Password"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA1D2C] bg-white"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-2.5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {authLoading ? 'যাচাই করা হচ্ছে...' : 'লগইন করে আপলোড নিশ্চিত করুন'}
                      </button>
                    </form>
                  )}

                  {/* Error Notification */}
                  {uploadError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                      {uploadError}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            {!uploadSuccess && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setUploadError(null);
                    setNeedsAuth(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-none cursor-pointer"
                >
                  বাতিল
                </button>
                {!needsAuth && (
                  <button
                    type="button"
                    onClick={executeUpload}
                    disabled={!selectedFile || uploading}
                    className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-none cursor-pointer flex items-center gap-2"
                  >
                    {uploading && (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    <span>{uploading ? 'আপলোড হচ্ছে...' : 'আপলোড ও ব্যানার আপডেট'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
