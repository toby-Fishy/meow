import { expect, test, type Page } from '@playwright/test';

/**
 * Builds a real image in the page and hands it to the file input the way a
 * drop would, so the test exercises the actual decode/encode path rather than
 * a mock. The gradient plus noise gives the encoder something to work on —
 * a flat colour compresses to nothing and would prove little.
 */
async function pickGeneratedImage(
  page: Page,
  { width = 800, height = 600, type = 'image/png' as 'image/png' | 'image/jpeg' } = {},
) {
  await page.evaluate(
    async ({ width, height, type }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;

      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#c2410c');
      gradient.addColorStop(1, '#0c4a6e');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      for (let i = 0; i < 4000; i += 1) {
        context.fillStyle = `hsl(${(i * 37) % 360} 80% 50%)`;
        context.fillRect((i * 61) % width, (i * 113) % height, 3, 3);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, 0.95),
      );

      const name = type === 'image/jpeg' ? 'sample.jpg' : 'sample.png';
      const file = new File([blob!], name, { type });
      const transfer = new DataTransfer();
      transfer.items.add(file);

      const input = document.querySelector<HTMLInputElement>('.dropzone__input')!;
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { width, height, type },
  );
}

/** Result sizes are rendered for people ("565 KB"), so compare them in KB. */
function toKilobytes(text: string): number {
  const [value, unit] = text.trim().split(' ');
  const scale = unit === 'MB' ? 1024 : unit === 'B' ? 1 / 1024 : 1;
  return Number(value) * scale;
}

test('the home page is served as real HTML', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Your images go nowhere.');
  await expect(page.locator('.tool-card')).toHaveCount(3);
});

test('compress produces a smaller file at a lower quality', async ({ page }) => {
  await page.goto('/tools/compress-image/');
  await pickGeneratedImage(page, { type: 'image/jpeg' });

  const result = page.locator('.result').first();
  await expect(result.locator('.result__dims')).toHaveText('800 × 600', { timeout: 15_000 });
  await expect(result.locator('.result__thumb img')).toBeVisible();

  const atDefault = await page.locator('.result__new').first().textContent();

  await page.locator('#quality').fill('20');
  await expect(page.locator('.result__new').first()).not.toHaveText(atDefault!, {
    timeout: 15_000,
  });

  const atLow = await page.locator('.result__new').first().textContent();
  expect(toKilobytes(atLow!)).toBeLessThan(toKilobytes(atDefault!));

  await expect(page.getByRole('button', { name: /Download image/ })).toBeVisible();
});

test('compress explains that quality cannot apply to a PNG', async ({ page }) => {
  await page.goto('/tools/compress-image/');
  await pickGeneratedImage(page, { type: 'image/png' });
  await expect(page.locator('.result__new')).toBeVisible({ timeout: 15_000 });

  // Keeping the format means PNG out, which ignores quality entirely.
  await expect(page.locator('#quality')).toHaveCount(0);
  await expect(page.locator('.control__note--wide')).toContainText('lossless');

  const asPng = await page.locator('.result__new').textContent();

  // Switching to a lossy format brings the control back, and shrinks the file.
  await page.getByRole('button', { name: 'WebP' }).click();
  await expect(page.locator('#quality')).toBeVisible();
  await expect(page.locator('.result__new')).not.toHaveText(asPng!, { timeout: 15_000 });
  expect(toKilobytes((await page.locator('.result__new').textContent())!)).toBeLessThan(
    toKilobytes(asPng!),
  );
});

test('resize honours a width and keeps the aspect ratio', async ({ page }) => {
  await page.goto('/tools/resize-image/');
  await pickGeneratedImage(page);
  await expect(page.locator('.result__dims')).toHaveText('800 × 600', { timeout: 15_000 });

  await page.getByLabel('Width in pixels').fill('400');
  await expect(page.locator('.result__dims')).toHaveText('400 × 300', { timeout: 15_000 });
});

test('convert writes the chosen format', async ({ page }) => {
  await page.goto('/tools/convert-image/');
  await pickGeneratedImage(page);
  await expect(page.locator('.result__dims')).toHaveText('800 × 600', { timeout: 15_000 });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JPG' }).click();
  await expect(page.locator('.result__new')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Download image/ }).click();

  expect((await download).suggestedFilename()).toBe('sample.jpg');
});

test('several images are handled at once', async ({ page }) => {
  await page.goto('/tools/compress-image/');
  await pickGeneratedImage(page, { width: 400, height: 400, type: 'image/jpeg' });
  await pickGeneratedImage(page, { width: 200, height: 300, type: 'image/jpeg' });

  await expect(page.locator('.result')).toHaveCount(2);
  await expect(page.locator('.result__new')).toHaveCount(2, { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Download all 2' })).toBeVisible();
});
