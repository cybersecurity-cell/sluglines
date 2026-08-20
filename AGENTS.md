## Imported Claude Cowork project instructions

# Slug Lines — Cowork Task List (Trimmed)
# Phases 1 + 2 already complete. Start from Phase 3.
# Paste each task individually into the Slug Lines Cowork project.

---

## ALREADY DONE — DO NOT REBUILD
- Folder structure, config files, Next.js + Tailwind setup
- Supabase client + server (src/lib/supabase/)
- All pages: homepage, about, dashboard, how-it-works, spots, [slug]
- Navbar.tsx
- RealTimeBoard.tsx (reference this for real-time pattern)

---

## PHASE 3 — Core Components (START HERE)

### Task 3a — LocationCard Component
Build src/components/LocationCard.tsx for Slug Lines.
Shows for one slug location:
- Location name and direction (e.g. "Horner Road → Pentagon")
- Live rider count (large, prominent number)
- Live driver count
- Last updated timestamp
- "Check In as Rider" and "Check In as Driver" buttons
Reference RealTimeBoard.tsx for the existing Supabase real-time pattern.
Mobile-first, Tailwind only. No inline styles.

### Task 3b — CheckIn Component
Build src/components/CheckIn.tsx.
Slide-up sheet/modal that appears when user taps Check In.
Fields:
- Destination (dropdown: Pentagon, Crystal City, L'Enfant Plaza, DC)
- Seats available (drivers only, number input 1-3)
On submit: upsert to riders or drivers Supabase table.
Auto-checkout logic: if checked_in_at is > 2 hours ago, treat as stale.
Use existing Supabase client from src/lib/supabase/client.ts.

### Task 3c — AlertBanner Component
Build src/components/AlertBanner.tsx.
Shows community alerts for a location.
Displays last 3 alerts with:
- Message text
- Timestamp (relative: "2 mins ago")
- Type badge: info (blue), warning (yellow), urgent (red)
Real-time subscription to alerts table filtered by location_id.
Dismiss button per alert.

---

## PHASE 4 — Wire Up Existing Pages

### Task 4a — Wire Homepage to Real Data
Update src/app/page.tsx.
Currently likely shows placeholder content.
Replace with: fetch all active locations from Supabase,
render as LocationCard components in a grid.
Auto-detect nearest location via browser GPS (with permission prompt).
Pin nearest location to top of list.
Handle loading state and empty state gracefully.

### Task 4b — Wire Spots Detail Page
Update src/app/spots/[slug]/page.tsx.
Fetch location by slug from Supabase.
Render: LocationCard (live counts) + AlertBanner + CheckIn button.
Add a simple anonymous activity feed: last 10 check-ins for this location,
shown as "A rider checked in 4 mins ago" — no names, anonymized.
Handle 404 if slug not found.

### Task 4c — Wire Dashboard Page
Update src/app/dashboard/page.tsx.
Show all locations in a compact list with live counts.
Commuter's checked-in status at top if they are currently checked in.
One-tap checkout button if currently checked in.
This is the "power user" view — frequent commuters who just want counts fast.

---

## PHASE 5 — Real-time Hook

### Task 5a — useLocationCounts Hook
Build src/hooks/useLocationCounts.ts.
Custom hook: subscribes to real-time changes on riders and drivers tables
filtered by location_id.
Returns: { riderCount, driverCount, lastUpdated, isLoading }
Cleans up Supabase subscription on unmount.
Use this hook inside LocationCard to replace any direct fetches.

### Task 5b — useUserCheckIn Hook
Build src/hooks/useUserCheckIn.ts.
Tracks current user's check-in status across the app.
Returns: { isCheckedIn, checkedInLocation, checkedInAs, checkOut }
checkOut function: deletes user's row from riders or drivers table.
Persists check-in state in localStorage as fallback if session is lost.

---

## PHASE 6 — Push Notifications

### Task 6a — Notification Permission Flow
Build src/lib/notifications.ts.
Request browser push notification permission on first check-in.
If granted: create VAPID subscription and store in Supabase
push_subscriptions table (create migration for this table).
If denied: show inline message "Enable notifications to get alerts
when drivers arrive at your spot."

### Task 6b — Alert Notification Trigger
When a new alert is inserted into alerts table for a location:
Send push notification to all subscribers of that location.
Build as a Supabase Edge Function: supabase/functions/notify-alert/index.ts
Payload: { title: "Slug Lines Alert", body: alert.message, locationId }
Include the VAPID send logic using web-push library.

---

## PHASE 7 — PWA

### Task 7a — PWA Manifest
Create public/manifest.json for Slug Lines.
name: "Slug Lines", short_name: "SlugLines"
theme_color: (match Tailwind primary color)
display: standalone, start_url: /
icons: at least 192x192 and 512x512 (create placeholder SVG icons)
Update next.config.js to include PWA manifest link in headers.

---

## PHASE 8 — CI/CD

### Task 8a — CI Workflow
Create .github/workflows/ci.yml.
Triggers on PRs to main and staging.
Steps: checkout → npm ci → tsc --noEmit → eslint → done.

### Task 8b — Deploy Workflow
Create .github/workflows/deploy.yml.
main branch → sluglines.com (Vercel production)
staging branch → staging.sluglines.com
Use secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
