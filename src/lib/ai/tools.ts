/**
 * The tool catalog (Docs/DECISIONS.md D-65, Option A). Ships R0 (read) and R1
 * (advisory) only; the R2/R3 entries are declared with `implemented: false` so
 * the gate denies them by *tier* with a real reason, rather than falling
 * through to "unknown tool" — a denial that would be indistinguishable from a
 * typo in the model's output.
 *
 * No schema below contains a member id, location id, or role. The agent has no
 * vocabulary for saying who it is acting as: identity comes only from the
 * session envelope `tool-gate.ts` holds. This is the structural half of the
 * prompt-injection defence — injected text cannot request a privilege it has no
 * way to name.
 *
 * ADAPTED FROM Sluglines-AI's tools.ts, not copied (Docs/DECISIONS.md D-65):
 * Sluglines-AI's seven implemented tools query objects that mostly do not exist
 * in this repo — `offers_board` (a view), `get_presence_counts()`, `incidents`,
 * `lostfound_items`, `stops`. Rather than invent that schema here (which the
 * D-65 task scope explicitly ruled out), each tool below is either:
 *
 *   (a) re-pointed at what sluglines actually has — `presence.get_counts` at
 *       the real `get_public_spot_counts`/`get_public_open_offer_counts`
 *       aggregate functions (via `lib/domain/public-counts.ts`, the same code
 *       the public site already uses), and `ride.*` at the real `offers` +
 *       `locations` tables through the caller's own RLS-scoped session — no
 *       new view, because a two-query join in TypeScript is smaller and no
 *       less safe than a migration that adds one; or
 *   (b) marked `implemented: false` with a TODO naming what is missing, when
 *       the backing table genuinely does not exist (`lostfound_items`,
 *       `stops`). `CALLABLE_TOOLS` below excludes these, and `0011`'s
 *       kill-switch seed does not carry a row for them — see that migration's
 *       header for why seeding an unreachable switch would be a row nothing
 *       reads.
 *
 * `incidents.get_active` is no longer in that deferred set: Option B slice 1
 * (issue #90, Docs/DECISIONS.md D-68) ships `incidents`/`incident_confirmations`
 * (0014/0015) and points this tool at the `incidents_board` view, the same
 * "real table, caller's own RLS session" pattern as `ride.*` — no new view was
 * needed on the TypeScript side because 0014 already ships one for the same
 * reason `offers_board` was judged unnecessary there.
 */

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
// Relative, not `@/lib/domain/...`: this file must import under plain
// `node --experimental-strip-types` the same way lib/domain's own modules do
// (tests/ai-agent-runtime.test.mjs, tests/public-counts.test.mjs), and the `@/`
// alias only resolves through the Next.js/tsconfig bundler, not bare Node.
import { countsForSlug, fetchPublicSpotCounts } from '../domain/public-counts.ts'
import type { RiskTier } from './tool-gate.ts'

export interface ToolContext {
  supabase: SupabaseClient
  memberId: string
  locationId: string
}

