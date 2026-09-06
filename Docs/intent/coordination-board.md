# Intent: the coordination board (`/board`)

One page where a driver posts a seat and a rider takes one, for the Horner Rd ↔ L'Enfant Plaza pilot corridor. rev. 5.3 §8 M3; PR #115 built the thin loop; D-82, D-87, D-90 shape it.

## Why

The WhatsApp groups already clear the market every morning. What breaks is state: an offer scrolls away, a stale one is trusted, a rider is left at the curb. The board holds the state the chat loses — who is offering, who has a seat, what changed — and nothing else. It is the source of truth; anything else (an assistant, a notification) accelerates it and can be removed without loss.

## Decisions

- **One corridor, named by slug, resolved per request.** The pair is `horner-rd` / `lenfant-plaza`; the ids come from the `locations` rows of the database serving the request (D-82). *Rejected:* committed uuids (they matched nothing; every post raised 23503), and a service-role lookup (bypasses the member's own read policy).
- **The database decides; the route reports.** Every write is a SECURITY DEFINER function with a revision check and an idempotency key (D-30). A route or a server action never re-derives authority. *Rejected:* client-side checks as enforcement.
- **Bounded offers.** ≤ 4 hours long, start ≤ 14 days out and ≥ 1 hour ago, ≤ 5 open per member (D-87). *Rejected:* a CHECK constraint (cannot see `now()` safely or count per member); bounding in the route only.
- **Undo belongs to the owner.** A poster cancels their offer; a rider releases their ACTIVE seat; a CONFIRMED seat waits on #148. Both are server actions with keys derived from (offer, revision) so a double tap replays (D-90). *Rejected:* a fourteenth route (§8 M3 names thirteen); a rider cancelling the whole offer (D-83 closed that).
- **Riders first.** Open offers at the top with a live region and a 30 s visibility-aware poll; the viewer's own rows under "Yours"; the post form last, with "leaving in N minutes" presets (D-90). *Rejected:* Realtime now (a 62 kB browser client, D-46); a separate "my rides" page.

## Invariants

- No offer row is visible to `anon`; no member row is ever written except through a function that reads `auth.uid()`.
- `PT409` means one thing: the seat was just taken. `409` is never used for anything else.
- A refusal without a SQLSTATE is reported as an outage, never as a decision.
- Times are shown in `America/New_York` and say so.

## Done

A signed-in person on the deployed `/board` posts with a preset, sees the offer under "Yours", cancels it; reserves someone else's seat, sees it under "Yours", releases it; and watches the list refresh on its own. Evidence on #132, #137, #140. Needs #47 (a reachable deployment) and, for the live suites, #41.
