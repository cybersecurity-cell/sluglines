import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(
  root,
  'supabase',
  'migrations',
  '202606210001_phase1_foundation.sql',
)
const referenceDataPath = path.join(
  root,
  'supabase',
  'migrations',
  '202606210002_phase1_reference_data.sql',
)

const sql = (await readFile(migrationPath, 'utf8')).toLowerCase()
const referenceDataSql = (await readFile(referenceDataPath, 'utf8')).toLowerCase()
const migrationDirectory = path.join(root, 'supabase', 'migrations')
const migrationSql = (
  await Promise.all(
    (await readdir(migrationDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .map((file) => readFile(path.join(migrationDirectory, file), 'utf8')),
  )
).join('\n').toLowerCase()

const publicTables = ['locations', 'destinations', 'location_routes', 'sources', 'advisories']
const privateTables = ['profiles', 'saved_locations', 'commute_preferences', 'correction_reports']

for (const table of [...publicTables, ...privateTables]) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
}

for (const table of publicTables) {
  assert.match(sql, new RegExp(`create policy "public read ${table}"`))
}

for (const table of privateTables) {
  assert.match(sql, new RegExp(`create policy "owners read ${table}"`))
}

assert.match(sql, /create or replace function public\.is_staff\(\)/)
assert.match(sql, /create or replace function public\.handle_new_user\(\)/)
assert.match(sql, /drop constraint if exists profiles_role_check/)
assert.match(sql, /create or replace function public\.prevent_profile_role_change\(\)/)
assert.match(sql, /create trigger prevent_profile_role_change/)
assert.match(sql, /revoke all on function public\.handle_new_user\(\) from public/)
assert.match(sql, /grant update \(display_name, home_location_id, preferred_destination_id\) on public\.profiles/)
assert.doesNotMatch(sql, /grant select, update on public\.profiles/)
assert.match(sql, /revoke all on public\.sources, public\.locations/)
assert.match(sql, /drop policy if exists "anyone can update spot counts"/)
assert.match(sql, /revoke all on function public\.reset_daily_counts\(\) from public/)
assert.match(sql, /exists \(\s*select 1\s*from public\.locations/i)
assert.match(sql, /on auth\.users/)
assert.doesNotMatch(sql, /create policy "anyone can update/i)
assert.doesNotMatch(sql, /role = \(select p\.role from public\.profiles/i)

for (const table of ['sources', 'destinations', 'locations', 'location_routes']) {
  assert.match(referenceDataSql, new RegExp(`insert into public\\.${table}`))
}

assert.match(referenceDataSql, /on conflict \(id\) do update/)
assert.match(referenceDataSql, /on conflict \(slug\) do update/)
assert.match(referenceDataSql, /on conflict \(location_id, destination_id, direction\) do update/)
assert.match(referenceDataSql, /verification_status/)
assert.match(referenceDataSql, /source_id/)
assert.doesNotMatch(referenceDataSql, /verification_status[^;]*'verified'/s)
assert.match(migrationSql, /create or replace function public\.enforce_correction_report_rate_limit\(\)/)
assert.match(migrationSql, /create trigger enforce_correction_report_rate_limit/)
assert.match(migrationSql, /before insert on public\.correction_reports/)
assert.match(migrationSql, /new\.user_id/)
assert.match(migrationSql, /interval '1 hour'/)

console.log('SQL policy and production reference-data audit passed for Phase 1.')
