# Microsoft Entra ID sign in (production path)

The sandbox runs on invited email users (password or email link). Production switches to
Microsoft Entra ID through the Supabase Azure provider. The switch is configuration only; no code
change is needed.

Based on the Supabase guide "Sign in with Azure (Microsoft)":
https://supabase.com/docs/guides/auth/social-sign-in/auth-azure

## 1. App registration in Entra ID (VA tenant administrator)

1. Azure portal, Microsoft Entra ID, App registrations, New registration.
2. Name: `VA Complaints Management` (or the VAS naming standard).
3. Supported account types: **Accounts in this organizational directory only** (single tenant).
4. Redirect URI, platform **Web**: `https://<project-ref>.supabase.co/auth/v1/callback`
   (the Supabase project callback, not the app URL). For local testing add
   `http://localhost:54321/auth/v1/callback`; Azure does not accept `127.0.0.1`.
5. Register, then note the **Application (client) ID** and the **Directory (tenant) ID**.
6. Certificates and secrets, New client secret. Copy the secret **Value** (not the Secret ID).
   Put the expiry date in the team calendar well ahead of time; an expired secret stops all sign in.
7. Manifest: add the optional claims `email` and `xms_edov` to the ID token (and `xms_edov` to the
   access token), as the Supabase guide shows. `xms_edov` lets Supabase confirm the email address
   is verified, which protects existing accounts from impersonation.
8. Optional but recommended: Enterprise applications, the app, Properties, set
   **Assignment required** to Yes and assign the complaints team group, so only they can sign in.

## 2. Supabase project (VAS platform team)

Authentication, Sign In / Providers, Azure:

| Setting | Value |
|---|---|
| Enabled | On |
| Application (client) ID | from step 1.5 |
| Secret value | from step 1.6 |
| Azure Tenant URL | `https://login.microsoftonline.com/<tenant-id>` (limits sign in to the VA tenant) |

Authentication, URL Configuration: add the app callback for every deployment URL, for example
`https://<app-domain>/auth/callback` and, for Vercel previews,
`https://*-<vercel-team>.vercel.app/auth/callback`.

Keep **Allow new users to sign up** off. With sign up off, a person must exist as a user before
their first Microsoft sign in; Supabase then links the Microsoft identity to that user by its
verified email address.

## 3. Application (Vercel environment variables)

| Variable | Value |
|---|---|
| `AUTH_ENTRA_ENABLED` | `true` to show "Sign in with Microsoft" |
| `NEXT_PUBLIC_DEV_LOGIN` | not set (dev login is also blocked on production deployments in code) |

## 4. Giving someone access

1. A Manager invites the user by email (Settings, Users; phase 4) and chooses the role.
   This creates the Supabase user and the active profile.
2. The user signs in with Microsoft using the same email address.
3. A Microsoft login without an active profile reaches the "No access yet" page and sees no data;
   RLS denies every query for users without an active profile.

To remove access, a Manager deactivates the profile. Access ends at the next request.

## 5. Cut over checklist

- [ ] App registration created, single tenant, `xms_edov` and `email` claims added
- [ ] Supabase Azure provider enabled with the tenant URL
- [ ] Redirect URLs added for production and previews
- [ ] `AUTH_ENTRA_ENABLED=true` on the production environment
- [ ] Each user invited with the email address that matches their Microsoft account
- [ ] Test: a user with a profile signs in; a user without a profile lands on "No access yet"
- [ ] Decide whether to keep password and email link sign in as a fallback (open item)