export interface ToolDefinition {
  name: string
  riskTier: RiskTier
  description: string
  schema: z.ZodType<Record<string, never> | Record<string, unknown>>
  implemented: boolean
  run?: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

const noArgs = z.object({}).strict()

interface LocationSummary {
  id: string
  slug: string
  name: string
}

interface OfferRow {
  id: string
  poster_role: string
  origin_location_id: string
  destination_location_id: string
  window_start: string
  window_end: string
  seats_total: number
  seats_taken: number
  state: string
}

const OFFER_COLUMNS =
  'id, poster_role, origin_location_id, destination_location_id, window_start, window_end, seats_total, seats_taken, state'

/**
 * Offers carry only location *ids* (`origin_location_id`/`destination_location_id`);
 * there is no `offers_board` view joining in names. This is the small join that
 * stands in for one — see the file header for why a view was not added instead.
 */
async function attachLocationNames<T extends { origin_location_id: string; destination_location_id: string }>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<(T & { origin: LocationSummary | null; destination: LocationSummary | null })[]> {
  const ids = Array.from(new Set(rows.flatMap((row) => [row.origin_location_id, row.destination_location_id])))
  if (ids.length === 0) return rows.map((row) => ({ ...row, origin: null, destination: null }))

  const { data, error } = await supabase.from('locations').select('id, slug, name').in('id', ids)
  if (error) throw error

  const byId = new Map((((data ?? []) as LocationSummary[])).map((location) => [location.id, location]))
  return rows.map((row) => ({
    ...row,
    origin: byId.get(row.origin_location_id) ?? null,
    destination: byId.get(row.destination_location_id) ?? null,
  }))
}

async function fetchOfferForCaller(supabase: SupabaseClient, offerId: string) {
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_COLUMNS)
    .eq('id', offerId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const [withNames] = await attachLocationNames(supabase, [data as unknown as OfferRow])
  return withNames
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'presence.get_counts',
    riskTier: 'R0',
    description:
      "Get how many people are currently checked in and waiting at the member's home commuter lot, plus how many open driver/rider offers are posted there. Call this when the user asks who or how many are there right now.",
    schema: noArgs,
    implemented: true,
    run: async (_args, ctx) => {
      const { data: location, error: locationError } = await ctx.supabase
        .from('locations')
        .select('slug, name')
        .eq('id', ctx.locationId)
        .maybeSingle()
      if (locationError) throw locationError
      if (!location) {
        return { counts: null, note: 'This member has no active home spot on file.' }
      }

      // The same anonymous-callable aggregate the public site renders from
      // (rev. 5.3 §8 M1) — raw presence rows are RLS-protected to the owning
      // member only, so this is the only path to a real count.
      const snapshot = await fetchPublicSpotCounts(ctx.supabase)
      if (snapshot.availability === 'unavailable') {
        return { counts: null, note: 'Live counts are not available right now.' }
      }

      const counts = countsForSlug(snapshot, (location as { slug: string }).slug)
      return {
        spot: (location as { name: string }).name,
        waiting: counts.waiting,
        driverOffers: counts.driverOffers,
        riderRequests: counts.riderRequests,
      }
    },
  },
  {
    name: 'ride.list_offers',
    riskTier: 'R0',
    description:
      "List currently active ride offers touching the member's home spot. Call this whenever the user asks what rides are available, who is driving, or whether anything matches a time or destination.",
    schema: z.object({ role: z.enum(['driver', 'rider']).optional() }).strict(),
    implemented: true,
    run: async (args, ctx) => {
      // OPEN/PARTIALLY_RESERVED is the whole board a non-participant may see —
      // offers_select_visible_for_caller (0002) does not extend RLS visibility
      // to RESERVED and later for anyone but the poster or a participant, so
      // this filter matches what the query can actually return rather than
      // asking for rows RLS will just drop.
      let query = ctx.supabase
        .from('offers')
        .select(OFFER_COLUMNS)
        .in('state', ['OPEN', 'PARTIALLY_RESERVED'])
        .or(`origin_location_id.eq.${ctx.locationId},destination_location_id.eq.${ctx.locationId}`)
        .order('window_start', { ascending: true })
        .limit(25)

      if (typeof args.role === 'string') query = query.eq('poster_role', args.role)

      const { data, error } = await query
      if (error) throw error
      return { offers: await attachLocationNames(ctx.supabase, (data ?? []) as unknown as OfferRow[]) }
    },
  },
  {
    name: 'ride.get_offer',
    riskTier: 'R0',
    description:
      'Get the full detail of one ride offer by its id. Use after ride.list_offers when the user asks about a specific ride.',
    schema: z.object({ offerId: z.string().uuid() }).strict(),
    implemented: true,
    run: async (args, ctx) => {
      const offer = await fetchOfferForCaller(ctx.supabase, args.offerId as string)
      return offer ? { offer } : { offer: null, note: 'No such offer, or it is not visible to this member.' }
    },
  },
  {
    name: 'incidents.get_active',
    riskTier: 'R0',
    // Option B slice 1 (issue #90, Docs/DECISIONS.md D-68): `incidents_board`
    // now exists (0014/0015). Reads through the caller's own RLS-scoped
    // session, same as ride.list_offers — same-location incidents only.
    description:
      "Get active community incident reports (traffic, HOV backups, lot conditions) at the member's home spot. Call this when the user asks about traffic, delays, or lot conditions.",
    schema: noArgs,
    implemented: true,
    run: async (_args, ctx) => {
      const { data, error } = await ctx.supabase
        .from('incidents_board')
        .select(
          'id, type, description, state, confirmation_count, confirmed_by_me, created_at, expires_at'
        )
        .eq('location_id', ctx.locationId)
        .in('state', ['UNCONFIRMED', 'CONFIRMED'])
        .order('created_at', { ascending: false })
        .limit(25)
      if (error) throw error
      return { incidents: data ?? [] }
    },
  },
  {
    name: 'lostfound.search',
    riskTier: 'R0',
    // TODO(Option B): sluglines has no `lostfound_items` table — see
    // src/app/lostfound/page.tsx, which is explicit that M5 is unbuilt here.
    // Sluglines-AI's 0020/0021 own that schema.
    description: 'Search open lost-and-found items by category and/or ride date. Not available yet.',
    schema: z
      .object({
        kind: z.enum(['lost', 'found']).optional(),
        category: z.string().min(1).max(60).optional(),
        rideDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .strict(),
    implemented: false,
  },
  {
    name: 'ride.explain_match',
    riskTier: 'R1',
    description:
      "Get the structured facts needed to explain how well one offer fits the user's stated need: timing, route, and remaining seats. Advisory only — it never reserves anything.",
    schema: z.object({ offerId: z.string().uuid() }).strict(),
    implemented: true,
    run: async (args, ctx) => {
      const offer = await fetchOfferForCaller(ctx.supabase, args.offerId as string)
      if (!offer) return { offer: null, note: 'No such offer, or it is not visible to this member.' }

      return {
        offer,
        seatsRemaining: offer.seats_total - offer.seats_taken,
        reservable: ['OPEN', 'PARTIALLY_RESERVED'].includes(offer.state),
      }
    },
  },
  {
    name: 'transit.explain_alternatives',
    riskTier: 'R1',
    // TODO(Option B): sluglines has no `stops` table (non-carpool transit
    // alternatives). Sluglines-AI's tool reads one; nothing here does yet.
    description: 'Get known non-carpool alternatives for this corridor. Not available yet.',
    schema: noArgs,
    implemented: false,
  },
  {
    name: 'community.draft_response',
    riskTier: 'R1',
    description:
      'Fetch the community posting rules to check a draft reply against before showing it to the user. Advisory only — it never posts anything.',
    schema: z.object({ draft: z.string().min(1).max(2000) }).strict(),
    implemented: true,
    run: async (args) => ({
      draft: args.draft,
      rules: [
        'No phone numbers, addresses, or last names.',
        'No payment arrangements outside the app.',
        'Keep it factual about times, stops, and seats.',
      ],
    }),
  },

  // Declared, never callable in this slice. The agent cannot change ride state:
  // parsed intents render as pre-filled forms the user submits themselves.
  { name: 'ride.create_offer', riskTier: 'R2', description: 'Create a ride offer.', schema: noArgs, implemented: false },
  { name: 'ride.reserve_seat', riskTier: 'R2', description: 'Reserve a seat.', schema: noArgs, implemented: false },
  { name: 'ride.release_seat', riskTier: 'R2', description: 'Release a seat.', schema: noArgs, implemented: false },
  { name: 'ride.update_eta', riskTier: 'R2', description: 'Post an ETA update.', schema: noArgs, implemented: false },
  { name: 'presence.check_in', riskTier: 'R2', description: 'Check in at the lot.', schema: noArgs, implemented: false },
  { name: 'lostfound.report_item', riskTier: 'R2', description: 'Report a lost or found item.', schema: noArgs, implemented: false },
  { name: 'incidents.report', riskTier: 'R2', description: 'Report an incident.', schema: noArgs, implemented: false },
  { name: 'ride.cancel_confirmed', riskTier: 'R3', description: 'Cancel a confirmed ride.', schema: noArgs, implemented: false },
  { name: 'moderation.restrict_user', riskTier: 'R3', description: 'Restrict a member.', schema: noArgs, implemented: false },
]

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]))

// Only implemented R0/R1 tools are ever advertised to the model. A tool the
// gate would refuse is a tool the model should not be able to see.
export const CALLABLE_TOOLS = TOOLS.filter(
  (t) => t.implemented && (t.riskTier === 'R0' || t.riskTier === 'R1')
)
