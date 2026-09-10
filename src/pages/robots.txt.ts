import type { APIRoute } from 'astro';
import { SITE } from '../config/site.ts';

/**
 * Generated so the sitemap URL always matches the deployed domain — and so a
 * build with no SITE_URL set refuses crawlers outright rather than publishing
 * canonical URLs that point at localhost.
 */
export const GET: APIRoute = ({ site }) => {
  const body = SITE.configured
    ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site).href}\n`
    : `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
