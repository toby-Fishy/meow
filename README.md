# Nowhere

Compress, convert and resize images entirely in the browser. Nothing is
uploaded, nothing is stored, and every tool works offline once the page loads.

The name is a placeholder — it lives in `src/config/site.ts` and nowhere else.

## Why it is built this way

The business model is advertising against long-tail search traffic, and that
constrains the architecture more than the feature list does:

- **Static HTML per tool.** Astro pre-renders every route, so crawlers and ad
  verification bots get real markup instead of an empty root element. React
  loads only for the interactive part of a tool page.
- **Work happens in a worker.** Decoding a 40-megapixel photo on the main
  thread locks the tab for seconds, which is both a bad experience and a Core
  Web Vitals failure. `WorkerPipeline` gives every tool progress reporting and
  cancellation for free.
- **Ad slots reserve their height.** Layout shift from late-loading ads is the
  most common Core Web Vitals regression on ad-supported sites. Slots hold
  their space whether or not an ad arrives.
- **No server.** Processing on the client means hosting is a static bundle, so
  cost does not scale with traffic — and "your images go nowhere" is a fact
  about the architecture rather than a promise in a policy.

See [`docs/niche-research.md`](docs/niche-research.md) for the analysis behind
building image tools first.

## Getting started

```sh
npm install
npm run dev       # http://localhost:4321
npm test          # unit tests
npm run test:e2e  # browser tests: real images through the real pipeline
npm run check     # types, across .ts, .tsx and .astro
npm run build     # static output in dist/
```

`npm run test:e2e` builds and serves the site itself. If a preview server is
already running it is reused, so rebuild first or stop it — otherwise the tests
pass against a stale bundle.

## Layout

```
src/
  config/site.ts        Brand and ad configuration
  tools/registry.ts     Every tool; drives routes, nav, sitemap and SEO
  lib/image.ts          Dimension maths, naming, formatting — all pure
  workers/
    protocol.ts         Message types shared by both threads
    pipeline.ts         Main-thread client: promises, progress, cancellation
    serve.ts            Worker-side handler runner
    image.worker.ts     Decode, redraw, re-encode
  components/
    ImageTool.tsx       The tool UI, shared by all three operations
    AdSlot.astro        Layout-stable ad placement
    Seo.astro           Titles, canonicals, Open Graph, structured data
  pages/
    index.astro         Tool index
    tools/[slug].astro  One page per registry entry
e2e/                    Browser tests
```

## Adding a tool

1. Add an entry to `TOOLS` in `src/tools/registry.ts`. The route, navigation
   entry, sitemap URL, structured data and internal links all follow from it.
2. If it needs a new transform, write it as a task handler and register it with
   `serveTasks` in a worker.
3. Point the page at it. The three image tools share one component driven by
   the entry's `operation`.

`npm test` checks the registry invariants — slug format, description length,
FAQ presence, and that related-tool links resolve. A dangling link would
otherwise ship as a 404 that only surfaces in Search Console weeks later.

## Notes on the image pipeline

- **Format support is probed, not assumed.** `convertToBlob` silently falls
  back to PNG for a format the browser cannot encode, so the worker encodes a
  test pixel and reads the type back. AVIF is widely decodable but rarely
  encodable, and this is the only reliable way to know.
- **PNG ignores quality.** It is lossless, so the quality control is hidden
  when the output would be PNG rather than left there doing nothing.
- **JPEG has no alpha.** Transparent pixels are filled with white before
  encoding; without that they come out black.

## Turning ads on

Set `enabled`, `publisherId` and the slot IDs in `src/config/site.ts`. Until
then slots render a visible placeholder and no ad-network script is loaded, so
development and tests never make a third-party request.
