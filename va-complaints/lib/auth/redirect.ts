/** Paths reachable without a session. Everything else redirects to the login page. */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/signout", "/no-access", "/api/health"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * A safe place to send the user after signing in: a path on this site only. Anything else
 * (absolute URLs, protocol relative `//host`, backslash tricks) falls back to the dashboard,
 * so the login page cannot be used as an open redirect.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(next)) return "/";
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/auth/")) return "/";
  return next;
}

/** The site origin for auth redirects, from the request headers (Vercel sets x-forwarded-*). */
export function originFrom(headers: { get(name: string): string | null }, fallback = "http://localhost:3000"): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return fallback;
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}
