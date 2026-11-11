import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, RateLimitError, graphqlRequest, restGet } from "../src/lib/github-client";

const QUERY = "query { rateLimit { remaining resetAt cost } }";

function okGraphQLResponse() {
  return new Response(JSON.stringify({ data: { rateLimit: { remaining: 100, resetAt: new Date(Date.now() + 3_600_000).toISOString(), cost: 1 }, ok: true } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function statusResponse(status: number, statusText: string, body = "") {
  return new Response(body, { status, statusText });
}

async function runWithFakeTimers<T>(promise: Promise<T>): Promise<T> {
  // Retries sleep via setTimeout; fast-forward through every pending timer so the test doesn't
  // actually wait out the real exponential backoff. Promise.all attaches a handler to `promise`
  // synchronously (before any `await`), so a rejection during the timer flush below is never
  // briefly "unhandled" from Node's perspective.
  const [result] = await Promise.all([promise, vi.runAllTimersAsync()]);
  return result;
}

describe("github-client retry-on-transient-error", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("graphqlRequest retries a 502 and succeeds once GitHub recovers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(statusResponse(502, "Bad Gateway", "<html>502</html>"))
      .mockResolvedValueOnce(statusResponse(502, "Bad Gateway", "<html>502</html>"))
      .mockResolvedValueOnce(okGraphQLResponse());

    const promise = graphqlRequest("token", QUERY, {});
    const result = await runWithFakeTimers(promise);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ ok: true });
  });

  it("graphqlRequest throws after exhausting retries on a persistent 502", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(statusResponse(502, "Bad Gateway", "<html>502</html>"));

    const promise = graphqlRequest("token", QUERY, {});
    await expect(runWithFakeTimers(promise)).rejects.toThrow(/502/);
  });

  it("graphqlRequest does not retry a non-transient error", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(statusResponse(400, "Bad Request", "bad query"));

    const promise = graphqlRequest("token", QUERY, {});
    await expect(runWithFakeTimers(promise)).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("graphqlRequest retries a network-level failure (not just HTTP error responses)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(okGraphQLResponse());

    const promise = graphqlRequest("token", QUERY, {});
    const result = await runWithFakeTimers(promise);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true });
  });

  it("graphqlRequest eventually throws RateLimitError when rate-limited past retrying", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(statusResponse(403, "Forbidden"));

    const promise = graphqlRequest("token", QUERY, {});
    await expect(runWithFakeTimers(promise)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("restGet retries a 503 and succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(statusResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }));

    const promise = restGet("token", "https://api.github.com/repos/rapid7/metasploit-framework/contributors");
    const { data } = await runWithFakeTimers(promise);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data).toEqual([{ id: 1 }]);
  });

  it("restGet throws NotFoundError immediately on 404, without retrying", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(statusResponse(404, "Not Found"));

    const promise = restGet("token", "https://api.github.com/repos/rapid7/renamed-repo/contributors");
    await expect(runWithFakeTimers(promise)).rejects.toBeInstanceOf(NotFoundError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
