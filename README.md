# metasploit-dashboard

A static HTML snapshot of the `rapid7/metasploit-framework` open pull request queue, inspired by
[gh-review](../gh-review)'s dashboard. It's a [Next.js](https://nextjs.org) app built with
[shadcn/ui](https://ui.shadcn.com) (on Radix primitives) and exported as a fully static site
(`output: "export"`): a Server Component fetches every open PR via the GitHub GraphQL API at
*build time*, and the interactive dashboard (filtering, sorting, search, popovers) hydrates as a
normal React client component. There's no server or database at runtime — `next build` writes a
self-contained `out/` directory you can host on any static file server (GitHub Pages, S3, nginx,
`npx serve out`, ...).

## Usage

```sh
npm install
cp .env.example .env   # fill in GITHUB_OAUTH_TOKEN (needs public repo read access); Next.js loads
                        # GITHUB_OWNER/GITHUB_REPO/GITHUB_OAUTH_TOKEN from .env automatically
npm run build           # runs `next build`, writes the static site to out/
npx serve out            # or any other static file server — out/index.html uses root-relative
                          # asset paths, so it won't load correctly via a plain file:// URL
```

To build from the bundled fixture data instead of hitting the real GitHub API (useful for local
iteration or CI, no token required):

```sh
npm run build:fixture
```

`npm run dev` runs the normal Next.js dev server (`next dev`) if you want to iterate on the UI
without waiting for a full export each time.

## What's in the dashboard

- **Queue overview** stat cards: open PR count, average age, assignment coverage, community vs.
  Rapid7 authorship, module vs. non-module change scope, CI status, review status, and inferred
  target testing environment — each clickable to filter the table below.
- **Pull request table**: sortable by any column, filterable by target environment, change scope,
  CI status, review decision, assignee, and label, plus free-text search.
- **CVE/CVSS evidence**: each PR's touched exploit/auxiliary/post modules (and its title/description)
  are scanned for CVE/GHSA references; each unique reference is resolved to a real CVSS score via
  OSV.dev → the fkie-cad NVD mirror → the NVD REST API, plus a CISA KEV ("known exploited") check.
  The "CVE severity" column and its evidence popover (`src/components/vulnerability-evidence.tsx`)
  are modeled closely on gh-review's own `VulnerabilityEvidence`/`CvssVectorExplanation` components
  — same severity labels/colors, a "Known exploited" badge with CISA links, a per-metric CVSS vector
  breakdown, and a dedicated "Sort by vulnerability evidence" dropdown. Only runs on real builds —
  `build:fixture` skips it entirely so CI stays offline. See
  `src/lib/vuln/` and the `NVD_API_KEY`/`ADVISORY_CACHE_TTL_DAYS` vars in `.env.example`.

## Project layout

- `src/app/` — Next.js App Router: `page.tsx` is the async Server Component that loads PR data at
  build time (real GitHub API, or `fixtures/sample-prs.json` when `FIXTURE_DATA=1`); `layout.tsx`
  and `globals.css` set up fonts, the shadcn theme, and automatic (OS-preference) dark mode.
- `src/lib/` — framework-agnostic logic, fully unit-tested: `github-client.ts` (GraphQL fetch +
  pagination + rate-limit retry), `pull-requests.ts` (maps raw GraphQL nodes), `queue-filter.ts` /
  `queue-stats.ts` (the filter/stat predicates driving the overview cards), `testing-environment.ts`
  (target-OS heuristics from file paths + PR description).
- `src/components/` — `dashboard.tsx` (the stateful client component: all filter/sort/search state),
  `queue-overview.tsx`, `pull-request-table.tsx`, `badges.tsx`, and `ui/` (shadcn-generated
  primitives on top of Radix).

## Development

```sh
npm run typecheck   # tsc --noEmit
npm test            # vitest — unit tests for src/lib/*, plus a smoke test that runs a real
                     # `next build` against fixture data and checks out/index.html
```

See `.github/workflows/ci.yml` — it typechecks, runs the test suite, and does a fixture-data build
on every push/PR. It does **not** rebuild or publish the live dashboard on a schedule; re-run
`npm run build` locally (or wire up your own deploy step) whenever you want a fresh snapshot.
