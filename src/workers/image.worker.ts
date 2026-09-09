/// <reference lib="webworker" />
import {
  clampQuality,
  isLossy,
  outputName,
  resolveFormat,
  targetDimensions,
  OUTPUT_FORMATS,
  type OutputFormat,
  type ResizeIntent,
  type TargetFormat,
} from '../lib/image.ts';
import { serveTasks, type TaskContext } from './serve.ts';

export interface TransformRequest {
  file: File;
  target: TargetFormat;
  quality: number;
  resize?: ResizeIntent;
}

export interface TransformResult {
  name: string;
  blob: Blob;
  format: OutputFormat;
  width: number;
  height: number;
  originalSize: number;
  size: number;
}

/**
 * Decodes, redraws at the requested size, and re-encodes.
 *
 * All of it happens on a worker thread: decoding a 40-megapixel photo on the
 * main thread locks the tab for seconds, and the whole promise of the site is
 * that it feels faster than uploading.
 */
async function transform(
  { file, target, quality, resize }: TransformRequest,
  { reportProgress, signal }: TaskContext,
): Promise<TransformResult> {
  reportProgress(0.1);

  const bitmap = await createImageBitmap(file);
  if (signal.aborted) {
    bitmap.close();
    throw new Error('Cancelled');
  }
  reportProgress(0.45);

  try {
    const format = resolveFormat(target, file.type);
    const size = targetDimensions({ width: bitmap.width, height: bitmap.height }, resize ?? {});

    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get a drawing context');

    // Browsers default to a fast, blocky downscale; images are the product
    // here, so pay for the better filter.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // JPEG has no alpha. Without this, transparent pixels encode as black.
    if (format === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size.width, size.height);
    }

    context.drawImage(bitmap, 0, 0, size.width, size.height);
    reportProgress(0.75);

    const blob = await canvas.convertToBlob(
      isLossy(format) ? { type: format, quality: clampQuality(quality) } : { type: format },
    );

    if (signal.aborted) throw new Error('Cancelled');
    reportProgress(1);

    return {
      name: outputName(file.name, format),
      blob,
      format,
      width: size.width,
      height: size.height,
      originalSize: file.size,
      size: blob.size,
    };
  } finally {
    bitmap.close();
  }
}

/**
 * Reports which formats this browser can actually encode.
 *
 * `convertToBlob` silently falls back to PNG for a type it does not support,
 * so the only reliable check is to encode a pixel and read the result back.
 * AVIF in particular is widely decodable but rarely encodable.
 */
async function supportedFormats(): Promise<OutputFormat[]> {
  const canvas = new OffscreenCanvas(1, 1);
  const supported: OutputFormat[] = [];

  for (const format of OUTPUT_FORMATS) {
    try {
      const blob = await canvas.convertToBlob({ type: format });
      if (blob.type === format) supported.push(format);
    } catch {
      // Unsupported types throw in some browsers and fall back in others.
    }
  }

  return supported;
}

serveTasks(self as unknown as DedicatedWorkerGlobalScope, { transform, supportedFormats });
