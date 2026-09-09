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

/** Which set of controls a tool renders. Drives the shared image component. */
export type ToolOperation = 'compress' | 'convert' | 'resize';

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
  operation: ToolOperation;
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
    tagline: 'Make JPG, PNG and WebP files smaller without a visible quality drop.',
    description:
      'Compress JPG, PNG and WebP images in your browser. Choose a quality level, see the saving before you commit, and download. Nothing is uploaded.',
    category: 'image',
    status: 'live',
    operation: 'compress',
    accepts: ['image/jpeg', 'image/png', 'image/webp'],
    faqs: [
      {
        question: 'Are my images uploaded to a server?',
        answer:
          'No. Compression runs inside your browser on a background thread, so the image data never leaves your device. Once the page has loaded it works with no connection at all.',
      },
      {
        question: 'How much smaller will my image get?',
        answer:
          'Photographs typically drop by 60-80% at quality 80 with no visible difference. Flat graphics and screenshots do better as PNG or WebP than as JPG.',
      },
      {
        question: 'Why did my file get bigger?',
        answer:
          'Re-encoding an already-optimised image at a high quality setting can add bytes. Lower the quality, or convert to WebP, which is usually smaller than both JPG and PNG.',
      },
    ],
    related: ['convert-image', 'resize-image'],
  },
  {
    slug: 'convert-image',
    name: 'Convert Image',
    tagline: 'Move between JPG, PNG and WebP in a couple of clicks.',
    description:
      'Convert images between JPG, PNG and WebP right in your browser. Convert several files at once, with no upload, no watermark and no sign-up.',
    category: 'image',
    status: 'live',
    operation: 'convert',
    accepts: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp'],
    faqs: [
      {
        question: 'Does converting an image lose quality?',
        answer:
          'Converting to PNG is lossless. JPG and WebP re-encode the image, so you pick the quality level and can see the resulting file size before downloading.',
      },
      {
        question: 'Can I convert several images at once?',
        answer:
          'Yes. Drop in as many as you like. They are converted one after another and can be downloaded individually or all together.',
      },
      {
        question: 'What happens to transparency when I convert to JPG?',
        answer:
          'JPG has no transparency, so transparent areas are filled with white. Convert to PNG or WebP instead if you need to keep them.',
      },
    ],
    related: ['compress-image', 'resize-image'],
  },
  {
    slug: 'resize-image',
    name: 'Resize Image',
    tagline: 'Set exact pixel dimensions, or scale by percentage.',
    description:
      'Resize images to exact pixel dimensions or by percentage, in your browser. The aspect ratio is locked by default, so nothing gets stretched.',
    category: 'image',
    status: 'live',
    operation: 'resize',
    accepts: ['image/jpeg', 'image/png', 'image/webp'],
    faqs: [
      {
        question: 'Will resizing distort my image?',
        answer:
          'Not unless you ask it to. Setting one dimension calculates the other from the original aspect ratio, so the proportions are kept.',
      },
      {
        question: 'Can I make an image larger?',
        answer:
          'You can, but enlarging cannot invent detail that is not in the original, so the result will look softer than the source.',
      },
      {
        question: 'Does resizing also make the file smaller?',
        answer:
          'Almost always, and usually by a lot — half the width and half the height is a quarter of the pixels. It is often the most effective way to shrink a file.',
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
