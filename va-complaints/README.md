# Van Ameyde Complaints Management

Internal tool for complaint handlers to register, investigate, track and resolve insurance
complaints within the UK FCA DISP timeline and the Lloyd's complaints procedure.

Status: release candidate in progress. Done: phase 0 (scaffold), phase 1 (rules engine,
`lib/rules`) and phase 2 (database, RLS, workflow functions, seed). Authentication and screens follow. See `CLAUDE.md` for conventions and
`docs/OPEN_ITEMS.md` for items awaiting confirmation.

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

Open http://localhost:3000. Demo users: `handler@example.test`, `manager@example.test` and
`compliance@example.test`, with the password you set in `DEMO_USER_PASSWORD`.

The seeded reference lists for product, channel, nature of complaint, root cause, secondary
cause and vulnerability category stay empty until the source documents are supplied (see
`docs/OPEN_ITEMS.md`).

## Checks

```bash
npm run check                 # typecheck, lint, all unit tests
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npm run test
                              # also runs the database tests (migrations, RLS per role, workflow)
npm run build
npm run test:e2e
```

CI runs the database tests on every pull request against a Postgres service container.
