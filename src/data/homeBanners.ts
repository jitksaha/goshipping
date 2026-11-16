export interface HeroBanner {
  id: string;
  badge: string;
  badgeColor?: string;
  headlineBengali: string;
  headlineAccent: string;
  subtitle: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  features: string[];
  imageUrl: string;
  imageAlt: string;
  taglineSmall?: string;
}

export const HOME_BANNERS: HeroBanner[] = [
  {
    id: 'sourcing-hero',
    badge: 'CHINA SOURCING & LOGISTICS',
    headlineBengali: 'চীন থেকে সরাসরি ফ্যাক্টরি রেটে পণ্য সোর্সিং',
    headlineAccent: '৫০০০+ ভেরিফায়েড ফ্যাক্টরি ও বিশ্বস্ত সাপ্লায়ার নেটওয়ার্ক',
    subtitle: 'গুয়াংজু হোলসেল মার্কেট ও ফ্যাক্টরি থেকে সরাসরি পারচেজ সাপোর্ট, কোয়ালিটি যাচাই, কাস্টমস ক্লিয়ারেন্স এবং ডোর-টু-ডোর ডেলিভারি—সবকিছু এক ছাদের নিচে GoShipping!',
    primaryCtaText: 'সোর্সিং শুরু করুন →',
    primaryCtaLink: '/sourcing#sourcing-form',
    secondaryCtaText: 'শিপিং রেট জানুন',
    secondaryCtaLink: '/quote',
    features: [
      '৫০০০+ ভেরিফায়েড চাইনিজ ফ্যাক্টরি',
      'সরাসরি প্রকিউরমেন্ট ও কোয়ালিটি চেকিং',
      'গুয়াংজু, ইইউ ও শেনঝেন ওয়্যারহাউস'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1600&q=85',
    imageAlt: 'Go Shipping China Sourcing & Cargo Operations Hub',
    taglineSmall: 'Guangzhou Wholesale Market · Purchase Support · Verified Factories'
  },
  {
    id: 'freight-hero',
    badge: 'AIR & SEA FREIGHT CORRIDOR',
    headlineBengali: 'চীন থেকে বাংলাদেশে দ্রুততম কার্গো সার্ভিস',
    headlineAccent: 'এয়ার কার্গোতে ৭–১৪ দিন, সি শিপমেন্টে সবচেয়ে সাশ্রয়ী খরচ।',
    subtitle: '১৬৮৮, তাওবাও বা যেকোনো চাইনিজ ফ্যাক্টরি থেকে পণ্য এনে সরাসরি বাংলাদেশে ডোর-টু-ডোর ডেলিভারি।',
    primaryCtaText: 'রেট ক্যালকুলেটর →',
    primaryCtaLink: '/quote',
    secondaryCtaText: 'লাইভ ট্র্যাকিং',
    secondaryCtaLink: '/tracking',
    features: [
      'দ্রুত এয়ার কার্গো (৭–১৪ দিন)',
      'সাশ্রয়ী সি কার্গো (কেজি বা সিবিএম)',
      'কোনো লুকানো শুল্ক বা পোর্ট চার্জ নেই'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=85',
    imageAlt: 'GoShipping Modern Warehouse Logistics',
    taglineSmall: 'C&F License · Customs Pre-Assessment · Live Telemetry'
  }
];
