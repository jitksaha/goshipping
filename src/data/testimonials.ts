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
}

/**
 * GoShipping Verified Client Feedback & Testimonials
 * ---------------------------------------------------
 * To add or edit reviews:
 * Simply add a new object to the TESTIMONIALS array below or update existing entries!
 */
export const TESTIMONIALS: Testimonial[] = [];
