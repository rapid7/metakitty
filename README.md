# metasploit-dashboard

A static site covering the `rapid7/metasploit-framework` project and its surrounding `rapid7/*`
repos: a **Dashboard** of historical issue/PR stats at `/` (the landing page), and a live **open
pull request queue** at `/queue/<repo>/` for every repo in `src/lib/stats/repos.ts`, inspired by
[gh-review](../gh-review)'s dashboard. It's a [Next.js](https://nextjs.org) app built
with [shadcn/ui](https://ui.shadcn.com) (on Radix primitives) and exported as a fully static site
(`output: "export"`): Server Components fetch everything via the GitHub GraphQL/REST APIs at
*build time*, and the interactive parts (filtering, sorting, search, popovers) hydrate as normal
React client components. There's no server or database at runtime — `next build` writes a
self-contained `out/` directory you can host on any static file server (GitHub Pages, S3, nginx,
`npx serve out`, ...).

## Usage

```sh
npm install
cp .env.example .env   # fill in GITHUB_OAUTH_TOKEN (needs public repo read access); Next.js loads
                        # it from .env automatically
npm run build           # runs `next build`, writes the static site to out/
npx serve out            # or any other static file server — out/index.html (the Dashboard) uses
                          # root-relative asset paths, so it won't load correctly via file://
                          # (every route exports as <route>/index.html — trailingSlash: true in
                          # next.config.ts — so even a bare `python3 -m http.server` resolves
                          # internal links like /queue/ correctly)
```

To build from the bundled fixture data instead of hitting the real GitHub API (useful for local
iteration or CI, no token required):

```sh
npm run build:fixture
```

`npm run dev` runs the normal Next.js dev server (`next dev`) if you want to iterate on the UI
without waiting for a full export each time.

## What's in the PR queue (`/queue/<repo>/`)

`/queue/` is an index linking to one of these pages per repo in `STATS_REPOS`
(`src/lib/stats/repos.ts` — the same ~34-repo list the Dashboard uses); each page is a
statically-generated route (`src/app/queue/[repo]/page.tsx`, via `generateStaticParams`) that does
its own GraphQL fetch and gets its own `.cache/github-pull-requests-<repo>.json`. A dropdown next
to the page title (`Dashboard`'s repo switcher) jumps between repos client-side.

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

Module scope, the testing-environment heuristic, and the CVE scan are all keyed off
`metasploit-framework`'s `modules/{exploits,auxiliary,post,...}/` layout (see
`src/lib/pull-requests.ts`'s `MODULE_PATH` and `src/lib/testing-environment.ts`). Nothing gates
them per repo — they just naturally find no modules on a repo without that directory, so those
columns/filters read as empty (module scope) or "Framework / tooling" (testing environment)
everywhere except `metasploit-framework` itself.

## Dashboard (`/`, the landing page)

Ported from [rapid7/metakitty](https://github.com/rapid7/metakitty) (the generator behind
[docs.metasploit.com/stats](https://docs.metasploit.com/stats)), tracking issue/PR history across
the ~30 `rapid7/*` repos in `src/lib/stats/repos.ts`. The landing page (`/`) is the multi-repo
breakdown table; open-pull-requests/bugs/features-and-enhancements over time live at
`/pull-requests`, `/bugs`, `/features-and-enhancements`, alongside the matching "per quarter"
opened/closed rate charts (`/pull-request-rates`, `/bug-rates`, `/feature-and-enhancement-rates`),
a top-committers table, and a "new this week" accordion. Unlike the PR queue
below, this needs full issue/PR history (not just currently-open PRs), fetched via GraphQL and cached to
`.cache/github-historical-issues.json` with a much longer TTL (`GITHUB_HISTORY_CACHE_TTL_MINUTES`, default
24h) since historical/closed data barely changes build-to-build. A repo that's since been renamed/archived
is skipped with a warning rather than failing the build; transient GitHub API errors (e.g. a 502) are
retried with backoff instead. On a cold cache, `npm run build` logs progress to the console as it goes —
per-repo completion counts, periodic page counts for large repos, and contributor-profile resolution
progress — since the full fetch across ~30 repos can take a while.

It also publishes metakitty's standalone JSON feeds as static assets — `/contributors_all.json`,
`/contributors_month.json`, `/contributors_year.json`, `/commits_modules.json`, `/commits_merged.json`,
`/issues_newbie.json` — even though no page in this dashboard renders them; they existed in metakitty as
inputs to a widget elsewhere on docs.metasploit.com, not as part of the 7 stats pages themselves.

Like the PR queue, `FIXTURE_DATA=1` / `npm run build:fixture` stays fully offline using
`fixtures/sample-stats.json`, `fixtures/sample-contributors.json`, and `fixtures/sample-module-commits.json`.

## Project layout

- `src/app/` — Next.js App Router: `(stats)/` is a route group (adds no URL segment) holding the
  Dashboard's `layout.tsx` and its 7 pages at `/` (the repositories breakdown, also the landing
  page), `/pull-requests`, `/bugs`, `/features-and-enhancements`, `/pull-request-rates`,
  `/bug-rates`, `/feature-and-enhancement-rates`, plus the 6
  JSON feed `route.ts` handlers described above; `queue/page.tsx` is the static index at `/queue/`
  linking to each repo's queue, and `queue/[repo]/page.tsx` is the async Server Component +
  `generateStaticParams` that loads PR data per repo at build time (real GitHub API, or
  `fixtures/sample-prs.json` when `FIXTURE_DATA=1`, which only generates the primary repo); the root
  `layout.tsx` and `globals.css` set up fonts, the shadcn theme, automatic (OS-preference) dark mode,
  and the cross-section `<SiteNav>`.
- `src/lib/` — framework-agnostic logic, fully unit-tested: `github-client.ts` (GraphQL/REST fetch +
  pagination + rate-limit retry), `queue-data.ts` (per-repo PR load/cache/enrich, used by
  `queue/[repo]/page.tsx`), `pull-requests.ts` (maps raw GraphQL nodes), `queue-filter.ts` /
  `queue-stats.ts` (the filter/stat predicates driving the PR queue's overview cards),
  `testing-environment.ts` (target-OS heuristics from file paths + PR description), `async.ts`
  (shared bounded-concurrency helper); `stats/` holds the Dashboard's dataset fetch/cache/computation
  modules, including `repos.ts`'s `STATS_REPOS` — the repo list both the Dashboard and the PR queue
  iterate over.
- `src/components/` — `dashboard.tsx` (the PR queue's stateful client component: all filter/sort/
  search state, plus a repo-switcher dropdown), `queue-overview.tsx`, `pull-request-table.tsx`,
  `badges.tsx`, `site-nav.tsx` (the top bar — a "Metasploit Stats" brand linking to `/`, a `/queue`
  link, and external links to docs.metasploit.com and GitHub, mirroring metakitty's original
  navbar), `ui/` (shadcn-generated primitives on top of Radix), and `stats/` (nav, charts, tables,
  accordion for the Dashboard's pages).

## Development

```sh
npm run typecheck   # tsc --noEmit
npm test            # vitest — unit tests for src/lib/*, plus a smoke test that runs a real
                     # `next build` against fixture data and checks out/index.html
```

See `.github/workflows/ci.yml` — it typechecks, runs the test suite, and does a fixture-data build
on every push/PR. It does **not** rebuild or publish the live dashboard on a schedule; re-run
`npm run build` locally (or wire up your own deploy step) whenever you want a fresh snapshot.
