/**
 * Pure helpers shared by the image tools.
 *
 * Everything here is deliberately free of DOM and worker APIs so the parts
 * that are easy to get subtly wrong — dimension maths, output naming, size
 * reporting — can be tested directly.
 */

export const OUTPUT_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** `original` keeps whatever the input was; used by compress and resize. */
export type TargetFormat = OutputFormat | 'original';

const EXTENSIONS: Record<OutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const LABELS: Record<OutputFormat, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
};

/** PNG ignores the quality argument; showing the control would be a lie. */
export const LOSSY_FORMATS: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/webp',
  'image/avif',
]);

export function isOutputFormat(value: string): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(value);
}

export function extensionFor(format: OutputFormat): string {
  return EXTENSIONS[format];
}

export function labelFor(format: OutputFormat): string {
  return LABELS[format];
}

export function isLossy(format: string): boolean {
  return LOSSY_FORMATS.has(format);
}

/** Resolves `original` against the input's type, falling back to JPG. */
export function resolveFormat(target: TargetFormat, inputType: string): OutputFormat {
  if (target !== 'original') return target;
  return isOutputFormat(inputType) ? inputType : 'image/jpeg';
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface ResizeIntent {
  width?: number | undefined;
  height?: number | undefined;
  /** Scale factor applied when neither width nor height is given. */
  scale?: number | undefined;
}

/**
 * Works out the pixel size to render at.
 *
 * Supplying one dimension derives the other from the source aspect ratio, so
 * the default path cannot distort an image. Supplying both is taken at face
 * value — the caller has explicitly asked for that shape.
 */
export function targetDimensions(source: Dimensions, intent: ResizeIntent = {}): Dimensions {
  const { width, height, scale } = intent;
  const aspect = source.width / source.height;

  const round = (value: number) => Math.max(1, Math.round(value));

  if (width !== undefined && height !== undefined) {
    return { width: round(width), height: round(height) };
  }
  if (width !== undefined) {
    return { width: round(width), height: round(width / aspect) };
  }
  if (height !== undefined) {
    return { width: round(height * aspect), height: round(height) };
  }
  if (scale !== undefined) {
    return { width: round(source.width * scale), height: round(source.height * scale) };
  }
  return { width: round(source.width), height: round(source.height) };
}

/** Swaps the extension, keeping the original stem so files stay recognisable. */
export function outputName(inputName: string, format: OutputFormat): string {
  const dot = inputName.lastIndexOf('.');
  const stem = dot > 0 ? inputName.slice(0, dot) : inputName;
  return `${stem}.${extensionFor(format)}`;
}

export function clampQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 0.8;
  return Math.min(1, Math.max(0.01, quality));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1000) return `${Math.round(bytes)} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Percentage saved, negative when the output grew.
 *
 * Re-encoding can legitimately produce a larger file — a photo pushed to PNG,
 * or a already-optimised JPG at high quality — and reporting that honestly is
 * more useful than hiding it.
 */
export function percentChange(originalSize: number, newSize: number): number {
  if (originalSize <= 0) return 0;
  return Math.round(((originalSize - newSize) / originalSize) * 100);
}
