# Answers to the four questions from Hugo Matthioli

## 1. What is the release candidate status?

Version 0.6.3 is a working release candidate running in a sandbox (Vercel preview and a
Supabase project in London) with synthetic data only.

Built and tested: registration, the regulatory clock per insurer, every workflow step with an
audit trail, the four letters, DISP 1.10 reporting with CSV export, settings for Managers, three
roles, and an in-app explanation of the process. Automated checks: more than 220 unit and
database tests, including access per role, plus a browser test of the main flow in CI.

Not ready for real complaint data yet. The open points are listed in `docs/OPEN_ITEMS.md`; the
main ones are the real reference lists and letter wording from the specification, the W&C
vulnerability coding, a real email provider and Entra ID sign in.

## 2. Does it adhere to the approved stack?

Yes. Next.js (App Router, TypeScript strict) on Vercel, Supabase Postgres and Supabase Auth,
GitHub with preview deployments per pull request; as confirmed by Emanuel Rita on 29-10-2026.

- No separate backend: server logic is in Next.js server actions and route handlers.
- Schema as plain SQL migrations in `supabase/migrations`; portable Postgres.
- Supabase specific parts are limited to Auth and row level security, and all data access sits
  behind one layer (`lib/db`), so a later move to AWS Aurora stays contained
  (`docs/ARCHITECTURE.md`).
- Plain CSS, no component library. Vitest and Playwright for tests.

## 3. Does it integrate with other VA applications?

No. There are no connections to ECHO, I&T or any other VA application in this release.

Outbound calls: one, to `www.gov.uk` for the bank holiday list, only when a Manager presses
the button in Settings. Email is a stub; nothing is sent.

## 4. Are there unorthodox requirements?

Nothing outside the stack, but the platform team should know about these choices:

| Topic | What | Why |
|---|---|---|
| Database functions | Each workflow step is a Postgres function (`SECURITY DEFINER`) called from the app | The change and its audit entry are one transaction, so they cannot drift apart |
| Append only audit trail | A trigger blocks update and delete on `complaint_events`, also for administrators | Regulatory evidence; the only exception is deletion after the retention period |
| Service role key | Stored as a server side secret in Vercel | Needed to invite users from Settings; never sent to the browser |
| Dev login | Demo users behind `NEXT_PUBLIC_DEV_LOGIN`, refused on production in code | Sandbox demonstrations only |
| Vercel `proxy.ts` | Runs on every request to refresh the session | Standard Supabase pattern for Next.js |
| Scheduled breach digest | A daily email of breaching complaints through Vercel Cron | **Not built**; optional and off by default; would need the real email provider |
| Data residency | Supabase and Vercel functions both in London | UK complaint data; region still to be confirmed with Emanuel Rita |
