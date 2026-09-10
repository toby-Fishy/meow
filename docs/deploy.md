# Deploying

The site is a static bundle, so hosting is free on any static host and the cost
does not grow with traffic. There is no server to run.

## Before going live

Set `SITE_URL` to the real domain in the host's build environment. Canonical
URLs, Open Graph tags, `robots.txt` and the sitemap all derive from it.

A build without `SITE_URL` still works, but it marks every page `noindex` and
tells crawlers to stay out. That is deliberate: a site indexed with canonical
URLs pointing at `localhost` is far harder to recover from than one that was
never indexed at all.

## Cloudflare Pages (recommended)

Free, with unlimited bandwidth — which matters here, because the whole model is
serving a lot of pages very cheaply.

1. Push this branch to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, and pick the repository.
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Output directory: `dist`
4. **Settings → Environment variables**, add `SITE_URL` = your domain
   (`https://example.com`, no trailing slash).
5. Deploy. Every push to the branch rebuilds automatically.

## Netlify

`netlify.toml` already carries the build settings, so connecting the repository
is enough. Override `SITE_URL` under **Site configuration → Environment
variables** — the value in the file is only a placeholder.

### Without GitHub

Netlify Drop takes a folder directly: run `npm run build` and drag `dist/` onto
<https://app.netlify.com/drop>. It is live in seconds, with no repository and no
CLI. Useful for a first look; connect the repo once you want pushes to deploy.

## A custom domain

Both hosts issue a working subdomain immediately (`something.pages.dev` or
`something.netlify.app`), so you can use the site before owning a domain. When
you add a real one, update `SITE_URL` and redeploy — otherwise canonical URLs
keep pointing at the old address.

## After the first deploy

- Check `https://yourdomain/robots.txt` says `Allow: /` and not `Disallow: /`.
  `Disallow` means `SITE_URL` did not reach the build.
- Submit `https://yourdomain/sitemap-index.xml` in Google Search Console.
- Leave ads off until there is traffic worth measuring. Ad scripts cost Core Web
  Vitals, and rankings have to come first. See `docs/niche-research.md`.
