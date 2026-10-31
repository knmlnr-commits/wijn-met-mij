import { describe, expect, it } from "vitest";
import { authConfig } from "@/lib/auth/config";
import { isPublicPath, originFrom, safeNextPath } from "@/lib/auth/redirect";
import { sessionStateFrom } from "@/lib/auth/roles";

describe("auth configuration switches", () => {
  it("dev login is off unless the flag is exactly true", () => {
    expect(authConfig({}).devLogin).toBe(false);
    expect(authConfig({ NEXT_PUBLIC_DEV_LOGIN: "1" }).devLogin).toBe(false);
    expect(authConfig({ NEXT_PUBLIC_DEV_LOGIN: "true" }).devLogin).toBe(true);
  });

  it("dev login is never available on a production deployment", () => {
    expect(authConfig({ NEXT_PUBLIC_DEV_LOGIN: "true", VERCEL_ENV: "production" }).devLogin).toBe(false);
    expect(authConfig({ NEXT_PUBLIC_DEV_LOGIN: "true", VERCEL_ENV: "preview" }).devLogin).toBe(true);
  });

  it("Entra is a configuration switch", () => {
    expect(authConfig({}).entra).toBe(false);
    expect(authConfig({ AUTH_ENTRA_ENABLED: "true" }).entra).toBe(true);
  });
});

describe("redirect after sign in", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/complaints/123?tab=audit")).toBe("/complaints/123?tab=audit");
    expect(safeNextPath(null)).toBe("/");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/login", "/auth/callback", "/ok\nbad"])(
    "refuses %s",
    (next) => {
      expect(safeNextPath(next)).toBe("/");
    },
  );
});

describe("public paths", () => {
  it("lets login, the auth callback, no access and health through", () => {
    for (const path of ["/login", "/auth/callback", "/auth/signout", "/no-access", "/api/health"]) expect(isPublicPath(path)).toBe(true);
  });

  it("protects everything else", () => {
    for (const path of ["/", "/complaints/1", "/settings", "/loginx", "/api/other"]) expect(isPublicPath(path)).toBe(false);
  });
});

describe("site origin for auth redirects", () => {
  const h = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

  it("uses the forwarded host and protocol on Vercel", () => {
    expect(originFrom(h({ host: "internal", "x-forwarded-host": "va-complaints.vercel.app", "x-forwarded-proto": "https" }))).toBe(
      "https://va-complaints.vercel.app",
    );
  });

  it("uses http for localhost", () => {
    expect(originFrom(h({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
});

describe("session state", () => {
  const profile = { id: "u1", display_name: "Demo Handler", email: "handler@example.test", role: "handler" as const, is_active: true };

  it("no session is anonymous", () => {
    expect(sessionStateFrom(null, null)).toEqual({ kind: "anonymous" });
  });

  it("a login without a profile, or with an inactive one, has no access", () => {
    expect(sessionStateFrom("u1", null)).toEqual({ kind: "no_access" });
    expect(sessionStateFrom("u1", { ...profile, is_active: false })).toEqual({ kind: "no_access" });
    expect(sessionStateFrom("u2", profile)).toEqual({ kind: "no_access" });
  });

  it("the role comes from the active profile", () => {
    expect(sessionStateFrom("u1", profile)).toEqual({
      kind: "active",
      user: { id: "u1", email: "handler@example.test", displayName: "Demo Handler", role: "handler" },
    });
  });
});
