/**
 * The tool registry is the single source of truth for the site.
 *
 * Routes, navigation, the sitemap, internal linking and per-page SEO metadata
 * are all generated from these entries, so adding a tool means adding one
 * object here plus the component that does the work. That matters for an
 * ad-supported site: traffic comes from a long tail of narrowly-worded pages
 * ("convert heic to jpg"), and each of those pages has to be cheap to add.
 */

export type ToolCategory = 'image' | 'pdf' | 'text';

export type ToolStatus = 'live' | 'planned';

export interface ToolFaq {
  /** Phrased the way a visitor would search it — these become FAQ rich results. */
  question: string;
  answer: string;
}

export interface Tool {
  /** URL segment. Lowercase, hyphenated; this is the page's permanent address. */
  slug: string;
  /** Page <h1> and navigation label. */
  name: string;
  /** One line under the heading. */
  tagline: string;
  /** Meta description. Kept within SEO_DESCRIPTION_BOUNDS so it is not truncated. */
  description: string;
  category: ToolCategory;
  status: ToolStatus;
  /** File types the tool accepts, as input-accept values. Empty for non-file tools. */
  accepts: string[];
  faqs: ToolFaq[];
  /** Slugs of related tools, rendered as internal links. */
  related: string[];
}

/**
 * Google truncates descriptions well before 200 characters and treats very
 * short ones as low quality; these bounds keep every page inside the window.
 */
export const SEO_DESCRIPTION_BOUNDS = { min: 70, max: 160 } as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const TOOLS: Tool[] = [
  {
    slug: 'compress-image',
    name: 'Compress Image',
    tagline: 'Shrink JPG, PNG and WebP files without a visible quality drop.',
    description:
      'Compress JPG, PNG and WebP images in your browser. Pick a target quality, preview the result, and download — your files are never uploaded.',
    category: 'image',
    status: 'planned',
    accepts: ['image/jpeg', 'image/png', 'image/webp'],
    faqs: [
      {
        question: 'Are my images uploaded to a server?',
        answer:
          'No. The compression runs in your browser using a background worker, so the image data never leaves your device and works with no connection at all.',
      },
      {
        question: 'How much smaller will my image get?',
        answer:
          'Photographs typically drop by 60-80% at a quality setting of 80 with no visible difference. Screenshots and flat graphics compress further as PNG or WebP.',
      },
    ],
    related: ['convert-image', 'resize-image'],
  },
  {
    slug: 'convert-image',
    name: 'Convert Image',
    tagline: 'Change between JPG, PNG, WebP and AVIF in a couple of clicks.',
    description:
      'Convert images between JPG, PNG, WebP and AVIF directly in your browser. Batch convert several files at once, with no upload and no watermark.',
    category: 'image',
    status: 'planned',
    accepts: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    faqs: [
      {
        question: 'Does converting an image lose quality?',
        answer:
          'Converting to PNG is lossless. Converting to JPG, WebP or AVIF re-encodes the image, so you choose the quality level and can compare the result before downloading.',
      },
      {
        question: 'Can I convert several images at once?',
        answer:
          'Yes. Drop in as many files as you like and they are converted one after another, then downloaded together.',
      },
    ],
    related: ['compress-image', 'resize-image'],
  },
  {
    slug: 'resize-image',
    name: 'Resize Image',
    tagline: 'Set exact pixel dimensions, or scale by percentage.',
    description:
      'Resize images to exact pixel dimensions or by percentage, in your browser. Keeps the aspect ratio, handles batches, and never uploads your files.',
    category: 'image',
    status: 'planned',
    accepts: ['image/jpeg', 'image/png', 'image/webp'],
    faqs: [
      {
        question: 'Will resizing distort my image?',
        answer:
          'Not unless you ask it to. The aspect ratio is locked by default, so setting one dimension calculates the other automatically.',
      },
      {
        question: 'Can I make an image larger?',
        answer:
          'You can, but enlarging cannot recover detail that is not in the original, so the result will look softer than the source.',
      },
    ],
    related: ['compress-image', 'convert-image'],
  },
];

export function liveTools(tools: readonly Tool[] = TOOLS): Tool[] {
  return tools.filter((tool) => tool.status === 'live');
}

export function findTool(slug: string, tools: readonly Tool[] = TOOLS): Tool | undefined {
  return tools.find((tool) => tool.slug === slug);
}

export function relatedTools(tool: Tool, tools: readonly Tool[] = TOOLS): Tool[] {
  return tool.related
    .map((slug) => findTool(slug, tools))
    .filter((related): related is Tool => related !== undefined);
}

export function toolsByCategory(
  category: ToolCategory,
  tools: readonly Tool[] = TOOLS,
): Tool[] {
  return tools.filter((tool) => tool.category === category);
}

/**
 * Checks the invariants the rest of the site relies on. A broken slug or a
 * dangling `related` reference would ship as a 404 that only shows up in
 * Search Console weeks later, so this runs as a test rather than at runtime.
 */
export function validateRegistry(tools: readonly Tool[] = TOOLS): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const tool of tools) {
    if (!SLUG_PATTERN.test(tool.slug)) {
      problems.push(`"${tool.slug}": slug must be lowercase and hyphen-separated`);
    }
    if (seen.has(tool.slug)) {
      problems.push(`"${tool.slug}": duplicate slug`);
    }
    seen.add(tool.slug);

    const { length } = tool.description;
    if (length < SEO_DESCRIPTION_BOUNDS.min || length > SEO_DESCRIPTION_BOUNDS.max) {
      problems.push(
        `"${tool.slug}": description is ${length} characters, expected ${SEO_DESCRIPTION_BOUNDS.min}-${SEO_DESCRIPTION_BOUNDS.max}`,
      );
    }

    if (tool.faqs.length === 0) {
      problems.push(`"${tool.slug}": needs at least one FAQ entry`);
    }

    if (tool.related.includes(tool.slug)) {
      problems.push(`"${tool.slug}": lists itself as related`);
    }
  }

  for (const tool of tools) {
    for (const slug of tool.related) {
      if (!seen.has(slug)) {
        problems.push(`"${tool.slug}": related tool "${slug}" does not exist`);
      }
    }
  }

  return problems;
}
