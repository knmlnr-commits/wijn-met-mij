# Architecture

Van Ameyde Complaints Management; tier 2 (departmental) app under the Governed Citizen
Development model. One Next.js application on Vercel, one Supabase project. No other services
and no connections to other VA applications.

## Components

| Component | Technology | Role |
|---|---|---|
| Web application | Next.js App Router, TypeScript strict, on Vercel (London region) | Screens, server actions and route handlers; there is no separate backend |
| Database | Supabase Postgres (London) | Tables, row level security, workflow functions, audit trail |
| Authentication | Supabase Auth | Invited users by password or email link; Microsoft Entra ID behind a switch |
| CI | GitHub Actions | Typecheck, lint, unit, database and browser tests on every pull request |

## Data flow

1. The browser requests a page. `proxy.ts` refreshes the session cookie and sends visitors
   without a session to `/login`.
2. A server component reads data through the repository layer (`lib/db/*`) as the signed in
   user, so row level security applies to every query.
3. A form posts to a server action. The action checks the role (`requireRole`), validates the
   input (zod), checks the action against the rules engine (`lib/complaints/policy.ts`), then
   calls one database function for that workflow step.
4. The database function checks the role and state again, makes the change and writes the
   audit event in the same transaction.
5. Nothing personal is written to logs; database errors are mapped to safe messages
   (`lib/db/errors.ts`).

## Where the business rules live

- `lib/rules/`: the rules engine. Pure TypeScript with no framework, database or network
  imports (a test enforces this). All deadlines, business days, RAG status, FOS window and
  retention come from here; regulatory numbers exist only in `lib/rules/constants.ts`.
- Per insurer deadlines are data (`insurers` table), resolved as insurer value, else firm
  setting, else engine default (`lib/db/profile.ts`).
- `lib/complaints/`: which actions are possible and why not (`policy.ts`), the next step
  (`next-step.ts`), dashboard figures and sorting (`view.ts`).
- `lib/letters/`: the four letter templates; referral wording comes from firm settings.
- `lib/reports/`: DISP 1.10 management information and CSV.

## Security model

- **Roles** come from `profiles.role` only: handler, manager, compliance. A login without an
  active profile has no access.
- **Row level security** is on for every table, default deny. Active users read; managers
  maintain settings, lists, users and bank holidays; compliance is read only; anonymous has
  no access at all.
- **Complaints, audit events and notifications have no direct write grant.** They change only
  through the workflow functions (`supabase/migrations/*_workflow.sql`,
  `*_notifications.sql`), which are `SECURITY DEFINER` and check the caller's role themselves.
- **Audit trail** (`complaint_events`) is append only: a trigger rejects update, delete and
  truncate for every role. The only exception is the permanent deletion of a complaint after
  its retention period, which is logged without personal data.
- **Received date** cannot be in the future and cannot be changed (trigger).
- **Service role key** is used server side only, for inviting users and by the seed scripts.
- Each role's access is covered by tests in `tests/db/` (run in CI against Postgres).

## Authentication

Sandbox: email and password or an email link, for invited users only; sign up is off. A dev
login (three demo users) appears only with `NEXT_PUBLIC_DEV_LOGIN=true` and is refused on
production deployments. Production path: Microsoft Entra ID through the Supabase Azure
provider, switched on with `AUTH_ENTRA_ENABLED=true`; see `docs/ENTRA_SETUP.md`.

## A later move to AWS Aurora Postgres

The schema is plain SQL migrations in portable Postgres. What is Supabase specific, and so
what changes:

| Area | Today | For Aurora |
|---|---|---|
| Data access | `lib/db/*` through the Supabase client (PostgREST) | Reimplement `lib/db/*` on a Postgres driver; nothing else imports the client |
| User identity in SQL | `app.current_user_id()` returns `auth.uid()` | Change that one function to read the identity the new auth layer sets per request |
| `profiles.id` | Foreign key to `auth.users` | Point to the new user store |
| Sessions | Supabase Auth cookies (`lib/auth/session.ts`, `proxy.ts`, `app/login`, `app/auth`) | Replace with the VAS standard (for example Entra ID directly) |
| Roles `anon`, `authenticated`, `service_role` | Provided by Supabase | Create equivalent database roles; `supabase/tests/auth-shim.sql` shows the minimum |

The rules engine, validation, policy, letters, reports and all screens are unaffected.
