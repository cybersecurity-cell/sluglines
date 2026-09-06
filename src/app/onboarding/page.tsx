import { redirect } from 'next/navigation'
import OnboardingForm from '@/components/OnboardingForm'
import { isPlaceholderDisplayName, safeNextPath, signedInDestination } from '@/lib/domain/auth-return'
import { getActiveHomeSpotOptions, getAuthenticatedUserId, getMemberProfile } from '@/lib/onboarding'

/**
 * `/onboarding` — rev. 5.3 §8 M2, the last step of phone-OTP sign-in.
 *
 * Requires a session: `handle_new_member()` (0001) already created a
 * `members` row with a placeholder display name the moment `/verify`
 * completed the OTP, so this page's only job is collecting the two things
 * that trigger cannot know — a real display name and, optionally, a home
 * spot — never creating the row itself.
 *
 * rev. 5.3 §7.1 risk 9 ("friction regression: OTP wall in front of reading")
 * is why this is the only page in the identity flow that requires a session
 * to *view*: `/spots` and the fast board's aggregates stay public. This page
 * is reachable only after `/verify` has already produced one.
 *
 * ONCE, NOT EVERY TIME (issue #136)
 * ---------------------------------------------------------------------------
 * rev. 5.3 §10 (3) says onboarding runs once. `/verify` cannot know whether a
 * member is new, so it always lands here — and this page decides: a member
 * whose display name is no longer `handle_new_member()`'s placeholder has
 * been through this already and is sent straight on to `next` (the page they
 * were trying to reach) or the dashboard. A member whose profile cannot be
 * read is shown the form, not bounced — the form is harmless to repeat, and
 * "could not read" is not evidence of anything.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Finish setting up - Sluglines',
  description: 'Set your display name and home spot to finish signing in.',
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ onboarding?: string; next?: string }>
}) {
  const userId = await getAuthenticatedUserId()
  if (userId === null) {
    redirect('/login')
  }

  const [profile, homeSpots, resolvedSearchParams] = await Promise.all([
    getMemberProfile(userId),
    getActiveHomeSpotOptions(),
    searchParams,
  ])
  const next = safeNextPath(resolvedSearchParams?.next)

  if (profile !== null && !isPlaceholderDisplayName(profile.displayName)) {
    redirect(signedInDestination(next))
  }

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-xl px-4 py-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">Almost there</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Finish setting up</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            You&apos;re signed in. Pick a name other members will see and, if you want, a home spot.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-xl px-4 py-8">
        <OnboardingForm
          currentDisplayName={profile?.displayName ?? ''}
          currentLocationId={profile?.locationId ?? null}
          homeSpots={homeSpots}
          failed={resolvedSearchParams?.onboarding === 'failed'}
          next={next}
        />
      </div>
    </div>
  )
}
