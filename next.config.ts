import type { NextConfig } from "next";

// docs.metasploit.com publishes this at /stats/, not the domain root — but a local `npm run
// build`/`npm run dev` should behave like any other app (root-relative), so this is opt-in via an
// env var CI sets, rather than assumed by default from the build/dev distinction alone.
const BASE_PATH = process.env.DASHBOARD_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  // Without this, nested routes export as flat files (queue.html, bugs.html, ...) instead of
  // queue/index.html, bugs/index.html, ... — plain static file servers (a bare `python3 -m
  // http.server`, S3 website hosting, etc, not just `npx serve`/nginx with clean-URL rewriting)
  // can't resolve a request for `/queue` to `queue.html`, so every internal link 404s or — worse —
  // falls through to an auto-generated directory listing if a same-named folder happens to exist.
  // `<route>/index.html` is the one format virtually every static host serves correctly.
  trailingSlash: true,
  // /queue's data loading does a live GraphQL fetch plus, per PR touching a module, a REST
  // Contents API call and CVE/CVSS/KEV lookups against OSV/NVD/CISA — comfortably over Next's
  // default 60s static-generation timeout on a real build against a large, active repo. The
  // Dashboard's full ~30-repo issue/PR/commit history fetch is slower still, so this is set well
  // above either page's expected cold-cache build time.
  staticPageGenerationTimeout: 900,
  // Serializes static-page generation. The Dashboard's 13 pages/routes all share one expensive,
  // disk-cached historical fetch (see src/lib/stats/dataset.ts) — generating pages across
  // multiple worker processes risks several of them missing a cold cache at once and firing
  // redundant, rate-limit-consuming live fetches. Benchmark if build time becomes a concern.
  experimental: {
    cpus: 1,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
