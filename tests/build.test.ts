import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

describe("next build (static export) against fixture data", () => {
  beforeAll(() => {
    execFileSync("node_modules/.bin/next", ["build"], {
      cwd: rootDir,
      env: { ...process.env, FIXTURE_DATA: "1" },
      stdio: "inherit",
    });
  }, 120_000);

  it("writes a static export to out/", () => {
    expect(existsSync(resolve(rootDir, "out/index.html"))).toBe(true);
    expect(existsSync(resolve(rootDir, "out/_next"))).toBe(true);
  });

  it("exports every route as <route>/index.html, not a flat <route>.html", () => {
    // Plain static file servers (a bare `http.server`, S3 website hosting, ...) only resolve
    // clean URLs like /queue to a directory's index.html, not to a same-named flat file — see
    // next.config.ts's trailingSlash comment. Lock in that this doesn't silently regress.
    for (const route of [
      "queue",
      "queue/metasploit-framework",
      "contributors",
      "issues",
      "modules",
    ]) {
      expect(existsSync(resolve(rootDir, "out", route, "index.html"))).toBe(true);
      expect(existsSync(resolve(rootDir, "out", `${route}.html`))).toBe(false);
    }
  });

  it("renders the Dashboard's repositories breakdown as the landing page at index.html, each repo linking to its PR queue", () => {
    const html = readFileSync(resolve(rootDir, "out/index.html"), "utf8");
    expect(html).toContain("Metasploit Repositories");
    expect(html).toContain("metasploit-framework");
    expect(html).toContain("Top committers this last month");
    expect(html).toContain('href="/queue/metasploit-framework/"');
  });

  it("renders the Open Pull Requests steady-state chart at /contributors/", () => {
    const html = readFileSync(resolve(rootDir, "out/contributors/index.html"), "utf8");
    expect(html).toContain("Open Pull Requests");
    expect(html).toContain("recharts");
  });

  it("renders the module type chart and browsable tree at /modules/", () => {
    const html = readFileSync(resolve(rootDir, "out/modules/index.html"), "utf8");
    expect(html).toContain("Module Stats");
    expect(html).toContain("Modules by type");
    expect(html).toContain("recharts");
    expect(html).toContain("xslt_password_reset");
  });

  it("renders a queue index at /queue/ linking to the flagship repo's queue", () => {
    const html = readFileSync(resolve(rootDir, "out/queue/index.html"), "utf8");
    expect(html).toContain('href="/queue/metasploit-framework/"');
  });

  it("renders the fixture pull requests and queue overview at /queue/metasploit-framework/, linking back to /", () => {
    const html = readFileSync(resolve(rootDir, "out/queue/metasploit-framework/index.html"), "utf8");
    expect(html).toContain("Add exploit module for Example Corp Widget RCE");
    expect(html).toContain("Queue overview");
    expect(html).toContain("rapid7/metasploit-framework open pull requests");
    expect(html).toContain('href="/"');
  });

  it("writes the 6 standalone JSON feeds as static assets with fixture content", () => {
    const contributorsMonth = JSON.parse(readFileSync(resolve(rootDir, "out/contributors_month.json"), "utf8"));
    expect(contributorsMonth).toEqual(expect.arrayContaining([expect.objectContaining({ login: "alice" })]));

    const commitsModules = JSON.parse(readFileSync(resolve(rootDir, "out/commits_modules.json"), "utf8"));
    expect(commitsModules).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("Land #") })]));

    const commitsMerged = JSON.parse(readFileSync(resolve(rootDir, "out/commits_merged.json"), "utf8"));
    expect(commitsMerged).toEqual(expect.arrayContaining([expect.objectContaining({ project: "rex" })]));

    const issuesNewbie = JSON.parse(readFileSync(resolve(rootDir, "out/issues_newbie.json"), "utf8"));
    expect(issuesNewbie).toEqual(expect.arrayContaining([expect.objectContaining({ project: "metasploit-framework" })]));

    for (const file of ["contributors_all.json", "contributors_year.json"]) {
      expect(existsSync(resolve(rootDir, "out", file))).toBe(true);
    }
  });
});
