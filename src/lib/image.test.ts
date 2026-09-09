import { describe, expect, it } from 'vitest';
import {
  clampQuality,
  extensionFor,
  formatBytes,
  isLossy,
  isOutputFormat,
  labelFor,
  outputName,
  percentChange,
  resolveFormat,
  targetDimensions,
} from './image.ts';

describe('format helpers', () => {
  it('recognises supported output types', () => {
    expect(isOutputFormat('image/webp')).toBe(true);
    expect(isOutputFormat('image/gif')).toBe(false);
  });

  it('maps types to extensions and labels', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(labelFor('image/jpeg')).toBe('JPG');
  });

  it('knows PNG ignores a quality setting', () => {
    expect(isLossy('image/png')).toBe(false);
    expect(isLossy('image/webp')).toBe(true);
  });

  it('resolves "original" to the input type', () => {
    expect(resolveFormat('original', 'image/png')).toBe('image/png');
  });

  it('falls back to JPG when the input type is not an output type', () => {
    expect(resolveFormat('original', 'image/gif')).toBe('image/jpeg');
    expect(resolveFormat('original', '')).toBe('image/jpeg');
  });

  it('passes an explicit format straight through', () => {
    expect(resolveFormat('image/webp', 'image/png')).toBe('image/webp');
  });
});

describe('targetDimensions', () => {
  const source = { width: 1600, height: 900 };

  it('returns the source size when nothing is asked for', () => {
    expect(targetDimensions(source)).toEqual(source);
  });

  it('derives height from width, preserving the aspect ratio', () => {
    expect(targetDimensions(source, { width: 800 })).toEqual({ width: 800, height: 450 });
  });

  it('derives width from height, preserving the aspect ratio', () => {
    expect(targetDimensions(source, { height: 450 })).toEqual({ width: 800, height: 450 });
  });

  it('honours both dimensions when both are given', () => {
    expect(targetDimensions(source, { width: 100, height: 100 })).toEqual({
      width: 100,
      height: 100,
    });
  });

  it('scales by a factor', () => {
    expect(targetDimensions(source, { scale: 0.5 })).toEqual({ width: 800, height: 450 });
  });

  it('rounds to whole pixels', () => {
    expect(targetDimensions({ width: 1000, height: 333 }, { width: 500 })).toEqual({
      width: 500,
      height: 167,
    });
  });

  it('never returns a zero dimension', () => {
    expect(targetDimensions(source, { scale: 0.0001 })).toEqual({ width: 1, height: 1 });
  });
});

describe('outputName', () => {
  it('swaps the extension', () => {
    expect(outputName('holiday.png', 'image/jpeg')).toBe('holiday.jpg');
  });

  it('adds an extension when there is none', () => {
    expect(outputName('screenshot', 'image/webp')).toBe('screenshot.webp');
  });

  it('only replaces the final extension', () => {
    expect(outputName('archive.tar.png', 'image/webp')).toBe('archive.tar.webp');
  });

  it('leaves a dotfile name intact', () => {
    expect(outputName('.gitignore', 'image/png')).toBe('.gitignore.png');
  });
});

describe('clampQuality', () => {
  it('keeps values inside the usable range', () => {
    expect(clampQuality(1.5)).toBe(1);
    expect(clampQuality(0)).toBe(0.01);
    expect(clampQuality(0.6)).toBe(0.6);
  });

  it('falls back to a sane default for non-numbers', () => {
    expect(clampQuality(Number.NaN)).toBe(0.8);
  });
});

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('drops the decimal once the number is large enough not to need it', () => {
    expect(formatBytes(20 * 1024)).toBe('20 KB');
  });

  it('handles nonsense input', () => {
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('percentChange', () => {
  it('reports a saving', () => {
    expect(percentChange(1000, 250)).toBe(75);
  });

  it('reports growth as a negative number rather than hiding it', () => {
    expect(percentChange(1000, 1500)).toBe(-50);
  });

  it('avoids dividing by zero', () => {
    expect(percentChange(0, 100)).toBe(0);
  });
});
