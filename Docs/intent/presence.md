# Intent: presence (check-in)

A member standing at a spot can say so; drivers see one more rider waiting, never who. rev. 5.3 §8 M4; `0001`'s `presence_checkin` / `presence_clear`; D-46 (checkout), D-85 (check-in).

## Why

Presence is the feature the 2016 app was praised for: a driver approaching a lot knows whether the line is worth the detour. It is also the cheapest signal a rider can give — one tap, no offer, no reservation — and the one that expires on its own.

## Decisions

- **The control lives on the spot page** (D-85). A rider joining a line is looking at that spot, not a list of fifty. *Rejected:* a picker on `/dashboard` (the 2016 model); removing the check-in copy instead of adding the control.
- **Server actions, not a browser client.** Same reasoning as checkout: no Supabase client shipped for one button, works without JavaScript, the action can persist a refreshed session cookie. *Rejected:* a client component with `@/lib/supabase/client` (D-46 priced it at 62 kB).
- **The id is resolved by slug through the caller's own client**, so `locations_select_active` scopes it and an inactive spot cannot be checked into.
- **Four states are four states.** `signed-out` and `unavailable` never claim "you are not checked in"; only a measured `none` does.

## Invariants

- One row per member (`presence_checkins.member_id` is the key); a check-in elsewhere moves the member, it does not duplicate them.
- A check-in expires (20 minutes by default) without anyone acting.
- Public counts are aggregates over active spots; no member identity leaves the table.

## Done

A signed-in person on the deployed spot page checks in, sees the count move on `/spots` and their check-in on `/dashboard`, and checks out again. Evidence on #135. Needs #47.
