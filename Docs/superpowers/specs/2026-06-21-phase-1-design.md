# Sluglines Phase 1 Design

## Product outcome

Phase 1 turns Sluglines into a trustworthy, mobile-first information service for Northern Virginia commuters. Visitors can find a line, understand its direction and destinations, inspect freshness-labelled advisories, and learn the etiquette. Registered commuters can save locations and preferences and submit corrections. Real-time rider matching, chatbot, voice, notifications, and social-network ingestion remain outside this release.

## Experience architecture

The public navigation is Find a Line, Locations, Advisories, How It Works, Safety, Community, and Sign In/Account. The homepage answers three questions in order: where can I travel, is anything changing, and how does slugging work? Location pages show direction, destinations, parking/transit context, source attribution, verification status, and last review date without presenting historical material as current fact.

The interface uses a light, high-contrast civic palette with blue as the route/action color, green for verified information, amber for review-needed information, and red only for urgent notices. Typography uses `next/font`; pages remain readable at 320px, keyboard-operable, and compatible with reduced-motion preferences. A code-native route illustration provides the initial hero visual so the release does not depend on uncertain image rights. Archive photographs are not published unless they contain no personal data and their location/date can be verified.

## Application architecture

Next.js App Router server components fetch shared public data through focused repository functions. Client components are limited to search/filter controls and Supabase auth interactions. Server actions handle authenticated mutations and revalidate affected routes. Authorization is rechecked in server code and PostgreSQL RLS; request middleware/proxy only refreshes sessions and redirects as a convenience.

The data model contains `locations`, `destinations`, `location_routes`, `sources`, `advisories`, `profiles`, `saved_locations`, `commute_preferences`, and `correction_reports`. Public operational records carry `verification_status`, `last_verified_at`, and a source relationship. Published data is publicly readable. A commuter can only read and modify their own profile, preferences, saved locations, and reports. Editors and administrators can manage published information through role-gated policies.

## Authentication

Supabase Auth owns registration, email verification, password login, password reset, sessions, and logout. An `auth.users` trigger creates the matching profile. `/account` is protected in the server component and exposes profile, commute preferences, saved locations, and report history. Email verification and reset redirects are allowlisted to the application origin.

## Content and provenance

The two supplied reference documents and legacy archive are research inputs, not canonical copy. Production wording is original. Seed data includes a conservative set of well-known locations with explicit review status. Unsupported volume, safety, wait-time, and historical claims are removed. Community links are presented as external resources, never automatically ingested or endorsed.

## Testing and release safety

Vitest and Testing Library cover domain functions, repositories through injected clients, components, forms, and accessibility checks. Playwright covers navigation, search, auth screens, protected-route behavior, preferences, saved locations, and correction reports. SQL policy tests run against a local or CI Supabase stack when Docker is available; a deterministic SQL policy audit still runs without Docker. CI requires lint, typecheck, unit/component/accessibility tests, SQL checks, build, and Playwright smoke tests.

Database changes use forward-compatible migrations. The tested preview artifact is promoted only after CI, browser verification, migration verification, and a security review. Production is smoke-tested after deployment, with rollback or a forward fix if the release is unhealthy.

## Operational boundaries

Secrets, legacy database dumps, user exports, contact lists, and signing keys never enter the repository. Personal data is minimized. Correction reports are authenticated, rate-limitable, and private to their submitter and staff. No commuter identity appears on public pages.
