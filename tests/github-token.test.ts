import { afterEach, describe, expect, it } from "vitest";
import { resolveGitHubToken } from "../src/lib/github-token";

function clearEnv() {
  delete process.env.GITHUB_OAUTH_TOKEN;
  delete process.env.GITHUB_BASIC_AUTH;
}

describe("resolveGitHubToken", () => {
  afterEach(clearEnv);

  it("returns undefined when neither env var is set", () => {
    clearEnv();
    expect(resolveGitHubToken()).toBeUndefined();
  });

  it("prefers GITHUB_OAUTH_TOKEN when set directly", () => {
    process.env.GITHUB_OAUTH_TOKEN = "  direct-token  ";
    expect(resolveGitHubToken()).toBe("direct-token");
  });

  it("extracts the token half of a GITHUB_BASIC_AUTH username:token pair", () => {
    process.env.GITHUB_BASIC_AUTH = "x-access-token:ghs_abc123";
    expect(resolveGitHubToken()).toBe("ghs_abc123");
  });

  it("prefers GITHUB_OAUTH_TOKEN over GITHUB_BASIC_AUTH when both are set", () => {
    process.env.GITHUB_OAUTH_TOKEN = "direct-token";
    process.env.GITHUB_BASIC_AUTH = "x-access-token:ghs_abc123";
    expect(resolveGitHubToken()).toBe("direct-token");
  });

  it("treats a GITHUB_BASIC_AUTH value with no ':' as the whole token, rather than discarding it", () => {
    process.env.GITHUB_BASIC_AUTH = "bare-token-no-colon";
    expect(resolveGitHubToken()).toBe("bare-token-no-colon");
  });

  it("splits on the first ':' only, so a token containing ':' stays intact", () => {
    process.env.GITHUB_BASIC_AUTH = "x-access-token:ghs_abc:with:colons";
    expect(resolveGitHubToken()).toBe("ghs_abc:with:colons");
  });

  it("trims surrounding whitespace from a GITHUB_BASIC_AUTH pair", () => {
    process.env.GITHUB_BASIC_AUTH = "  x-access-token:ghs_abc123  ";
    expect(resolveGitHubToken()).toBe("ghs_abc123");
  });
});
