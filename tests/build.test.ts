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

  it("renders the fixture pull requests and queue overview into index.html", () => {
    const html = readFileSync(resolve(rootDir, "out/index.html"), "utf8");
    expect(html).toContain("Add exploit module for Example Corp Widget RCE");
    expect(html).toContain("Queue overview");
    expect(html).toContain("rapid7/metasploit-framework open pull requests");
  });
});
