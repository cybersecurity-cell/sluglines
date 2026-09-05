# DNS cutover runbook — `sluglines.com` → Vercel

**Issue:** #25 · **Spec:** `Docs/specs/2026-08-21-p2-content-cutover.md` AC29, AC30
**Status:** written, **not executed**. The DNS change is owner-performed.

This is a living operational document, not a dated record: it is edited in place when the facts
change, and it is the file the owner reads at the moment of cutover.

---

## 0. Measured starting state

Verified 2026-09-05 from an ordinary shell. Re-verify immediately before executing — if any row
disagrees, **stop** and reconcile before touching DNS.

| Fact | Value | How it was checked |
|---|---|---|
| Apex `sluglines.com` A record | `148.72.60.215` (GoDaddy shared hosting) | `nslookup sluglines.com` |
| `www.sluglines.com` | CNAME → apex, resolves to the same IP | `nslookup www.sluglines.com` |
| Authoritative nameservers | `ns73.domaincontrol.com`, `ns74.domaincontrol.com` (GoDaddy) | `nslookup -type=NS sluglines.com` |
| Observed TTL on the apex A record | **10777 s ≈ 3 h** | `nslookup -type=A -debug sluglines.com` |
| What the apex serves today | WordPress (43 `wp-content` refs in the HTML) | `curl -s https://sluglines.com \| grep -c wp-content` |
| Vercel project | `kalaikandasamy-4291s-projects/sluglines` | `vercel projects ls` |
| Vercel production URL | `https://sluglines.vercel.app`, **publicly reachable, HTTP 200** | `curl -sI https://sluglines.vercel.app` |
| `sluglines.com` attached to the Vercel project? | **No** — not present in `vercel domains ls` | `vercel domains ls` |

**The domain is not yet attached to the Vercel project.** That is step 2 and it is safe: adding a
domain changes nothing about where traffic goes until the DNS record itself moves.

---

## 1. Preconditions — all must hold before step 3

- [ ] `sluglines.vercel.app` serves the current build and the 165-route check passes against it:
      `node scripts/verify-legacy-routes.mjs https://sluglines.vercel.app`
- [ ] The public surface carries no false claims. (#114 fixed three; re-read `/`, `/spots`,
      `/lostfound`, `/app` before pointing real traffic at them.)
- [ ] Decide what `/login` does on cutover day. **Phone auth is disabled in production** (#52), so
      sign-in returns 500 today. Either close #52 first, or accept that the site ships
      read-only — #112 makes that failure honest rather than a generic "try again", which is the
      minimum bar for shipping it.
- [ ] `Docs/consolidated-architecture.md` §15 Q2 answered — static archive or full 410 after the
      overlap window. This gates step 7, not step 3.
- [ ] Someone is available for the 3 hours after the change. Do not cut over on a Friday afternoon.

---

## 2. Attach the domain (safe, reversible, no traffic moves)

In the Vercel dashboard for project `sluglines`, or:

```
vercel domains add sluglines.com
vercel domains add www.sluglines.com
```

Vercel will state the exact record values it wants. **Use the values Vercel prints, not the ones
below** — they are recorded here only so a reader knows the shape to expect:

- apex `sluglines.com` → an **A** record at Vercel's anycast address (historically `76.76.21.21`,
  but confirm in the dashboard)
- `www` → **CNAME** to `cname.vercel-dns.com`

Vercel will show the domain as **Invalid Configuration** until step 3. That is expected and is not
an error.

---

## 3. Lower the TTL — do this FIRST, and wait

The current TTL is ~3 hours. That is also how long a bad cutover stays broken. So:

1. At GoDaddy DNS management for `sluglines.com`, edit the apex **A** record and the `www` record
   and set **TTL = 600 s (10 min)**. Change nothing else.
2. **Wait at least 3 hours** (one full old-TTL cycle) so resolvers everywhere have picked up the
   short TTL.
3. Confirm: `nslookup -type=A -debug sluglines.com` shows a TTL near 600.

