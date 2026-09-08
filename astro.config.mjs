// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

import { SITE } from './src/config/site.ts';

// Static output: every tool gets real pre-rendered HTML. Search crawlers and
// ad verification bots both need markup in the initial response, and the tools
// themselves run entirely in the visitor's browser, so there is nothing to SSR.
export default defineConfig({
  site: SITE.url,
  output: 'static',
  integrations: [react(), sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    worker: {
      format: 'es',
    },
  },
});
