# Open items

Every `TODO(CONFIRM)` in the code is listed here. Nothing below is invented; where a value is
needed to run the sandbox, a demo value is used and marked.

## Known from the build prompt

| # | Item | Current handling | Owner |
|---|---|---|---|
| 1 | W&C vulnerability category coding | `ref_vulnerability_category` created empty | W&C |
| 2 | Labels for complainant type codes LH and MA | Codes shown as is | W&C |
| 3 | Is "compensation amount" the same value as the redress on the final response? | Built as one field | W&C |
| 4 | "FOS decision" versus "Ombudsman decision" | Two fields; assumed investigator view versus final ombudsman decision | W&C |
| 5 | Duplicate values in `Complaint_Field_Requirements.xlsx` sheet 1: "Other general admin/customer service" twice in column A; "Claim - quantum" and "Claim - delay" twice in column B | Each value seeded once | W&C |
| 6 | FOS wording reads "you must do within six months" | Seeded verbatim, editable by a Manager; confirm before go live | Compliance |
| 7 | Retention periods per insurer | Demo values from spec section 5 seeded | W&C |
| 8 | Supabase region (EU or UK) and the real email provider (AWS SES or another provider approved by VAS) | `stub` email provider is the default | Emanuel Rita |

## Found while building

| # | Item | Current handling | Owner |
|---|---|---|---|
| 9 | `VA_Complaint_Specification.docx` and `Complaint_Field_Requirements.xlsx` are not yet in `/docs` | Reference tables (nature, root cause, secondary cause, product, channel) and the FOS and Lloyd's wording are not seeded until the files are supplied | Koen Molenaar |
| 10 | Acknowledgement default: the build prompt sets 5 business days; build 38a7212 used 1 | Engine default is 5; every seeded insurer sets its own value (1 or 2), so seeded behaviour is unchanged | Compliance |
| 11 | Amber window for Allianz: build 38a7212 seeded 10 days; the spec section 5 table in the build prompt has no amber column | All seeded insurers use the default 14 days | W&C |
| 12 | RAG colours: red, amber and green are not brand colours | Functional status colours, always shown with a text label | Brand owner |
| 13 | Bank holidays outside the range of the gov.uk feed (the feed covers a limited number of years ahead) | Dates outside the loaded range are treated as normal business days; the Framework page will show the loaded range | Platform team |
| 14 | FOS contact details (name, address, phone, website) | To be held as an editable firm setting, not a code constant | Compliance |
| 15 | Acknowledgement once resolved: if a complaint is summary resolved, or gets a final response, before an acknowledgement is sent | No acknowledgement is required any more, so no acknowledgement breach; a late acknowledgement is recorded (`acknowledgementLate`) for MI but is not red | Compliance |
| 16 | Holding response wording at eight weeks: DISP 1.6 requires the delay response, with FOS rights, by the end of eight weeks | The engine flags `holdingRequiresFosRights` from the deadline day itself (build 38a7212 only added FOS wording the day after) | Compliance |
| 17 | Retention for a complaint received on 29 February | Rolls forward to 1 March, so retention is never shortened | Compliance |
| 18 | Closing a complaint without a final response or summary resolution (for example withdrawn) | Not yet decided; the clock would show red after the deadline. To settle in phase 4 | W&C |
| 19 | The gov.uk bank holiday feed is blocked from the build container | Rules tests use fixed 2026 fixture dates; the seed script fetches the live feed wherever it runs (laptop, CI or the sandbox) | Platform team |
| 20 | Referral to the FOS before a final response: DISP lets a complainant refer once eight weeks have passed without a final response; the build prompt allows referral only after a final response | Built as the prompt says (`refer_to_fos` needs a final response) | Compliance |
| 21 | Changing the insurer (complaint type) after registration | Not editable, because it moves the regulatory clock; a wrongly classified complaint is soft deleted and registered again | W&C |
| 22 | Vulnerability: with `ref_vulnerability_category` empty, a complaint cannot be saved as vulnerable (the category is required when yes) | Strict rule kept; supplying the W&C coding (item 1) unblocks it. Urgent before real use | W&C |
| 23 | Firm name and short name used in letters and "upheld against" | Seeded as "Van Ameyde" for both | W&C |
| 24 | Hard delete when neither the insurer nor the firm settings hold a retention period | Blocked, so a record is never purged on an assumed period; all seeded insurers have one | Compliance |
| 25 | Who may see soft deleted complaints | Manager and Compliance; hidden from handlers | Compliance |
| 26 | Keep password and email link sign in as a fallback once Microsoft Entra ID is live | Both stay available until decided; switching Entra on does not remove them | Emanuel Rita |
| 27 | Entra app registration (tenant, client secret owner and expiry, user assignment) | Documented in `docs/ENTRA_SETUP.md`; not configured | VAS platform team |
| 28 | Email delivery for sign in links in the sandbox: Supabase's built in mailer is rate limited and meant for testing | Fine for a handful of invited users; a custom SMTP sender is needed before wider use (ties in with item 8) | VAS platform team |