Skipping this step is the single most common way a DNS cutover becomes a three-hour outage instead
of a ten-minute one.

---

## 4. Cut over

At GoDaddy, on the same two records:

1. Apex `@` **A** → the Vercel address from step 2.
2. `www` **CNAME** → `cname.vercel-dns.com`.
3. Leave MX, TXT (SPF/DKIM), and any verification records **untouched**. Email is not part of this
   change and breaking it is the other classic failure.

Record the wall-clock time. Then watch:

```
nslookup sluglines.com 8.8.8.8
nslookup sluglines.com 1.1.1.1
curl -sI https://sluglines.com | head -3
```

Vercel issues the TLS certificate automatically once the record resolves to it. Expect a few
minutes of certificate provisioning during which HTTPS may error — this is normal and self-resolves.
If it has not cleared in 30 minutes, that is a real problem: go to step 6.

---

## 5. Verify — this is the acceptance evidence for #25

```
node scripts/verify-legacy-routes.mjs https://sluglines.com
```

Must report **165 of 165**, the same as it does against `sluglines.vercel.app`. Then by hand:

- [ ] `https://sluglines.com/` renders the Next.js homepage, not WordPress
      (`curl -s https://sluglines.com | grep -c wp-content` → **0**)
- [ ] `https://www.sluglines.com/` reaches the same site
- [ ] `https://sluglines.com/spots/horner-rd` renders
- [ ] `https://sluglines.com/forum/anything` → **410** with the branded gone page
- [ ] `https://sluglines.com/api/health` → `"status":"ok"`
- [ ] Certificate valid, no mixed-content warnings
- [ ] One mobile check on a real phone on cellular, not just a resized desktop browser

Post the URL, timestamp, and what was observed on #25. Per `AGENTS.md`, that evidence — not green
CI — is what closes the issue.

---

## 6. Rollback — real, and available for 30 days

**The recovery path is reverting the DNS record.** It works because WordPress is still running and
still paid for. This is the entire reason step 7 is deferred.

1. At GoDaddy, set the apex **A** record back to **`148.72.60.215`**.
2. Set `www` back to a CNAME pointing at the apex.
3. With TTL at 600 s, expect recovery in **~10 minutes**, not 3 hours.
4. Confirm: `curl -s https://sluglines.com | grep -c wp-content` returns a non-zero count again.

**Write `148.72.60.215` down somewhere outside this repo before starting step 4.** If the cutover
goes wrong you will want it without needing a working git checkout.

Roll back if: the 165-route check fails, HTTPS has not provisioned within 30 minutes, or the site
is materially worse than the WordPress one for real visitors. A cosmetic defect is not a rollback
trigger — fix forward.

---

## 7. WordPress cancellation — SEPARATE, IRREVERSIBLE, NOT THIS ISSUE

**Do not perform this as part of the cutover.** Per `Docs/consolidated-architecture.md` §11 Phase 2
and #25:

- No earlier than **30 days** after a successful cutover.
- Only after §15 Q2 is answered (static archive vs. full 410).
- WordPress stays **read-only** during the overlap so in-flight forum threads can conclude, with a
  notice posted on the legacy board.
- **This is the point of no return.** Once hosting is cancelled, step 6 stops working and the only
  recovery is restoring from a backup that may not exist.

Take a full export of the WordPress site — database and uploads — **before** cancelling, and store
it outside GoDaddy. The legacy content already lives in `src/data/legacy-site-content.json`, but
that is a derived artefact, not a backup of the source system.

---

## Open questions this runbook cannot answer

- **§15 Q2** — static archive at e.g. `archive.sluglines.com`, or full 410 after the overlap?
  Gates step 7.
- **#39** — rights on the 27 legacy location diagrams. A legal question, not a technical one.
- **#52** — is the site shipping with sign-in working, or read-only? Affects the cutover
  announcement copy, and whether `/login` should be linked at all on day one.
