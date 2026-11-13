# metakitty

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
cp .env.example .env   # fill in GITHUB_OAUTH_TOKEN (needs public repo read access)
npm run build           # runs `next build`, writes the static site to out/
npx serve out            # or any other static file server
```

CI publishes this at docs.metasploit.com/stats/ by setting `DASHBOARD_BASE_PATH=/stats` (see
`next.config.ts`); leave it unset locally to serve at the plain root. To reproduce the published
layout locally:

```sh
DASHBOARD_BASE_PATH=/stats npm run build
mkdir -p preview && ln -sfn "$(pwd)/out" preview/stats
npx serve preview   # or: cd preview && python3 -m http.server 8000
# then open http://localhost:3000/stats/ (port depends on which server you used)
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
(`src/lib/stats/repos.ts`); each page is a statically-generated route
(`src/app/queue/[repo]/page.tsx`) that does its own GraphQL fetch and gets its own
`.cache/github-pull-requests-<repo>.json`. A dropdown next to the page title jumps between repos
client-side.

- **Queue overview** stat cards: open PR count, average age, assignment coverage, community vs.
  Rapid7 authorship, module vs. non-module change scope, CI status, review status, and inferred
  target testing environment — each clickable to filter the table below.
- **Pull request table**: sortable by any column, filterable by target environment, change scope,
  CI status, review decision, assignee, and label, plus free-text search.
- **CVE/CVSS evidence**: each PR's touched exploit/auxiliary/post modules (and its title/description)
  are scanned for CVE/GHSA references, resolved to a real CVSS score via OSV.dev, the fkie-cad NVD
  mirror, and the NVD REST API, plus a CISA KEV ("known exploited") check. The "CVE severity" column
  and its evidence popover (`src/components/vulnerability-evidence.tsx`) show severity labels/colors,
  a "Known exploited" badge, and a per-metric CVSS vector breakdown. Only runs on real builds —
  `build:fixture` skips it entirely. See `src/lib/vuln/` and the `NVD_API_KEY`/
  `ADVISORY_CACHE_TTL_DAYS` vars in `.env.example`.

Module scope, the testing-environment heuristic, and the CVE scan are all keyed off
`metasploit-framework`'s `modules/{exploits,auxiliary,post,...}/` layout (see
`src/lib/pull-requests.ts`'s `MODULE_PATH` and `src/lib/testing-environment.ts`), so those
columns/filters read as empty or "Framework / tooling" on other repos.

## Dashboard (`/`, the landing page)

Ported from [rapid7/metakitty](https://github.com/rapid7/metakitty) (the generator behind
[docs.metasploit.com/stats](https://docs.metasploit.com/stats)), tracking issue/PR history across
the public `rapid7/*` repositories whose root `cortex.yaml` declares the `metasploit` domain in
`src/lib/stats/repos.ts`. The landing page (`/`) is the multi-repo
breakdown table; open-pull-requests/bugs/features-and-enhancements over time live at
`/pull-requests`, `/bugs`, `/features-and-enhancements`, alongside the matching "per quarter"
opened/closed rate charts (`/pull-request-rates`, `/bug-rates`, `/feature-and-enhancement-rates`),
a top-committers table, and a "new this week" accordion. Unlike the PR queue, this needs full
issue/PR history (not just currently-open PRs), fetched via GraphQL and persisted to the committed
`data/history/`. That directory is the source of truth, not a TTL-gated cache: a build always
trusts whatever's committed as a baseline and live-fetches only what's missing (a repo new to
`STATS_REPOS`, full history) or changed since the baseline's own `fetchedAt` (every other repo, an
incremental `since`-filtered top-up). Renamed or archived repos are skipped with a warning rather
than failing the build, and transient GitHub API errors are retried with backoff.

It also publishes metakitty's standalone JSON feeds as static assets — `/contributors_all.json`,
`/contributors_month.json`, `/contributors_year.json`, `/commits_modules.json`,
`/commits_merged.json`, `/issues_newbie.json` — used elsewhere on docs.metasploit.com rather than
by any page in this dashboard.

Like the PR queue, `FIXTURE_DATA=1` / `npm run build:fixture` stays fully offline using
`fixtures/sample-stats.json`, `fixtures/sample-contributors.json`, and
`fixtures/sample-module-commits.json`.

### Refreshing the repository list

`STATS_REPOS` is committed so its generated queue routes and historical-data scope are
reproducible. Refresh it explicitly when Cortex ownership changes:

```sh
npm run sync:repos          # query public rapid7 Cortex manifests and update the list
npm run sync:repos:check    # fail if the committed list differs from Cortex
```

The command loads `GITHUB_OAUTH_TOKEN` or `GITHUB_BASIC_AUTH` from the environment or local
`.env`. It excludes archived repositories. Review the resulting diff before committing. A
subsequent live `npm run build` fully fetches history for new repositories and incrementally
refreshes repositories already present in `data/history/`.

## Project layout

- `src/app/` — Next.js App Router: `(stats)/` is a route group holding the Dashboard's `layout.tsx`
  and its 7 pages (`/`, `/pull-requests`, `/bugs`, `/features-and-enhancements`,
  `/pull-request-rates`, `/bug-rates`, `/feature-and-enhancement-rates`), plus the JSON feed
  `route.ts` handlers described above; `queue/page.tsx` is the static index at `/queue/`, and
  `queue/[repo]/page.tsx` loads PR data per repo at build time (real GitHub API, or
  `fixtures/sample-prs.json` when `FIXTURE_DATA=1`); the root `layout.tsx` and `globals.css` set up
  fonts, the shadcn theme, automatic dark mode, and the cross-section `<SiteNav>`.
- `src/lib/` — framework-agnostic logic, fully unit-tested: `github-client.ts` (GraphQL/REST fetch +
  pagination + rate-limit retry), `queue-data.ts` (per-repo PR load/cache/enrich), `pull-requests.ts`
  (maps raw GraphQL nodes), `queue-filter.ts` / `queue-stats.ts` (filter/stat predicates behind the PR
  queue's overview cards), `testing-environment.ts` (target-OS heuristics), `async.ts` (shared
  bounded-concurrency helper); `stats/` holds the Dashboard's dataset fetch/cache/computation
  modules, including `repos.ts`'s `STATS_REPOS`.
- `src/components/` — `dashboard.tsx` (the PR queue's stateful client component), `queue-overview.tsx`,
  `pull-request-table.tsx`, `badges.tsx`, `site-nav.tsx` (the top bar), `ui/` (shadcn-generated
  primitives on top of Radix), and `stats/` (nav, charts, tables, accordion for the Dashboard's
  pages).

## Development

```sh
npm run typecheck   # tsc --noEmit
npm test            # vitest — unit tests for src/lib/*, plus a smoke test that runs a real
                     # `next build` against fixture data and checks out/index.html
```

See `.github/workflows/ci.yml` — it typechecks, runs the test suite, and does a fixture-data build
on every push/PR. It does **not** rebuild or publish the live dashboard on a schedule; re-run
`npm run build` locally (or wire up your own deploy step) whenever you want a fresh snapshot.
