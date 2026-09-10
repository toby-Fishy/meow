/**
 * Site-wide configuration.
 *
 * The brand lives here and nowhere else, so renaming is a one-line change.
 */
export const SITE = {
  name: 'Nowhere',
  /**
   * Set SITE_URL in the host's build environment. Canonical URLs, Open Graph
   * tags, robots.txt and the sitemap all derive from it, so a wrong value here
   * quietly points search engines at the wrong domain.
   */
  url: process.env.SITE_URL ?? 'http://localhost:4321',
  /**
   * False when SITE_URL was never set. A build like that still runs, but its
   * canonical URLs point at localhost, so it must not be indexed — a wrong
   * canonical is far more damaging than a missing page.
   */
  configured: process.env.SITE_URL !== undefined,
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
