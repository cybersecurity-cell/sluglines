-- =============================================================================
-- 0013_location_transit_external.sql
--
-- APPLIED: production
-- TARGET:  Supabase project sluglines (project ref bwpguotjzczmieeepczf), applied 2026-09-03 (full batch 0011-0025, D-77). Preview applied 2026-09-02 (D-75).
--
-- GENERATED FILE -- DO NOT EDIT BY HAND.
--   Source:    src/lib/domain/locations.ts
--   Generator: scripts/seed-locations.mjs   (`npm run seed:locations`)
--   Guard:     tests/spot-locations-directory.test.mjs re-runs the generator and
--              compares the result with this file byte-for-byte.
--
-- Two legacy sections D-59 found and could not carry, for lack of a column:
-- "Public Transportation" (40 of the 42 legacy spot pages) and "External
-- links" (35). Docs/DECISIONS.md D-59 named this owed content; this migration
-- pays it. Issue #77.
--
-- COLUMN SHAPES, AND WHY
-- -----------------------------------------------------------------------------
-- public_transportation text[] -- one entry per bus route, rail line or
-- shuttle, as free text. The legacy pages describe these in prose or short
-- list items and never cleanly separate a route from its operator (some name
-- a route number with no operator, some an operator with no route number), so
-- a {route, operator} column pair would mean guessing a structure the source
-- does not have. This is the same shape lines_from/lines_to already use for
-- the same reason.
--
-- external_links jsonb -- an array of {label, url} objects: the legacy page's
-- own "External links" section, which is link text plus a destination and
-- nothing else structured. jsonb rather than a second pair of arrays because
-- label and url are not independently meaningful -- an external_link_labels[]
-- and a parallel external_link_urls[] would rely on index alignment to mean
-- anything, which is a foot-gun jsonb does not have. Every url is an absolute
-- http(s) URL (lib/domain/locations.ts's isSafeExternalLinkUrl); these render
-- as outbound links on a spot page, so a javascript:, data:, or relative-path
-- entry is refused at the application boundary rather than trusted through.
--
-- WHAT THIS MIGRATION DOES NOT DO
-- -----------------------------------------------------------------------------
-- It does not extend get_public_location (0010) to return either column to
-- anonymous visitors. That is a second, separately-reviewed act -- see the
-- generator's own comment on this function. Until it ships, these two fields
-- render only where the committed directory answers (an inactive spot, or any
-- environment without 0010 applied), not for an active spot's database-backed
-- page in production.
--
-- SECURITY POSTURE
-- -----------------------------------------------------------------------------
-- No table, policy or function is created here. locations already has RLS on,
-- is revoked from anon, and grants SELECT to authenticated only (0004); a
-- column added to an already-governed table inherits that posture without a
-- further grant. sql-lint's R3-R11 have nothing to say about this file, the
-- same reason 0009 states for itself.
-- =============================================================================

alter table public.locations
  add column if not exists public_transportation text[],
  add column if not exists external_links jsonb;

comment on column public.locations.public_transportation is
  'Bus routes, rail lines and shuttles serving the spot, as free text -- see lib/domain/locations.ts. '
  'Null where the legacy page published no such section. Issue #77, Docs/DECISIONS.md D-59.';

comment on column public.locations.external_links is
  'Array of {label, url} objects from the legacy page''s own "External links" section. Every url is '
  'an absolute http(s) URL; see isSafeExternalLinkUrl. Issue #77, Docs/DECISIONS.md D-59.';

update public.locations as l set
  public_transportation = seed.public_transportation,
  external_links = seed.external_links
from (
  values
      ('bobs-old-keene-mill-rd', array['Fairfax Connector Route 306', 'Fairfax Connector Route 18G']::text[], '[{"label":"SpringField Slug Lines Facebook Group","url":"https://www.facebook.com/groups/springfieldsluglines/"},{"label":"Springfield Town Center Facebook Group","url":"https://www.facebook.com/groups/stcsluglines"},{"label":"Facebook Page","url":"https://www.facebook.com/pages/Bobs-Slug-line/141795922523615"},{"label":"Foursquare","url":"https://foursquare.com/v/slug-line-bobs-to-dc/5236da68498eb85f2687e0de"},{"label":"Old Keene Mill","url":"http://www.fairfaxcounty.gov/connector/parkandrides/oldkeenemill.htm"},{"label":"Ribbon-cutting Ceremony Marks Completion of Old Keene Mill Park and Ride Dec 3, 2010","url":"http://www.fairfaxcounty.gov/connector/news/2010/10_026.htm"},{"label":"Bob’s Slug Line Temporarily Moved, But Still Operational Nov 8, 2010","url":"http://www.fairfaxcounty.gov/connector/news/2010/10_024.htm"},{"label":"Fairfax County to Demolish Former Circuit City Building to Prepare for Future Park and Ride Lot, Jun 28, 2010","url":"http://www.fairfaxcounty.gov/connector/news/2010/10_014.htm"},{"label":"I-95/I-395 HOV Restriction Study, 1998","url":"http://www.virginiadot.org/projects/studynova-hov395over.asp"}]'::jsonb),
      ('cardinal-forest-plaza', array['Metrobus 18P', 'Fairfax Connector']::text[], null::jsonb),
      ('franconia-springfield', array['OmniRide', 'Washington Metro', 'Metro Bus', 'Free Shuttle Service', 'VRE', 'Greyhound']::text[], '[{"label":"Parking facility","url":"https://www.wmata.com/service/parking/parking-details.cfm?stationid=95"},{"label":"Fairfax Connector","url":"https://www.fairfaxcounty.gov/connector/riders/franconia-springfield"}]'::jsonb),
      ('lorton', array['Lorton VRE commuter rail', 'Fairfax Connector Routes 171 & 307']::text[], '[{"label":"Lorton Station","url":"http://www.vtrans.org/resources/reports/Lorton_Summary_FINAL_042513.pdf"},{"label":"Lorton Location","url":"http://www.fairfaxcounty.gov/connector/parkandrides/lortonvre.htm"},{"label":"Lorton Lot","url":"http://www.fairfaxcounty.gov/connector/pdf/parkandrides/lortonvre.pdf"},{"label":"Lorton Parking Information","url":"http://www.vre.org/service/stations/lorton/lorton-parking-information/"}]'::jsonb),
      ('rolling-valley', array['Fairfax Connector Route 310 to the Pentagon', 'WMATA Metro Bus to the Springfield / Franconia Metro Station']::text[], '[{"label":"RollingValley Info","url":"http://www.fairfaxcounty.gov/connector/parkandrides/rollingvalley.htm"},{"label":"RollingValley Parking","url":"http://www.fairfaxcounty.gov/connector/pdf/parkandrides/rollingvalley.pdf"}]'::jsonb),
      ('saratoga', array['Fairfax Connector routes 333, 393, 394 and 494']::text[], null::jsonb),
      ('sydenstricker-rd', array['Bus service by Fairfax connector']::text[], '[{"label":"Parking Location","url":"http://www.fairfaxcounty.gov/connector/parkandrides/sydenstricker.htm"},{"label":"Lot Map","url":"http://www.fairfaxcounty.gov/connector/pdf/parkandrides/sydenstricker.pdf"},{"label":"Facebook Post","url":"https://www.facebook.com/pages/Sydenstricker-Park-and-Ride/158475297565572"}]'::jsonb),
      ('springfield-town-center', null::text[], '[{"label":"Springfield Town Center Slug Lines Facebook Group","url":"https://www.facebook.com/groups/STCSluglines/"},{"label":"Springfield Garage Construction – Public Information Meeting","url":"https://www.facebook.com/events/989694638084133/"},{"label":"Fairfax County Department of Transportation (FCDOT)","url":"https://www.fairfaxcounty.gov/transportation/projects/springfield-garage"}]'::jsonb),
      ('van-dorn-st', array['OmniRide', 'Washington Metro', 'Metro Bus', 'Free Shuttle Service']::text[], '[{"label":"Parking facility","url":"https://www.wmata.com/service/parking/parking-details.cfm?stationid=94"}]'::jsonb),
      ('landmark-mall', array['Washington Metro', 'Free Shuttle Service']::text[], null::jsonb),
      ('route-3-gordon-rd', array['Martz Virginia', 'VRE Station']::text[], '[{"label":"Gordon road Commuter lot changes","url":"http://www.fredericksburg.com/news/transportation/gordon-road-commuters-face-parking-lot-changes/article_9c2fb6f3-0122-5cd6-b45b-38fff887aed0.html"},{"label":"Gordon Rd Parking expansion","url":"http://fredericksburg.today/commuter-parking-expanded-in-spotsylvanias-route-3-corridor"}]'::jsonb),
      ('route-17', array['Bus service- National coach, Lee and Quick bus lines']::text[], '[{"label":"Route 17 Widening","url":"http://www.virginiadot.org/projects/fredericksburg/route_17_widening,_stafford_county.asp"},{"label":"95 Express Lanes open","url":"http://potomaclocal.com/2015/04/30/95-express-lanes-open-stafford-county-has-a-new-traffic-headache/"},{"label":"Fredricksburg Commuting","url":"http://themoyersteam.com/fredericksburg-commuting-and-transportation/"}]'::jsonb),
      ('route-208', array['Bus-National coach, Lee and quick’s bus lines service this area.', 'Private Transpo provider by Martz Trailways ( http://www.martzgroupva.com )']::text[], '[{"label":"Park and Ride Commuter Lots","url":"https://www.gwrideconnect.org/commuter-lots/"}]'::jsonb),
      ('dale-city', array['PRTC OmniRide']::text[], null::jsonb),
      ('horner-rd', array['OmniRide – Commuter Bus', 'OmniLink – Local', 'Slugline from Horner Road to Mark Center']::text[], '[{"label":"Park And Ride Lots","url":"http://76.227.210.32/commuters/transit/park-ride-locations"},{"label":"New Slug Lines, Shuttle Bus Start Monday April 30, 2011","url":"http://potomaclocal.com/2011/04/30/new-slug-lines-shuttle-bus-start-monday"},{"label":"Horner Road Parking Lot – Church Shuttle Announced April 14, 2011","url":"http://potomaclocal.com/2011/04/14/horner-%E2%80%93-church-shuttle-announced/"},{"label":"Push for security cameras at theft-ridden Woodbridge commuter lot Apr 8th, 2016","url":"http://wjla.com/news/crime/woodbridge-car-thieves"},{"label":"Workers return to commuter lot in Woodbridge to find all four ties missing from car Mar 31, 2016","url":"http://wjla.com/news/crime/workers-return-to-commuter-lotin-woodbridge-to-find-all-four-ties-missing-from-car"},{"label":"Tire thieves targeting Horner Road lot in Woodbridge Jan 18, 2016","url":"http://wtop.com/prince-william-county/2016/01/tire-thieves-targeting-horner-road-lot-inwoodbridge/"},{"label":"Wheel thefts reported at park-and-ride lot in Prince William County Oct 20, 2015","url":"https://www.washingtonpost.com/local/public-safety/wheel-thefts-reported-atpark-and-ride-lot-in-prince-william-county/2015/10/20/17c4dd00-772e-11e5-b9c1-f03c48c96ac2_story.html"},{"label":"Commuters Find Cars Stripped of Tires at Va. Park-and-Ride Lot Sept. 11, 2015","url":"http://www.nbcwashington.com/news/local/Commuters-Find-Cars-Stripped-ofTires-at-Va-Park-and-Ride-Lot-326853841.html"},{"label":"Police: Woman assaulted after pick up in Prince William Co. commuter lot Nov 12, 2014","url":"http://www.wusa9.com/story/news/local/prince-williamcounty/2014/11/12/woodbridge-prince-william-county-commuter-lot-sex-assault/18907669/"},{"label":"Ticketed at Horner Road Lot, Slug Vows to Fight the Law Feb 13, 2013","url":"http://potomaclocal.com/2013/02/13/ticketed-at-horner-road-lot-slug-vows-to-fight-thelaw/"},{"label":"On Blocks: Missing Wheels at Commuter Lots Mar 15, 2012","url":"http://potomaclocal.com/2012/03/15/on-blocks-missing-wheels-at-woodbridge-commuter-lots/"}]'::jsonb),
      ('montclair-fire-station', array['Bus service by OmniRide']::text[], '[{"label":"Options for Montclair Commuters","url":"http://potomaclocal.com/2014/09/02/options-coming-montclair-commuters/"}]'::jsonb),
      ('montclair-northgate', array['Bus service by OmniRide']::text[], '[{"label":"Options for Montclair Commuters","url":"http://potomaclocal.com/2014/09/02/options-coming-montclair-commuters/"}]'::jsonb),
      ('old-hechingers', array['Bus service by Omniride']::text[], '[{"label":"Expansion of Prince William County Commuter Lots","url":"https://www.washingtonpost.com/archive/local/1999/07/14/fast-expansion-of-commuter-*lotssought/1753af93-d9c3-4b99-ae59-585c16cc41ca/"}]'::jsonb),
      ('potomac-mills', array['Bus service: OmniRide']::text[], '[{"label":"Parking Expansion","url":"http://potomaclocal.com/2011/01/13/potomac-mills-to-reduce-commuter-parking/"},{"label":"Potomac Mills slashes commuter parking January 16, 2011","url":"http://www.washingtonpost.com/wp-dyn/content/article/2011/01/14/AR2011011407206.html"}]'::jsonb),
      ('route-123', array['PRTC OmniRide']::text[], '[{"label":"Commuter Lots","url":"http://www.prtctransit.org/ridesharing/commuterlots.html"},{"label":"Offsetting slugging shortcomings","url":"http://potomaclocal.com/columns-blogs/slug-tales/"}]'::jsonb),
      ('route-234', array['OmniRide']::text[], '[{"label":"Route 234 Commuter Lot","url":"http://www.prtctransit.org/ridesharing/commuterlots.html"},{"label":"Slug Parking Along Route 234","url":"http://potomaclocal.com/2012/05/23/slug-tales-parking-habit-leads-to-fine/"}]'::jsonb),
      ('tacketts-mill', array['OmniRide']::text[], '[{"label":"Tackett’s Mill","url":"http://potomaclocal.com/2011/10/07/slugging-options-announced-for-mark-center/"}]'::jsonb),
      ('telegraph-rd', array['OmniRide – Commuter Bus']::text[], '[{"label":"Park and Ride","url":"http://www.prtctransit.org/ridesharing/commuterlots.html"},{"label":"New commuter lot to ease transportation Aug 13, 2014","url":"http://patch.com/virginia/woodbridge-va/commuter-lot-ready-traffic-telegraph-road"}]'::jsonb),
      ('route-610-mine-rd', null::text[], '[{"label":"Route 610 Intersection Improvement","url":"http://www.virginiadot.org/projects/fredericksburg/route_610_garrisonville_road_and_route_641_onville_road_intersection_improvement.asp"}]'::jsonb),
      ('route-610-staffordboro-blvd', array['Martz Commuter Bus', 'Virginia Railway Express']::text[], '[{"label":"Commuter Parking Expansion","url":"http://www.virginiadot.org/newsroom/fredericksburg/2013/commuter_parking_expansion_begins65855.asp"},{"label":"VDoT Staffordboro Boulevard Park & Ride","url":"http://www.virginiadot.org/projects/resources/Fredericksburg/Staffordboro_Boulevard_Park_Ride_ Temporary_Traffic_Pattern_Map.pdf"},{"label":"Garrisonville park & ride lot","url":"http://www.fredericksburg.com/news/transportation/slug-line-backups-clogging-up-morning-commute-atpopular-garrisonville/article_1c5f3c5d-582e-51cc-a4f6-eae48be350e7.html"},{"label":"Stafford Posting New Slug Line Signs","url":"http://www.gostaffordva.com/2017/11/03/stafford-posting-new-slug-line-signs/"}]'::jsonb),
      ('route-630', array['National coach', 'Lee', 'Quick bus lines']::text[], '[{"label":"Interstate 95/Route 630 (Courthouse Road) Interchange Relocation Nov. 18, 2015","url":"http://www.virginiadot.org/projects/fredericksburg/interstate_95-route_630_courthouse_road_interchange_relocation.asp"},{"label":"Reduced Lot Space","url":"http://potomaclocal.com/2012/04/04/parking-spaces-reduced-at-stafford-lot/"}]'::jsonb),
      ('mark-center', array['Metro bus: 7M', 'OmniRide', 'Slugline from Horner Road to Mark Center']::text[], '[{"label":"New Commuter Bus Service from Woodbridge to Mark Center","url":"http://blog.sluglines.com/2015/11/new-commuter-bus-serviceform.html#sthash.5mJB4XfI.dpuf"},{"label":"Commuting to the Mark Center Just Got A Whole Lot Easier Jan 27, 2016","url":"http://activepw.org/commuting-to-the-mark-center-just-got-a-whole-lot-easier/"},{"label":"Mark Center Commuter Bus Service, Jan 07, 2016","url":"http://www.prtctransit.org/myprtc/service-updates/service_updates.php?docid=353"},{"label":"I-395 HOV Ramp and Auxiliary Lane","url":"http://www.virginiadot.org/projects/northernvirginia/i-395_hov-transit_ramp.asp"},{"label":"PRTC Mark Center Commuter Bus Service","url":"http://www.prtctransit.org/commuter-bus/mark-center.html"},{"label":"Help Offered for Mark Center Slugs","url":"http://potomaclocal.com/2012/03/19/help-offered-for-mark-center-slugs/"},{"label":"Traffic relief comes for Mark Center commuters","url":"http://wtop.com/news/2013/07/traffic-relief-comes-for-mark-center-commuters/"}]'::jsonb),
      ('tysons-corner', array['OmniRide', 'Fairfax Connector – 494 Express – Lorton – Springfield –Tysons ( Bus Tracker )']::text[], null::jsonb),
      ('crystal-city-12th-st', array['OmniRide', 'Metro Way (Blue and Yellow Lines) replacing Metrobus', 'WMATA']::text[], '[{"label":"Capital Share","url":"http://crystalcitycivic.org/"},{"label":"Buslanes in crystal city potomac Yard Area February 21, 2014","url":"https://www.washingtonpost.com/local/regions-first-dedicated-bus-lanes-planned-in-crystal-citypotomac-yard-area/2014/02/21/10172118-9b15-11e3-ad71-e03637a299c0_story.html"},{"label":"New bus only Lanes","url":"http://newsroom.arlingtonva.us/release/rules-set-for-new-bus-only-lanes-in-crystal-city-potomac-yard/"}]'::jsonb),
      ('crystal-city-23rd-st', array['OmniRide', 'Metro Way (Blue and Yellow Lines) replacing Metrobus', 'WMATA']::text[], '[{"label":"Buslanes in crystal city potomac Yard Area February 21, 2014","url":"https://www.washingtonpost.com/local/regions-first-dedicated-bus-lanes-planned-in-crystal-citypotomac-yard-area/2014/02/21/10172118-9b15-11e3-ad71-e03637a299c0_story.html"},{"label":"New bus only Lanes","url":"http://newsroom.arlingtonva.us/release/rules-set-for-new-bus-only-lanes-in-crystal-city-potomac-yard/"}]'::jsonb),
      ('rosslyn', array['GW Shuttle', 'State Department Shuttle', 'Pentagon Shuttle', 'Metrobus']::text[], '[{"label":"Rosslyn Slug Yahoo Group","url":"https://groups.yahoo.com/neo/groups/RosslynSlugs/info"},{"label":"Rosslyn Slug lines FaceBook Group","url":"https://www.facebook.com/groups/RosslynSlugLines/"},{"label":"Getting Around Rosslyn","url":"http://www.carfreediet.com/pages/arlingtons-urban-villages/rosslyn/getting-around/"},{"label":"https://police.arlingtonva.us/traffic-enforcement-request/","url":"https://police.arlingtonva.us/traffic-enforcement-request/?fbclid=IwAR1NDEIkamrPIVfWxGdIEgw2j5Zs5DCRIJi2BBMnVbWjWzktWwXEtNiw8VI"}]'::jsonb),
      ('the-pentagon', array['OmniRide', 'Fairfax Connector', 'Metrobus', 'Metro Rail', 'Alexandria’s DASH Bus']::text[], '[{"label":"PENTAGON ATTACKING ‘SLUG LINES’ RIDERS SAY Jan 22, 1999","url":"https://www.washingtonpost.com/archive/local/1999/01/22/pentagon-attacking-slug-lines-riders-say/14ed0c17-f142-41f3-868b-53a78a6f9648/"},{"label":"Getting to the Pentagon","url":"http://www.whs.mil/our-services/transportation/getting-pentagon"},{"label":"To commute to capital, Early birds gets slugs","url":"http://www.nytimes.com/2003/04/29/us/to-commute-to-capital-early-bird-gets-slugs.html?pagewanted=all"}]'::jsonb),
      ('14th-st-and-constitution-ave', array['PRTC buses at 14th & Constitution Avenue', 'Metro rail at Smithsonian station']::text[], '[{"label":"Twitter","url":"https://twitter.com/311DCgov"},{"label":"DC’s Police Chief: City Should Re-Evaluate Slug Lines, June 18, 2010","url":"http://wamu.org/news/10/06/18/dcs_police_chief_city_should_re_evaluate_slug_lines"},{"label":"Va. Rep. to DC: Leave slugs alone, July 29, 2010","url":"http://voices.washingtonpost.com/dr-gridlock/2010/07/va_rep_to_dc_leave_slugs_alone.html"}]'::jsonb),
      ('14th-st-and-g-st', array['Metrobus']::text[], null::jsonb),
      ('14th-st-and-independence', array['OmniRide', 'Smithsonian Metro Station (Blue and orange Lines)']::text[], '[{"label":"New Slug pickup sites of DC area","url":"http://www.washingtonpost.com/wp-dyn/content/article/2010/08/26/AR2010082606229.html"}]'::jsonb),
      ('14th-st-at-commerce-dept', array['OmniRide', 'Metrobus', 'Federal Triangle (Blue and Orange Lines) on the west of 12th street']::text[], '[{"label":"Survey on Sluglines","url":"http://wamu.org/news/10/08/27/survey_to_be_done_on_slug_lines"}]'::jsonb),
      ('15th-st-and-new-york-ave', array['Metro at Mcpherson Square Station', 'Bus service by Omniride and MetroBus']::text[], '[{"label":"Slugline Changes","url":"http://potomaclocal.com/2011/01/10/slug-line-changes-on-hold/"},{"label":"Slug sharing for newyork Avenue","url":"http://www.washingtonpost.com/wp-dyn/content/article/2011/02/26/AR2011022603190.html"}]'::jsonb),
      ('19th-st-and-f-st', array['Metro Rail- Farragut West', 'Foggy Bottom Station']::text[], '[{"label":"New Sites For Sluglines July 23, 1998","url":"http://www.washingtonpost.com/wp-srv/local/daily/july98/commuters23.htm"}]'::jsonb),
      ('19th-st-and-i-st', array['Ominiride in the corner of 18th and F street', 'Metro Rail- Foggy bottom Station at the corner of 23rd and I streets.', 'Farragut West(Blue and Orange Lines)']::text[], '[{"label":"New Sites For Sluglines July 23, 1998","url":"http://www.washingtonpost.com/wp-srv/local/daily/july98/commuters23.htm"}]'::jsonb),
      ('lenfant-plaza', array['Metro rail( Blue, Orange, Yellow and Green lines)', 'Omniride']::text[], null::jsonb),
      ('navy-yard', array['Shuttle – Commuters with DoD CAC can take shuttle from Navy Yard to L’Enfant Sluglines', 'Omniride', 'WMATA – Navy Yard (Green line) and Eastern Market (Blue and Orange lines) Metro Stations', 'DC Circulator schedules .']::text[], '[{"label":"Changes to Slug Pickup Location at the Navy Yard","url":"https://sluglines.com/a/wp-content/uploads/2016/08/Navy-Yard1.pdf"},{"label":"Electronic Washington Navy Yard Electronic SlugLine email group","url":"https://groups.yahoo.com/neo/groups/eslug/info"},{"label":"Directions","url":"http://www.ssp.navy.mil/onboarding/about_area.html"},{"label":"Navy Yard Establishes Slug Lines for Commuters Mar 5, 2015","url":"http://www.dcmilitary.com/waterline/news/local/navy-yard-establishes-slug-lines-for-commuters/article_cdd444ca-06b0-5f11-9c6c-6d5469ae3062.html"}]'::jsonb),
      ('state-department', array['OmniRide']::text[], '[{"label":"https://www.facebook.com/groups/dcsluglines/","url":"https://www.facebook.com/groups/dcsluglines/"},{"label":"https://www.facebook.com/groups/woodbridgesluglines/","url":"https://www.facebook.com/groups/woodbridgesluglines/"}]'::jsonb),
      ('vienna-metro-south-knr', null::text[], null::jsonb),
      ('fairfax-govt', null::text[], null::jsonb),
      ('stringfellow-pnr', null::text[], null::jsonb),
      ('herndon-monroe-pnr', null::text[], null::jsonb),
      ('cushing-road', null::text[], null::jsonb),
      ('east-gate', null::text[], null::jsonb),
      ('stone-ridge', null::text[], null::jsonb),
      ('foggy-bottom', null::text[], null::jsonb)
) as seed(slug, public_transportation, external_links)
where l.slug = seed.slug;
