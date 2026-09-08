# Which utility niche to build

An ad-supported tool site earns roughly:

```
revenue = sessions × pages per session × ads per page × viewability × RPM
```

Only the last term is about the ad network. The other four are product
decisions, which is why the niche choice matters more than the ad setup.

## What is actually known

Two of the inputs are documented publicly, and both favour general-consumer
utilities over developer utilities:

- **Ad blocking.** Around 29.5% of internet users globally block ads, rising to
  32.5% in the US, and higher still among technical and higher-income
  audiences. Developer-facing tools (JSON formatters, regex testers, base64
  encoders) draw exactly the audience that blocks most heavily, so a large
  share of their traffic is unmonetisable no matter how good the tool is.
- **Display rates.** Open-exchange display CPM averages about $3.12, while
  curated inventory averages $8.20. Utility content sits near the commodity end
  unless the page context is commercially valuable — the reason finance
  ($30-60 RPM) is an outlier and general utilities are not.

The third input — search demand per tool — cannot be established from public
sources. Anyone quoting exact monthly volumes for "compress image online"
without a keyword tool is guessing. Before committing to a niche, spend an hour
in Google Keyword Planner (free with an Ads account), Ahrefs, or Semrush and
pull volume plus keyword difficulty for the head term of each tool below. The
comparison here is structural; that data makes it quantitative.

## The candidates

### Image tools — compress, convert, resize, crop

**For.** Broad consumer audience, so blocking runs at or under the average
rather than over it. Demand is fragmented across format pairs
(`heic-to-jpg`, `png-to-webp`, `webp-to-png`, …), and each pair is a legitimate
separate page with its own long-tail term — dozens of low-competition landing
pages from one engine. Everything is achievable with `<canvas>` and
`createImageBitmap`, no WASM required, so the build is short.

**Against.** Sessions are brief. Someone compresses one image and leaves,
giving maybe two ad impressions.

**Differentiator.** Incumbents upload your files to a server and make you wait
in a queue. Doing it locally is both faster and a privacy claim that is
literally true — and it is a claim they structurally cannot copy without
rewriting their product.

### PDF tools — merge, split, rotate, compress

**For.** The highest commercial intent of the three: people doing PDF work are
often doing paid work, which lifts advertiser interest in the page. Multi-step
tasks mean longer sessions and more page views per visit.

**Against.** This is the Smallpdf / iLovePDF market — well-funded incumbents
with a decade of domain authority. Ranking for head terms is unrealistic for a
new domain; you would be competing purely on long-tail. The build is also
substantially harder: `pdf-lib` plus `pdf.js`, and genuine PDF compression
(image downsampling, font subsetting) is a real project on its own.

### Timer and clock suite

**For.** Unbeatable session economics. A visitor starts a 25-minute pomodoro
and leaves the tab open, so one session yields many impressions from a single
page — the highest ads-per-session of anything on this list. The build is
trivial, days not weeks.

**Against.** Nothing to differentiate on. Every timer is the same timer, the
term is saturated, and the audience has no commercial intent whatsoever, which
puts it at the bottom of the RPM range. It also wins no backlinks — nobody
links to a timer, and links are how a new domain earns the authority to rank
for anything else.

## Recommendation

**Start with image tools.** It is the only one of the three with a real,
defensible differentiator (no upload) on a build that fits in weeks rather than
months, aimed at an audience that mostly does not block ads. PDF is the richer
market but the wrong first move for a domain with zero authority; timers have
the best per-session economics but no way to win traffic in the first place.

Sequenced:

1. Ship three image tools — compress, convert, resize — since they share almost
   all their code.
2. Expand into format-pair landing pages, which are near-free once the
   converter exists and are where the long-tail traffic actually lives.
3. Once the domain has authority and real traffic data, reassess PDF. The
   engine is shared, so that is an addition rather than a rewrite.

Turn ads on only after there is traffic worth measuring. Ad code costs Core Web
Vitals, and rankings come first: the reserved-height ad slots already in the
codebase exist so that adding ads later does not cost layout stability.

## Sources

- [Ad Blocker Usage and Demographic Statistics in 2026 — Backlinko](https://backlinko.com/ad-blockers-users)
- [Display Advertising Benchmarks 2026 — Digital Applied](https://www.digitalapplied.com/blog/display-advertising-benchmarks-2026-data-points)
- [Highest Paying AdSense Niches 2026 — Adstimate](https://adstimate.com/blog/highest-paying-adsense-niches.html)
