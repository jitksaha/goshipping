/**
 * Tracking & Analytics Configuration Utility
 * 
 * Manages Google Tag Manager (GTM), Meta / Facebook Pixel, TikTok Pixel,
 * GA4, LinkedIn Insight Tag, and other social media tracking providers.
 */

export interface TrackingConfig {
  gtmId: string;
  fbPixelId: string;
  gaMeasurementId: string;
  tiktokPixelId: string;
  linkedinPartnerId: string;
  twitterPixelId: string;
  pinterestTagId: string;
  googleAdsId: string;
  isEnabled: boolean;
  activeDomain?: string;
}

/**
 * Read active tracking configurations from environment variables
 */
export function getTrackingConfig(): TrackingConfig {
  const env = typeof process !== 'undefined' ? process.env : {} as any;

  const gtmId = (env.PUBLIC_GTM_ID || env.GTM_ID || '').trim();
  const fbPixelId = (env.PUBLIC_FB_PIXEL_ID || env.FB_PIXEL_ID || env.META_PIXEL_ID || '').trim();
  const gaMeasurementId = (env.PUBLIC_GA_MEASUREMENT_ID || env.GA_MEASUREMENT_ID || '').trim();
  const tiktokPixelId = (env.PUBLIC_TIKTOK_PIXEL_ID || env.TIKTOK_PIXEL_ID || '').trim();
  const linkedinPartnerId = (env.PUBLIC_LINKEDIN_PARTNER_ID || env.LINKEDIN_PARTNER_ID || '').trim();
  const twitterPixelId = (env.PUBLIC_TWITTER_PIXEL_ID || env.TWITTER_PIXEL_ID || '').trim();
  const pinterestTagId = (env.PUBLIC_PINTEREST_TAG_ID || env.PINTEREST_TAG_ID || '').trim();
  const googleAdsId = (env.PUBLIC_GOOGLE_ADS_ID || env.GOOGLE_ADS_ID || '').trim();

  const isEnabled = Boolean(
    gtmId || fbPixelId || gaMeasurementId || tiktokPixelId ||
    linkedinPartnerId || twitterPixelId || pinterestTagId || googleAdsId
  );

  return {
    gtmId,
    fbPixelId,
    gaMeasurementId,
    tiktokPixelId,
    linkedinPartnerId,
    twitterPixelId,
    pinterestTagId,
    googleAdsId,
    isEnabled
  };
}
