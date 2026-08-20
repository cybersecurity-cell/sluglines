-- Conservative Phase 1 seed data. Operational details remain explicitly review-needed
-- until a community steward or editor verifies them against a current primary source.

insert into public.sources (id, name, url, source_type, publisher, notes)
values
  ('10000000-0000-4000-8000-000000000001', 'Virginia Park and Ride Program', 'https://www.vdot.virginia.gov/travel-traffic/commuters/park-ride-lots/', 'official', 'Virginia Department of Transportation', 'Use to confirm facilities and official access information.'),
  ('10000000-0000-4000-8000-000000000002', 'Slug-lines community reference', 'https://slug-lines.com/', 'historical', 'Slug-lines.com', 'Historical community reference. Reverify operational details and rewrite all public copy before marking verified.')
on conflict (id) do update set
  name = excluded.name,
  url = excluded.url,
  source_type = excluded.source_type,
  publisher = excluded.publisher,
  notes = excluded.notes,
  is_active = true;

insert into public.destinations (
  id, slug, name, municipality, description, verification_status,
  last_verified_at, source_id, published
)
values
  ('20000000-0000-4000-8000-000000000001', 'pentagon', 'Pentagon', 'Arlington', 'A major Northern Virginia slugging destination and afternoon departure area.', 'review_needed', null, '10000000-0000-4000-8000-000000000002', true),
  ('20000000-0000-4000-8000-000000000002', 'crystal-city', 'Crystal City', 'Arlington', 'An Arlington destination served by selected I-95 and I-395 corridor lines.', 'review_needed', null, '10000000-0000-4000-8000-000000000002', true),
  ('20000000-0000-4000-8000-000000000003', 'rosslyn', 'Rosslyn', 'Arlington', 'An Arlington destination and return-trip departure area.', 'review_needed', null, '10000000-0000-4000-8000-000000000002', true),
  ('20000000-0000-4000-8000-000000000004', 'lenfant-plaza', 'L''Enfant Plaza', 'Washington', 'A central Washington destination associated with selected commuter lines.', 'review_needed', null, '10000000-0000-4000-8000-000000000002', true),
  ('20000000-0000-4000-8000-000000000005', 'downtown-dc', 'Downtown Washington', 'Washington', 'A general destination grouping; confirm the exact drop-off before travelling.', 'review_needed', null, '10000000-0000-4000-8000-000000000002', true),
  ('20000000-0000-4000-8000-000000000006', 'horner-road', 'Horner Road', 'Woodbridge', 'A broad return-trip destination; confirm the exact drop-off before boarding.', 'review_needed', null, '10000000-0000-4000-8000-000000000002', true)
on conflict (slug) do update set
  name = excluded.name,
  municipality = excluded.municipality,
  description = excluded.description,
  verification_status = excluded.verification_status,
  source_id = excluded.source_id,
  published = excluded.published;

