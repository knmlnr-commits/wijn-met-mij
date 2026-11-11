# Sandbox setup

For the VAS platform team. A sandbox already exists and can be used as the reference:

| Item | Value |
|---|---|
| Supabase project | `va-complaints-sandbox`, region London (eu-west-2). TODO(CONFIRM) region with Emanuel Rita |
| Vercel project | `va-complaints`, root directory `va-complaints`, functions in London (lhr1), Node 22 |
| Repository | `knmlnr-commits/wijn-met-mij`, application in `va-complaints/`. TODO(CONFIRM): move to a VAS repository |

To build a fresh one, follow the steps below.

## 1. Supabase project

1. Create a project in the UK or EU region.
2. Authentication, Sign In / Providers: switch **Allow new users to sign up** off. Leave the
   **Email** provider itself enabled; switching the provider off blocks every password and
   email link sign in.
3. Authentication, Password security: minimum length 12; switch leaked password protection on.
4. Authentication, URL configuration: add `https://<app-domain>/auth/callback` (and the Vercel
   preview pattern if previews are used).
5. Apply the schema from the repository:

```bash
cd va-complaints
```

```bash
npx supabase link --project-ref <project-ref>
```

```bash
npx supabase db push
```

6. Load the reference seed (firm settings, insurers, complainant types) by running
   `supabase/seed.sql` in the SQL editor.

## 2. Vercel project

1. New project from the GitHub repository; **Root Directory** `va-complaints`; framework
   Next.js; Node 22; function region London.
2. Keep Vercel Authentication on for preview deployments.
3. Environment variables:

| Variable | Environments | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all | Publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | all, sensitive | Service role key; needed to invite users from Settings |
| `NEXT_PUBLIC_DEV_LOGIN` | preview only | `true` for the demo login buttons; never on production |
| `DEMO_USER_PASSWORD` | preview only, sensitive | Password of the three demo users |
| `EMAIL_PROVIDER` | all | `stub` (nothing is sent). Real provider: TODO(CONFIRM) |
| `AUTH_ENTRA_ENABLED` | production, later | `true` once Entra ID is configured (`docs/ENTRA_SETUP.md`) |

## 3. Demo data (sandbox only)

Synthetic data only; never load it into production.

```bash
npm run seed:demo
```

It needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` and
`DEMO_USER_PASSWORD` in the environment. It creates the three demo users, demo list values, the
built in bank holidays and 25 synthetic complaints.

## 4. First real users

Sign in as a Manager, Settings, Users, Invite a user. The first Manager has to be created by
hand: create the user in Supabase Authentication, then insert a row in `profiles` with the same
id, role `manager` and `is_active` true.

## 5. Smoke test checklist

- [ ] `GET /api/health` returns `{"status":"ok", ...}`
- [ ] The header shows the expected version and build
- [ ] Without a session every page redirects to `/login`
- [ ] Sign in as Handler: the dashboard lists complaints with a next step and a RAG reason
- [ ] Register a complaint: the timeline preview appears and the complaint opens after saving
- [ ] Record the acknowledgement: an audit entry and a letter draft appear
- [ ] Record a final response: status Resolved, FOS window shown on the clock
- [ ] Reports: figures appear and Export CSV downloads a file
- [ ] Sign in as Compliance: no actions offered, everything readable
- [ ] Sign in as Manager: Settings opens; Bank holidays, Load the latest dates from gov.uk works
- [ ] Framework shows the insurer profiles and the loaded bank holiday range
- [ ] Supabase advisors (security) show no errors

The same main flow runs automatically in CI against a local Supabase (`e2e` job).

## 6. Before real complaint data goes in

See `docs/OPEN_ITEMS.md`. At minimum: the real lists and letter wording from the
specification, the vulnerability coding, a real email provider, Entra ID sign in, replacing the
demo users and their password, and removing the demo complaints.
