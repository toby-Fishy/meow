# Toolhub

A hub of file utilities that run entirely in the visitor's browser. Nothing is
uploaded, nothing is stored, and every tool works offline once the page loads.

The name is a placeholder — it lives in `src/config/site.ts` and nowhere else.

## Why it is built this way

The business model is advertising against long-tail search traffic, and that
constrains the architecture:

- **Static HTML per tool.** Astro pre-renders every route, so crawlers and ad
  verification bots get real markup instead of an empty root element. React
  loads only for the interactive part of a tool page.
- **Work happens in a worker.** Decoding a large file on the main thread
  freezes the tab, which is both a bad experience and a Core Web Vitals
  failure. `WorkerPipeline` gives every tool progress reporting and
  cancellation for free.
- **Ad slots reserve their height.** Layout shift from late-loading ads is the
  most common Core Web Vitals regression on ad-supported sites. Slots hold
  their space whether or not an ad arrives.
- **No server.** Processing on the client means hosting is a static bundle, so
  cost does not scale with traffic.

See [`docs/niche-research.md`](docs/niche-research.md) for the analysis behind
the choice of tools.

## Getting started

```sh
npm install
npm run dev      # http://localhost:4321
npm test         # unit tests
npm run check    # types, across .ts, .tsx and .astro
npm run build    # static output in dist/
```

## Layout

```
src/
  config/site.ts        Site name, URL, and ad configuration
  tools/registry.ts     Every tool; drives routes, nav, sitemap and SEO
  workers/
    protocol.ts         Message types shared by both threads
    pipeline.ts         Main-thread client: promises, progress, cancellation
    serve.ts            Worker-side handler runner
    inspect.worker.ts   Reference task, end to end
  components/
    ToolShell.tsx       Reference tool UI: file in, progress, result, cancel
    AdSlot.astro        Layout-stable ad placement
    Seo.astro           Titles, canonicals, Open Graph, structured data
  pages/
    index.astro         Tool index
    tools/[slug].astro  One page per registry entry
```

## Adding a tool

1. Add an entry to `TOOLS` in `src/tools/registry.ts`. The route, navigation
   entry, sitemap URL, structured data and internal links follow from it.
2. Write the transform as a task handler and register it with `serveTasks` in a
   worker.
3. Render it, using `ToolShell.tsx` as the starting point.

`npm test` checks the registry invariants — slug format, description length,
FAQ presence, and that related-tool links resolve. A dangling link would
otherwise ship as a 404 that only surfaces in Search Console weeks later.

## Turning ads on

Set `enabled`, `publisherId` and the slot IDs in `src/config/site.ts`. Until
then slots render a visible placeholder and no ad-network script is loaded, so
development and tests never make third-party requests.
