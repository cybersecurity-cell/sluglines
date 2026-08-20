# Phase 1 Security Review

Status: implementation review complete; live RLS execution, the final clean-tree Codex Security scan, and production verification remain release gates.

## Trust boundaries

- The browser receives only the Supabase project URL and anonymous public key.
- Next.js server actions validate input and re-fetch the authenticated user before private mutations.
- PostgreSQL row-level security is the authoritative isolation boundary for profiles, preferences, saved locations, and correction reports.
- Editors and administrators can manage public operational content through database policies; commuter roles cannot.
- Social networks and archive files are untrusted research inputs. They never publish automatically.
- CI receives a short-lived local Supabase service key only for the isolated end-to-end test stack. No service key is exposed through a `NEXT_PUBLIC` variable.

## Reviewed controls

| Area | Control |
| --- | --- |
| Authentication | Generic sign-in errors, non-enumerating reset response, 12-character minimum, verification callback code exchange, server-side `getUser` checks, refreshed SSR cookies |
| Redirects | Only same-origin absolute paths are accepted; protocol-relative, absolute, backslash, and control-character values are rejected |
| Authorization | RLS on all nine Phase 1 tables; owner IDs come from the authenticated user, not trusted form fields; staff roles are checked by a locked-down security-definer helper |
| Profile integrity | Broad inherited update grants are revoked; commuters can update only display name and legacy preference columns; a trigger prevents self-promotion |
| Public content | Published records require a source; inactive sources suppress public records; route, location, and advisory freshness is shown independently |
| Link safety | Database source URLs require HTTPS and domain projection drops malformed, credential-bearing, and non-HTTPS links |
| Form abuse | Native length limits plus server validation; correction honeypot; authenticated ownership; database-enforced five-report-per-hour quota protected by a per-user advisory lock; server-owned report state and timestamps; database length and category constraints |
| Personal data | Profiles and report details are owner/staff-only; activity is not published; archive photos, exports, private messages, faces, and license plates are excluded |
| Legacy prototype | Anonymous live-count writes and the public reset RPC are revoked while old data is preserved |
| Browser baseline | CSP, frame denial, MIME sniffing prevention, restricted referrers, and disabled camera/microphone/geolocation permissions |
| Secrets | `.env.local`, Vercel state, private documents, and local research DOCX files are ignored; static secret scan is a release check |
| Release tooling | Vercel is an exact, lockfile-backed development dependency and deployment uses only the installed binary. Production dependency audit excludes development-only CLI code that is never bundled or deployed. First-party GitHub actions are commit-pinned; Supabase's v1 setup action downloads an exact CLI release. |

## Required release evidence

- Execute the migration and pgTAP suite on a clean local or remote Supabase test database.
- Prove anonymous reads, cross-user denial, role self-promotion denial, commuter content-write denial, and editor content-write access.
- Run the production dependency audit and secret scan against the committed lockfile.
- Run the complete registration, verification gate, login, preferences, saved-location, correction, logout, and password-recovery journey.
- Run desktop and mobile checks for CSP violations, console errors, accessibility violations, and unsafe redirects.
- Complete a repository-wide Codex Security scan and resolve every validated critical or high-severity finding before production promotion.

## Verified locally

- Strict TypeScript, ESLint, 16 Vitest tests, 49 focused Node tests, SQL policy audit, secret-pattern audit, and the Next.js production build pass.
- Desktop and mobile Chromium cover 40 public/auth/accessibility/console assertions with no browser console errors; the two stateful account variants correctly skip without the local Supabase service key.
- The stateful account journey and pgTAP policy suite remain CI gates because CI provisions an isolated local Supabase stack and service key.
