/**
 * Site-wide configuration.
 *
 * The brand lives here and nowhere else, so renaming is a one-line change.
 */
export const SITE = {
  name: 'Nowhere',
  url: 'https://example.com',
  tagline: 'Your images go nowhere.',
  description:
    'Compress, convert and resize images entirely in your browser. Nothing is uploaded, nothing is stored, and every tool works offline.',
  locale: 'en',
} as const;

/**
 * Ad configuration.
 *
 * Ads stay off until `publisherId` is set, so development and tests never make
 * a third-party request. Every slot reserves its height up front: layout shift
 * from late-loading ads is the most common Core Web Vitals regression on
 * ad-supported sites, and it costs both rankings and viewable impressions.
 */
export const ADS = {
  enabled: false,
  publisherId: '',
  slots: {
    /** Below the tool's output, where attention lands after a conversion. */
    toolBottom: '',
    /** In the long-form copy beneath each tool page. */
    inArticle: '',
  },
} as const;

export type AdSlotName = keyof typeof ADS.slots;
