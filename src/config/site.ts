/**
 * Site-wide configuration.
 *
 * `name` and `url` are placeholders until the brand is chosen; everything
 * else keys off these two values so renaming is a one-line change.
 */
export const SITE = {
  name: 'Toolhub',
  url: 'https://example.com',
  tagline: 'Fast file tools that never upload your files.',
  description:
    'Compress, convert and resize files right in your browser. Nothing is uploaded, nothing is stored, and every tool works offline.',
  locale: 'en',
} as const;

/**
 * Ad configuration.
 *
 * Ads are off until `publisherId` is set, so development and tests never call
 * out to an ad network. Every slot reserves its height up front: layout shift
 * caused by late-loading ads is the single biggest Core Web Vitals regression
 * on ad-supported sites, and it costs both rankings and viewable impressions.
 */
export const ADS = {
  enabled: false,
  publisherId: '',
  slots: {
    /** Above the tool, after the heading. Highest value placement. */
    toolTop: '',
    /** Below the tool's output, where attention lands after a conversion. */
    toolBottom: '',
    /** In the long-form copy beneath each tool page. */
    inArticle: '',
  },
} as const;

export type AdSlotName = keyof typeof ADS.slots;
