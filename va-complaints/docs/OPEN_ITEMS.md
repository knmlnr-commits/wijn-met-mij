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
