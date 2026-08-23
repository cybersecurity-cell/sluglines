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

## Appendix — `sluglines.com/images/slugging_locations/`, classified 2026-08-22

Every asset under that path was pulled and **visually inspected** for issue #18. 27 distinct files, referenced by 25 of the 42 legacy spot pages. All 42 pages were reachable and **no URL was dead**.

**None of the 27 is a photograph of a location.**

| Kind | Count | What it actually is |
|---|---|---|
| Satellite / aerial tile | 12 | Google Maps imagery, several carrying a visible `Google` credit, `Map data ©2016 Google`, and a `www.sluglines.com` watermark. `Route17.jpg` and `Mine_Road.jpg` are unannotated tiles. |
| Third-party transit or parking schematic | 8 | VDOT, VRE, WMATA and Fairfax County lot diagrams — bus-bay listings, space counts, ADA and bicycle-parking legends. `Crystal_City_12th_St.jpg` and `Crystal_City_23rd_St.jpg` are the **same** WMATA station map. |
| Annotated aerial route diagram | 6 | 2018–2019 change notices: *"Changes to Slug pickup location at the Pentagon going to Stafford"*, *"New traffic pattern at the pentagon starting feb 26 2018"*, *"Directions from Frontier Garage to I-95 Express Lanes"*. |
| Promotional flyer | 1 | `21st-Street.jpg` — a marketing graphic with a speech bubble, the Sluglines logo, a Facebook group URL, a Twitter handle and `admin@SlugLines.com`. |
| **Photograph of a spot** | **0** | — |

### Consequences under the rules above

- **The satellite tiles fail the "not a satellite tile posing as a photograph" line outright**, and they embed Google Maps imagery, which this register already flags: *"embedded map imagery has separate terms."*
- **The route diagrams are the entry this register already classifies as `Historical only`** — *"Staffordboro and Pentagon route diagrams from 2018-2019 … operational directions may have changed."* Two of them are dated 2018 in their own filenames.
- **The transit schematics are third-party operator material**, usable by link rather than by copy, per `Docs/content-sources.md`'s hierarchy (*"link to the operator rather than copying"*).
- **The flyer carries contact details** and is a publication artefact, not a location record.

So under D-39 **no asset was migrated**, and all 50 spots rendered the reserved no-photograph
state.

### Superseded in part — D-58, 2026-08-22

The owner directed that legacy content and images be migrated. **8 of the 27 were**: the
third-party transit and parking schematics — drawn agency lot diagrams with bus-bay listings,
space counts and legends. They ship as *diagrams*, never captioned as photographs, with their
`sourceUrl` recorded and the issuing agency's credit left in the pixels.

**19 were held out, and the reason differs by kind:**

| Kind | Held out because |
|---|---|
| Satellite / aerial tile (12) | Google Maps imagery carrying Google's own credit and terms. Rehosting it in this repo is the one thing on this list that is not the owner's to license. |
| Annotated aerial route diagram (6) | Dated 2018-2019. In a media slot with no date on it they would read as current operational instructions, which is the failure D-31 and D-33 exist to prevent. They belong to the content migration, where a date can be shown. |
| Promotional flyer (1) | `21st-Street.jpg` is a marketing graphic carrying `admin@SlugLines.com`, a Facebook URL and a Twitter handle. It is not a record of a location at all. |

The 8 that shipped, and the spots they serve: `Bobs.jpg`, `14th_St_at_Commerce_Dept.jpg`,
`Crystal_City_12th_St.jpg` (**two** spots — 12th St and 23rd St publish the same WMATA station
map), `Lorton.jpg`, `Rolling_Valley.jpg`, `Saratoga.jpg`, `Sydenstricker.jpg`. Seven files, eight
spots. The remaining 42 spots still render the reserved no-diagram state.

`tests/spot-photos.test.mjs` pins the count at 8 and refuses any image whose `sourceUrl` is not
under `slugging_locations/` — which is also what keeps the three `/images/`-root assets
(`Franconia-Springfield.jpg`, `Landmark-Mall.jpg`, `Van-Dorn-St.jpg`) out, all three being Google
aerials.

### Two audit corrections

1. Issue #18 recorded *"32 legacy spots with a photo, 10 without"*. The real figure is **25 with an asset, 17 without**. The gap is exactly the assets the issue's own guidance excludes: 3 spots whose only image sits at `sluglines.com/images/` rather than `…/slugging_locations/` (`Franconia-Springfield.jpg`, `Landmark-Mall.jpg`, `Van-Dorn-St.jpg`), 3 whose only image is an `lh5.googleusercontent.com` commenter avatar (`mark-center`, `navy-yard`, `rosslyn`), and 1 whose only image is the `direction.png` UI icon (`telegraph-rd`). 25 + 3 + 3 + 1 = 32.
2. The live site now references one asset the 2026-07-11 snapshot missed: `sydenstricker-rd` also loads `Saratoga.jpg`, the same file the `saratoga` page uses. Not a new photograph — the same schematic on two pages.

**10 legacy pages carry an `lh5.googleusercontent.com` avatar**: `bobs-old-keene-mill-rd`, `landmark-mall`, `mark-center`, `navy-yard`, `rosslyn`, `route-234`, `route-3-gordon-rd`, `route-610-mine-rd`, `state-department`, `the-pentagon`. These are commenters' faces. They are never migrated, and the test in `tests/spot-photos.test.mjs` refuses any image whose source is not under `slugging_locations/`.
