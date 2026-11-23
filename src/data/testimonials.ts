export interface Testimonial {
  id: string;
  clientName: string;
  roleOrCompany: string;
  location: string;
  quote: string;
  rating: number;
  initial: string;
  tag?: string;
  date?: string;
  avatarUrl?: string;
}

/**
 * GoShipping Verified Client Feedback & Testimonials
 * ---------------------------------------------------
 * Managed dynamically via Admin Panel > Testimonials (/admin?tab=testimonials)
 * These defaults serve as verified baseline reviews if store is empty.
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't-1',
    clientName: 'Tanvir Ahmed',
    roleOrCompany: 'Managing Director, Horizon Apparels Ltd',
    location: 'Savar EPZ, Dhaka',
    quote: 'চীনের গুয়াংজু ওয়্যারহাউসে ফেব্রিক ও এক্সেসরিজ পৌঁছে দেওয়ার ৭ দিনের মধ্যেই এয়ারে ঢাকায় হাতে পেয়েছি। কাস্টমস হ্যান্ডলিং এবং প্রতি ধাপে লাইভ ট্র্যাকিং আপডেট একদম নির্ভরযোগ্য ছিল।',
    rating: 5,
    initial: 'T',
    tag: 'Air Cargo Importer',
    date: 'November 2026'
  },
  {
    id: 't-2',
    clientName: 'Mahmudul Hasan',
    roleOrCompany: 'Founder, GadgetXpress Bangladesh',
    location: 'Mirpur DOHS, Dhaka',
    quote: '১৬৮৮ এবং তাওবাও থেকে বিভিন্ন সেলারের মাল গুয়াংজু ওয়্যারহাউসে কনসলিডেশন করে এক চালানে পাঠিয়ে দিয়েছে। কোনো হিডেন পোর্ট চার্জ ছাড়া পুরো ডোর-টু-ডোর ডেলিভারি পেয়েছি।',
    rating: 5,
    initial: 'M',
    tag: 'E-commerce Seller',
    date: 'November 2026'
  },
  {
    id: 't-3',
    clientName: 'Shamim Reza',
    roleOrCompany: 'Proprietor, Bengal Machinery Tools',
    location: 'Chittagong Seaport Corridor',
    quote: 'সি শিপমেন্টে হেভি কন্টেইনার আনার ক্ষেত্রে পার সিবিএম (Per CBM) রেট খুব সাশ্রয়ী ছিল। চট্টগ্রাম সিএফএস থেকে নির্বিঘ্নে এবং সঠিক সময়ে মালামাল ডেলিভারি পেয়েছি।',
    rating: 5,
    initial: 'S',
    tag: 'Sea Freight Importer',
    date: 'November 2026'
  },
  {
    id: 't-4',
    clientName: 'Farhana Yasmin',
    roleOrCompany: 'Founder, Chic Trend Boutique',
    location: 'Banani, Dhaka',
    quote: 'চায়না থেকে উইমেন্স ফ্যাশন কালেকশন সোর্সিং ও ডেলিভারিতে গো-শিপিং চমৎকার সার্ভিস দিচ্ছে। প্রতি ব্যাচের কার্গো ওজন ও ফ্রেইট রেট স্বচ্ছ এবং হ্যান্ডলিং অত্যন্ত যত্নশীল।',
    rating: 5,
    initial: 'F',
    tag: 'Fashion Retailer',
    date: 'November 2026'
  },
  {
    id: 't-5',
    clientName: 'Engr. Asif Karim',
    roleOrCompany: 'Operations Lead, Apex Industrial Solutions',
    location: 'Tongi, Gazipur',
    quote: 'আমাদের টেক্সটাইল কারখানার স্পেয়ার পার্টস ইমার্জেন্সি এয়ার ফ্রেইটে ৫-৭ দিনে কোনো রকম জটিলতা ছাড়াই ছাড়িয়ে দিয়েছে। বিলিং এবং কমার্শিয়াল ইনভয়েস সিস্টেম খুবই নিখুঁত।',
    rating: 5,
    initial: 'A',
    tag: 'Industrial Importer',
    date: 'November 2026'
  },
  {
    id: 't-6',
    clientName: 'Rashedul Islam',
    roleOrCompany: 'CEO, Smart Gadget Hub',
    location: 'Elephant Road, Dhaka',
    quote: 'ইলেকট্রনিক্স এক্সেসরিজ আনার জন্য তাদের ডোর-টু-ডোর এয়ার সার্ভিস ব্যবহার করি। কোনো ড্যামেজ ছাড়াই ঢাকার শোরুমে সরাসরি পৌঁছে যায়। ট্র্যাকিং সিস্টেমটা অসাধারণ!',
    rating: 5,
    initial: 'R',
    tag: 'Gadget Distributor',
    date: 'November 2026'
  }
];
