# Sluglines Asset Register

> **Salvaged 2026-08-22 from the `codex/phase-1` snapshot (`e7b0f49`) during the issue #11 triage,
> and adopted as normative.** The branch it came from is superseded in every other respect — its
> email/password auth and its nine-table schema are both dead — but this file is the only written
> image-rights and image-privacy policy the project has, and issue #18 migrates photographs from
> `sluglines.com` now. Adopted as written; the "Phase 1" in the section heading below is the phase
> it was authored for, not a limit on when it applies. See `Docs/DECISIONS.md` **D-38**.
>
> **The rule #18 turns on:** *"Location pages: reserve a stable 4:3 media area, but show a neutral
> route graphic until a current approved photograph exists."* 18 of the 50 spots have no photograph
> and will not get one from migration. A reserved media area with a designed neutral state is the
> answer this project had already written down — not a broken `<img>`, not stretched filler, and not
> a satellite tile standing in for a photograph nobody took.

The legacy archive at `C:\Users\kalai\OneDrive\Sluglines` is read-only research material. Nothing is copied into production until rights, privacy, and operational accuracy are established.

| Asset group | Decision | Reason |
| --- | --- | --- |
| Code-native route illustration | Approved for Phase 1 | Original, lightweight, accessible, and independent of image rights |
| Current project logo created for the new site | Approved after final brand review | Must be original and include scalable SVG plus raster fallbacks |
| I-395 traffic photograph | Hold | Strong context, but visible plates require cropping or redaction and ownership confirmation |
| Crystal City curbside pickup photograph | Hold | Authentic scene, but people and a vehicle plate are identifiable |
| Pentagon slug-lane sign photograph | Hold | No obvious personal data, but the sign and pickup location need current verification |
| Staffordboro and Pentagon route diagrams from 2018-2019 | Historical only | Operational directions may have changed and embedded map imagery has separate terms |
| Legacy mobile UI slices and PSD/XCF sources | Archive | Useful design history but visually obsolete and not web-ready |
| WordPress generated thumbnails and ShortPixel backups | Do not import | Redundant derivatives with uncertain rights and weak source metadata |
| Facebook saved-page assets | Do not import | Platform assets, duplicated web resources, and unclear publication rights |
| Photos with commuters, readable plates, or incident details | Do not publish without remediation | Privacy, consent, and safety concerns |

## Phase 1 visual requirements

- Hero: original route-line composition that works without JavaScript and respects reduced motion.
- Location pages: reserve a stable 4:3 media area, but show a neutral route graphic until a current approved photograph exists.
- Images: use `next/image`, explicit dimensions, responsive `sizes`, descriptive alt text, and no decorative text baked into the bitmap.
- Photography intake: record creator, capture date, location, consent status, rights, privacy remediation, and verification date.
- Never ship an image directly from the OneDrive archive path.