insert into public.locations (
  id, slug, name, corridor, direction, address, municipality, parking_details,
  transit_details, operating_notes, status, verification_status,
  last_verified_at, source_id, published
)
values
  ('30000000-0000-4000-8000-000000000001', 'horner-road', 'Horner Road', 'I-95/I-395', 'inbound', 'Horner Road and Telegraph Road area', 'Woodbridge', 'Use only designated commuter parking and observe posted restrictions.', 'OmniRide service may provide an alternative; verify the current schedule directly.', 'Confirm the active queue and destination signs on arrival.', 'review_needed', 'review_needed', null, '10000000-0000-4000-8000-000000000002', true),
  ('30000000-0000-4000-8000-000000000002', 'telegraph-road', 'Telegraph Road', 'I-95/I-395', 'inbound', 'Telegraph Road commuter lot area', 'Woodbridge', 'Confirm the current commuter-lot entrance and permitted spaces.', 'Check OmniRide for current alternatives.', 'Historically used as an overflow/companion location for Horner Road; current operation needs review.', 'review_needed', 'historical', null, '10000000-0000-4000-8000-000000000002', true),
  ('30000000-0000-4000-8000-000000000003', 'staffordboro', 'Staffordboro Boulevard', 'I-95/I-395', 'inbound', '119 Staffordboro Boulevard', 'Stafford', 'A large commuter facility; follow current lot signs.', 'Check current regional and OmniRide schedules.', 'Queue positions and destinations can change; verify posted signs.', 'review_needed', 'review_needed', null, '10000000-0000-4000-8000-000000000001', true),
  ('30000000-0000-4000-8000-000000000004', 'springfield-commuter-garage', 'Springfield Commuter Garage', 'I-95/I-395', 'both', '7039 Old Keene Mill Road', 'Springfield', 'Use designated commuter spaces in the garage.', 'Local bus and rail connections are available nearby; verify current service.', 'This facility replaced older Springfield-area pickup arrangements; follow current signs.', 'review_needed', 'community_reported', null, '10000000-0000-4000-8000-000000000001', true),
  ('30000000-0000-4000-8000-000000000005', 'pentagon', 'Pentagon', 'I-95/I-395', 'outbound', 'Pentagon transit area', 'Arlington', null, 'Metrorail and regional buses provide alternatives.', 'Security and construction can move queues. Use only signed public areas and follow official instructions.', 'review_needed', 'review_needed', null, '10000000-0000-4000-8000-000000000002', true),
  ('30000000-0000-4000-8000-000000000006', 'crystal-city', 'Crystal City', 'I-95/I-395', 'outbound', 'Crystal City transit area', 'Arlington', null, 'Metrorail and local buses provide alternatives.', 'Confirm the current street-side queue before relying on this location.', 'review_needed', 'historical', null, '10000000-0000-4000-8000-000000000002', true),
  ('30000000-0000-4000-8000-000000000007', 'rosslyn', 'Rosslyn', 'I-66', 'outbound', 'Rosslyn transit area', 'Arlington', null, 'Metrorail and regional bus services provide alternatives.', 'Construction has moved this line in the past; verify current signs.', 'review_needed', 'historical', null, '10000000-0000-4000-8000-000000000002', true),
  ('30000000-0000-4000-8000-000000000008', 'route-234', 'Route 234', 'I-95/I-395', 'inbound', 'Route 234 commuter lot area', 'Dumfries', 'Use designated commuter parking and verify current capacity signs.', 'Check OmniRide for current alternatives.', 'Confirm active destinations with posted signs or a current community report.', 'review_needed', 'historical', null, '10000000-0000-4000-8000-000000000001', true)
on conflict (slug) do update set
  name = excluded.name,
  corridor = excluded.corridor,
  direction = excluded.direction,
  address = excluded.address,
  municipality = excluded.municipality,
  parking_details = excluded.parking_details,
  transit_details = excluded.transit_details,
  operating_notes = excluded.operating_notes,
  status = excluded.status,
  verification_status = excluded.verification_status,
  source_id = excluded.source_id,
  published = excluded.published;

delete from public.location_routes
where (location_id, destination_id, direction) in (
  ('30000000-0000-4000-8000-000000000005'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, 'outbound'),
  ('30000000-0000-4000-8000-000000000007'::uuid, '20000000-0000-4000-8000-000000000003'::uuid, 'outbound')
);

insert into public.location_routes (
  location_id, destination_id, direction, schedule_notes, verification_status,
  last_verified_at, source_id, active
)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'inbound', 'Weekday morning activity is historically reported; confirm before travelling.', 'historical', null, '10000000-0000-4000-8000-000000000002', true),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'inbound', 'Confirm the specific queue before travelling.', 'historical', null, '10000000-0000-4000-8000-000000000002', true),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'inbound', 'Historically active on weekday mornings; current timing needs review.', 'historical', null, '10000000-0000-4000-8000-000000000002', true),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'inbound', 'Confirm current operation and exact pickup point.', 'community_reported', null, '10000000-0000-4000-8000-000000000002', true),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', 'outbound', 'Multiple outbound queues may operate; follow current signage.', 'review_needed', null, '10000000-0000-4000-8000-000000000002', true)
on conflict (location_id, destination_id, direction) do update set
  schedule_notes = excluded.schedule_notes,
  verification_status = excluded.verification_status,
  source_id = excluded.source_id,
  active = excluded.active;
