/**
 * Resolves the GitHub token used for every build-time API call. Prefers `GITHUB_OAUTH_TOKEN`
 * directly; otherwise falls back to extracting the token half of `GITHUB_BASIC_AUTH`'s
 * `username:token` pair.
 */
export function resolveGitHubToken(): string | undefined {
  const direct = process.env.GITHUB_OAUTH_TOKEN?.trim();
  if (direct) return direct;

  const basicAuth = process.env.GITHUB_BASIC_AUTH?.trim();
  if (!basicAuth) return undefined;

  const separatorIndex = basicAuth.indexOf(":");
  // No "user:" prefix — treat the whole value as the token rather than silently dropping it.
  if (separatorIndex === -1) return basicAuth;
  return basicAuth.slice(separatorIndex + 1).trim();
}
