# Van Ameyde Complaints Management

Internal tool for complaint handlers to register, investigate, track and resolve insurance
complaints within the UK FCA DISP timeline and the Lloyd's complaints procedure.

Status: release candidate, version 0.7.0 (see `lib/changelog.ts` or What's new in the app).

| Document | For |
|---|---|
| `docs/ARCHITECTURE.md` | How it is built, the security model, what an Aurora move changes |
| `docs/SANDBOX_SETUP.md` | Platform team: create the Supabase and Vercel projects, smoke test checklist |
| `docs/ENTRA_SETUP.md` | Microsoft Entra ID sign in for production |
| `docs/HUGO_QUESTIONS.md` | Release candidate status, stack, integrations, unorthodox requirements |
| `docs/OPEN_ITEMS.md` | Everything awaiting confirmation |
| `CLAUDE.md` | Conventions for anyone (or any assistant) changing the code |

## Local setup

Requires Node 20.9 or later and Docker (for the local Supabase stack).

```bash
npm install
npx supabase start          # local Supabase; prints the URL and keys for .env.local
npx supabase db reset       # applies supabase/migrations and supabase/seed.sql
cp .env.example .env.local  # fill in the keys printed by supabase start and a demo password
npm run seed:holidays       # England and Wales bank holidays from gov.uk
npm run seed:demo           # three demo users and 25 synthetic complaints
npm run dev
```

Open http://localhost:3000. Set `NEXT_PUBLIC_DEV_LOGIN=true` in `.env.local` for one click demo
logins, or sign in with a password. Demo users: `handler@example.test`, `manager@example.test` and
`compliance@example.test`, with the password you set in `DEMO_USER_PASSWORD`.

The demo seed loads placeholder values for product, channel, nature of complaint, root cause,
secondary cause and vulnerability category, so the sandbox has content. The real lists come from
the source documents (see `docs/OPEN_ITEMS.md`). `GET /api/health` is the liveness check.

## Checks

```bash
npm run check                 # typecheck, lint, all unit tests
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npm run test
                              # also runs the database tests (migrations, RLS per role, workflow)
npm run build
npm run test:e2e              # browser smoke; E2E_FULL=1 with a seeded Supabase runs the main flow
```

CI runs the database tests against a Postgres service container and the main flow in a browser
against a local Supabase, on every pull request.
