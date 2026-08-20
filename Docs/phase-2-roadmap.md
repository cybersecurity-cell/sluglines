# Phase 2 Roadmap: Assistance and Community Intake

Phase 2 starts only after the Phase 1 directory, authentication, provenance model, and release gates are stable. It should reuse the same Next.js, Supabase, GitHub, and Vercel layers rather than create a separate data silo.

## Verified-information chatbot

The first assistant should answer only from published Sluglines records and approved guidance. Retrieval results must carry record IDs, source links, verification status, and review dates into the answer. If evidence is missing or stale, the assistant should say so and link to the correction form. It must not invent operating times, wait counts, or safety assurances.

Suggested sequence:

1. Add searchable, versioned content chunks derived from published database records.
2. Build a text-only assistant with citations and a strict “insufficient evidence” response.
3. Log question category, cited record IDs, latency, and feedback without storing unnecessary personal content.
4. Add evaluation fixtures for common routes, stale records, unsafe requests, and prompt injection.
5. Consider voice only after the text assistant meets answer-quality, privacy, accessibility, and cost targets.

## Facebook and WhatsApp intake

Do not scrape groups or import private conversations. Consumer WhatsApp groups should not be treated as an accessible data feed. Facebook group access depends on platform policy, app review, administrator authorization, and the permissions available at implementation time.

Use an explicit intake boundary:

```text
Approved submission or platform webhook
  -> quarantine record
  -> remove personal data
  -> normalize location and destination
  -> deduplicate
  -> steward review and corroboration
  -> publish with source, status, and expiry
```

Potential adapters, subject to current platform approval:

- Facebook Page webhooks for content on a page the organization administers.
- Meta APIs only where group administrators explicitly authorize the application and current permissions allow the use case.
- WhatsApp Business Platform webhooks for messages deliberately sent to an official business number, not private group history.
- A moderator submission form, forwarded email address, or shared-link inbox for groups that cannot or should not connect an API.
- Official transportation feeds and agency advisories, which should outrank social reports.

Every intake item needs the originating platform, URL or message reference, received time, consent basis, location match, duplicate key, verification status, reviewer, expiry, and publication decision. Raw private content should have a short retention period and must never be used directly as public copy.

## Agentic delivery commands

Keep one release goal per phase. Each goal should define scope, non-goals, tests, migration authority, preview verification, merge conditions, production smoke tests, and rollback rules. A future assistant goal should not be allowed to modify the trusted location model or publish social input without the same RLS, test, review, and provenance gates used in Phase 1.
