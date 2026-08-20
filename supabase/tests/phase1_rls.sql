begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email)
values
  ('40000000-0000-4000-8000-000000000001', 'owner@example.test'),
  ('40000000-0000-4000-8000-000000000002', 'other@example.test'),
  ('40000000-0000-4000-8000-000000000003', 'editor@example.test');

update public.profiles set role = 'editor'
where id = '40000000-0000-4000-8000-000000000003';

set local role anon;
select ok((select count(*) from public.locations) > 0, 'anonymous visitors can read published locations');
select is((select count(*) from public.profiles), 0::bigint, 'anonymous visitors cannot read profiles');
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select count(*) from public.profiles), 1::bigint, 'commuters only see their own profile');
select is((select email from public.profiles limit 1), 'owner@example.test', 'the visible profile belongs to the authenticated commuter');

insert into public.saved_locations (user_id, location_id)
values ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
select is((select count(*) from public.saved_locations), 1::bigint, 'commuters can save a location for themselves');

select throws_ok(
  $$insert into public.saved_locations (user_id, location_id)
    values ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'commuters cannot save a location for another user'
);

insert into public.correction_reports (
  user_id, category, summary, details
)
select
  '40000000-0000-4000-8000-000000000001',
  'other',
  'Rate-limit test report ' || series,
  'Enough detail to exercise the authoritative database submission limit.'
from generate_series(1, 5) as series;

select throws_ok(
  $$insert into public.correction_reports (user_id, category, summary, details)
    values (
      '40000000-0000-4000-8000-000000000001',
      'other',
      'Sixth recent report',
      'This direct insert must be rejected even when the application is bypassed.'
    )$$,
  'P0001',
  'Correction report rate limit exceeded',
  'the database rejects a sixth correction report within one hour'
);

select throws_ok(
  $$insert into public.correction_reports (
      user_id, category, summary, details, created_at
    ) values (
      '40000000-0000-4000-8000-000000000001',
      'other',
      'Backdated report attempt',
      'A direct client cannot evade the quota by choosing an older timestamp.',
      now() - interval '2 hours'
    )$$,
  '42501',
  null,
  'commuters cannot set server-owned correction report timestamps'
);

select throws_ok(
  $$update public.profiles set role = 'admin'
    where id = '40000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Users cannot change their own role',
  'commuters cannot promote their own role'
);

update public.locations set name = 'Unauthorized change'
where id = '30000000-0000-4000-8000-000000000001';
select is(
  (select name from public.locations where id = '30000000-0000-4000-8000-000000000001'),
  'Horner Road',
  'commuters cannot edit published location content'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
update public.locations set name = 'Horner Road reviewed'
where id = '30000000-0000-4000-8000-000000000001';
select is(
  (select name from public.locations where id = '30000000-0000-4000-8000-000000000001'),
  'Horner Road reviewed',
  'editors can update published location content'
);

select * from finish();
rollback;
