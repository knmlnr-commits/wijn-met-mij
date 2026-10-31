# CLAUDE.md; Van Ameyde Complaints Management

Internal tool for complaint handlers to register, investigate, track and resolve insurance
complaints within the UK FCA DISP timeline and the Lloyd's complaints procedure. Tier 2
(departmental) app under the Governed Citizen Development model: keep it small, standard and
easy to hand over.

The functional source of truth is `docs/VA_Complaint_Specification.docx` (build 38a7212).
The previous .NET + React build lives in `knmlnr-commits/complaintsmanager`; use it as reference
for behaviour only, never port its code.

## Stack (approved by Emanuel Rita, Development Lead, 29-10-2026)

- Next.js App Router, TypeScript strict (no unused locals or parameters), deployed on Vercel.
- Supabase: Postgres and Supabase Auth. No separate backend service; server logic lives in
  route handlers and server actions.
- Schema as plain SQL migrations in `supabase/migrations`. Portable Postgres; Supabase specific
  features limited to Auth and RLS. All data access goes through `lib/db/*` so a move to
  AWS Aurora Postgres stays contained to that layer and the auth adapter.
- Styling: plain CSS (global tokens in `app/globals.css`, CSS modules per component). No
  component library.
- Tests: Vitest (rules engine, server logic, house style), Playwright (smoke of the main flow).
- No connections to ECHO, I&T or any other VA application.

## Where things live

- `lib/rules/`: the rules engine. Pure TypeScript, no framework, database or I/O imports.
  All timeline maths, eligibility checks and RAG status go through it. Regulatory constants
  exist only in `lib/rules/constants.ts`; never repeat a regulatory number elsewhere.
- `lib/domain/`: status, outcome and other codes shared by validation, data layer and UI.
- `lib/validation/`: zod schemas for every server action input.
- `lib/db/`: repository layer, the only code that talks to Supabase. `createUserClient()` runs
  as the signed in user under RLS; `createServiceClient()` (service role) is for admin tasks
  without a user session only. Database errors go through `toDataError` so constraint details
  (which can hold personal data) never reach the UI or logs.
- `lib/complaints/`: view models (timeline per complaint, KPIs, filters, risk sort) and the
  action policy (`availableActions`: which actions are possible and why not). Server actions
  call `assertActionAllowed` before any write.
- `lib/reports/`: DISP 1.10 MI and CSV (formula injection safe).
- `lib/letters/`: the four letter templates (pure), referral wording from firm settings (FOS;
  Lloyd's then FOS for Lloyd's insurers). Missing wording renders as a `[[ ]]` placeholder and
  blocks sending. `lib/email/`: `EmailProvider` (stub by default; no content or full address
  in logs).
- `app/`: screens. Server actions live next to their pages (`app/complaints/actions.ts`,
  `app/settings/actions.ts`); every one runs requireRole, zod and the policy, then a repo call.
- `lib/auth/`: `requireRole(...)` for every server action and route handler;
  `requirePageUser(...)` for pages. `proxy.ts` (Next 16's renamed middleware) only refreshes
  the session and sends visitors without one to `/login`; roles come from `profiles` only.
  Sign in: invited users by password or email link; `NEXT_PUBLIC_DEV_LOGIN=true` shows seeded
  demo logins (never on production deployments); `AUTH_ENTRA_ENABLED=true` shows Microsoft
  sign in (`docs/ENTRA_SETUP.md`). Redirect targets always go through `safeNextPath`.
- `supabase/migrations/`: schema, RLS (default deny), audit trigger, one Postgres function per
  workflow action. `app.current_user_id()` is the only reference to Supabase Auth in SQL.
- `supabase/tests/auth-shim.sql`: test only stand in for Supabase Auth on plain Postgres.
- `scripts/`: seed scripts (bank holidays from gov.uk, demo users and 25 synthetic complaints).
- `docs/OPEN_ITEMS.md`: every `TODO(CONFIRM)`.

## Rules for every change

1. Never invent regulatory values, insurer data or taxonomy values. Seed only what is in
   `/docs` or the build prompt; mark anything else `TODO(CONFIRM)` and add it to
   `docs/OPEN_ITEMS.md`.
2. Synthetic data only. No real complainant data anywhere, including tests and screenshots.
3. After each phase: `npm run check` (typecheck, lint, tests), commit with a clear message,
   short status (done, open, decisions taken).
4. Enforce roles server side in every server action and route handler (`requireRole`), not
   only in the UI. Validate every input with zod. No personal data in logs or error messages.
5. Every workflow action and edit writes a `complaint_events` row in the same transaction.
   Complaints, events and notifications have no direct write grant; change them only through
   a workflow function in `supabase/migrations`. Rules that depend on the regulatory clock
   (summary eligibility, deadlines) are checked with the rules engine in the server action;
   the database enforces roles, state and the audit trail.
6. The Supabase service role key is used only in server code and seed scripts.
7. Never edit an applied migration; add a new one. Keep `EDITABLE_FIELDS` in
   `lib/domain/complaint.ts` and `app.editable_complaint_fields()` in step (a test checks).

## House style (enforced by `tests/house-style.test.ts`)

- Never use the long dash (U+2014) or the en dash (U+2013) in UI copy, letters, seed data,
  code comments or docs. Use ; or , instead. (`AGENTS.md` is generated by Next.js and is
  not scanned.)
- Van Ameyde colours only: Navy #07017E, Turquoise #00D8B9, Misty Rose #E5D3D1, plus white
  and neutral greys. Use the CSS variables in `app/globals.css`, never raw hex in components.
- Fonts: Georgia for headers, Verdana for body. No other fonts, no web font downloads.
- UK English. Dates shown dd-mm-yyyy; amounts in GBP with two decimals. Timestamps stored in
  UTC (`timestamptz`); business dates stored as `date` and handled as ISO `yyyy-mm-dd`
  strings in the rules engine.

## Commands

```bash
npm run dev        # local app
npm run check      # typecheck, lint, unit and house style tests
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npm run test
                   # adds the database tests: migrations, RLS per role, workflow functions
npm run build      # production build
npm run test:e2e   # Playwright smoke (set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium)
```
