/** Short git SHA and environment for the header version chip. Read at build time on Vercel. */
export function appVersion(): { sha: string; env: string } {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
  return { sha, env };
}
