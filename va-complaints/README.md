# Van Ameyde Complaints Management

Internal tool for complaint handlers to register, investigate, track and resolve insurance
complaints within the UK FCA DISP timeline and the Lloyd's complaints procedure.

Status: release candidate in progress. Phase 0 (scaffold) and phase 1 (rules engine) are in
place; database, authentication and screens follow. See `CLAUDE.md` for conventions and
`docs/OPEN_ITEMS.md` for items awaiting confirmation.

## Local setup

Requires Node 20.9 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Supabase setup (`supabase start`, migrations and seed) is added in
phase 2.

## Checks

```bash
npm run check
npm run build
npm run test:e2e
```
