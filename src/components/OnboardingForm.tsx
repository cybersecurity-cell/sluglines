import { completeOnboarding } from '@/app/onboarding/actions'
import type { HomeSpotOption } from '@/lib/onboarding'

interface OnboardingFormProps {
  currentDisplayName: string
  currentLocationId: string | null
  homeSpots: HomeSpotOption[]
  failed: boolean
}

/**
 * The rev. 5.3 §8 M2 onboarding form: display name, plus an optional home
 * spot. Server-rendered — the only write is the `completeOnboarding` Server
 * Action, so this page ships no Supabase client to the browser (see
 * `onboarding/actions.ts`).
 *
 * The home-spot field is entirely absent, not merely empty, when
 * `homeSpots` is `[]` — grouped by corridor and direction, the same
 * structure the fast board reads. See `lib/onboarding.ts` for why an empty
 * list is an expected outcome today (`locations`, 0004, is unapplied) rather
 * than an error, and why the field is optional either way.
 */
export default function OnboardingForm({
  currentDisplayName,
  currentLocationId,
  homeSpots,
  failed,
}: OnboardingFormProps) {
  const groups = groupByCorridorDirection(homeSpots)

  return (
    <form action={completeOnboarding} className="space-y-6">
      {failed && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          That did not save. Check the name below and try again.
        </p>
      )}

      <div>
        <label htmlFor="display_name" className="block text-sm font-bold text-slate-950">
          Display name
        </label>
        <p className="mt-1 text-sm text-slate-700">Shown to other members you ride with. 1-40 characters.</p>
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          minLength={1}
          maxLength={40}
          defaultValue={currentDisplayName}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </div>

      {groups.length > 0 && (
        <div>
          <label htmlFor="location_id" className="block text-sm font-bold text-slate-950">
            Home spot
          </label>
          <p className="mt-1 text-sm text-slate-700">
            Optional. Sets your default line on the board. Only active spots are listed.
          </p>
          <select
            id="location_id"
            name="location_id"
            defaultValue={currentLocationId ?? ''}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-950 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            <option value="">Not now</option>
            {groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.spots.map((spot: HomeSpotOption) => (
                  <option key={spot.id} value={spot.id}>
                    {spot.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        className="w-full rounded-lg bg-sky-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-sky-800"
      >
        Continue
      </button>
    </form>
  )
}

function groupByCorridorDirection(homeSpots: HomeSpotOption[]) {
  const byLabel = new Map<string, HomeSpotOption[]>()

  for (const spot of homeSpots) {
    const label = `${spot.corridor} · ${spot.direction}`
    const existing = byLabel.get(label)
    if (existing) {
      existing.push(spot)
    } else {
      byLabel.set(label, [spot])
    }
  }

  return Array.from(byLabel.entries()).map(([label, spots]) => ({ label, spots }))
}
