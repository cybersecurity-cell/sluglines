import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Car,
  MapPin,
  Route,
  SlidersHorizontal,
  Users,
} from 'lucide-react'

export const metadata = {
  title: 'How It Works - Sluglines',
  description: 'Learn how slugging works for Northern Virginia HOV-3 carpooling.',
}

/**
 * These three cards used to hotlink decorative photographs from
 * `sluglines.com/wp-content/uploads/` — the legacy WordPress host.
 *
 * That was a live production dependency on the site being decommissioned. At the
 * #25 DNS cutover `sluglines.com` points here, those URLs stop resolving, and the
 * page silently loses its images. It also violated this app's own CSP
 * (`img-src 'self' data: blob:`, D-48), so enforcing that policy would have
 * broken them anyway — and re-hosting them instead is blocked on the third-party
 * rights review in #39, which covers exactly these `wp-content` assets.
 *
 * Found by `tests/e2e/console.spec.ts` on its first run (#35): three
 * `ERR_TUNNEL_CONNECTION_FAILED` entries, one per image.
 *
 * The images were decorative — `alt=""` — so removing them loses no information.
 * The circular frame and the icon it contains carry the design on their own.
 */
const visualSteps = [
  {
    title: 'Line up',
    caption: 'Riders line up at known pickup spots.',
    icon: SlidersHorizontal,
  },
  {
    title: 'Match destination',
    caption: 'Drivers call out or display their destination.',
    icon: Route,
  },
  {
    title: 'Ride together',
    caption: 'Riders heading that way get in and everyone saves time.',
    icon: BadgeCheck,
  },
]

const processSteps = [
  {
    step: '01',
    icon: MapPin,
    title: 'Go to a Slug Line Spot',
    desc: 'Head to one of the designated pickup locations across Northern Virginia. Riders form a line and wait quietly.',
  },
  {
    step: '02',
    icon: Car,
    title: 'Driver Announces Destination',
    desc: 'A driver pulls up and announces their destination, either with a sign or by calling it out. Riders at the front of the line for that destination get in.',
  },
  {
    step: '03',
    icon: Users,
    title: 'Fill the HOV-3 Requirement',
    desc: 'The driver picks up 2 riders to qualify for HOV-3 status. All three now have access to the express lanes.',
  },
  {
    step: '04',
    icon: ArrowRight,
    title: 'Drop Off at Destination',
    desc: 'Driver drops riders at the agreed-upon location. No money exchanged, ever. Everyone saves time.',
  },
]

/*
 * Two of these answers stated things this repo has no source for.
 *
 * "Slugging has operated in Northern Virginia since the 1970s with an excellent
 * safety record." The date is sourced — the legacy About Slugging page puts the
 * start at 1975, with the first I-395 HOV lanes — but nothing in this repo
 * measures a safety record, and this is the page a first-time rider reads before
 * getting into a stranger's car. An unverifiable reassurance about physical
 * safety is the one place §10's honesty rule matters most, so the answer now
 * says what the arrangement actually is, which is also what /slugging-rules
 * already tells people.
 *
 * "Morning ... 6 AM to 9 AM ... Afternoon ... 4 PM to 7 PM." Neither matched the
 * canonical peak windows (05:30–09:30 and 15:00–19:00 ET, rev. 6 §12), which is
 * the denominator every corridor count on this site is bucketed into, and which
 * SiteHero, CorridorStatusStrip, FastBoard and SpotLiveCounts all print as
 * 5:30–9:30. This page was the only surface disagreeing with the other four.
 */
const faqs = [
  {
    q: 'Is slugging safe?',
    a: 'Slugging has run in Northern Virginia since 1975, when the first HOV lanes opened on I-395. It is informal and self-governed: nobody screens drivers or riders, and both are free to pass on any ride they are not comfortable with.',
  },
  {
    q: 'Do I need to register or pay?',
    a: 'No. Slugging is completely free and informal. No money is ever exchanged between drivers and riders.',
  },
  {
    q: 'What are the peak hours?',
    a: 'Weekdays, 5:30–9:30 in the morning from the suburbs toward DC, and 3:00–7:00 in the afternoon from DC back out.',
  },
  {
    q: 'Can I request a specific route?',
    a: 'Riders take the first car heading to their destination. Drivers call the destination, and the line moves in order.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="bg-white text-[#17202A]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <section className="mb-12 max-w-4xl">
          <p className="section-label mb-3">The process</p>
          <h1 className="h-display mb-4 text-4xl text-[#17202A] md:text-5xl">How Slugging Works</h1>
          <p className="text-lg leading-8 text-slate-600">
            Slugging is Northern Virginia&apos;s unofficial carpool system. Drivers get the riders they need for HOV-3,
            and riders get a free commute to a shared destination.
          </p>
        </section>

        <section className="mb-14 rounded-lg border border-stone-200 bg-[#FAFAF8] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <p className="section-label mb-3">What is slugging?</p>
            <h2 className="h-display text-3xl text-[#17202A]">A simple three-part exchange</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              The original Sluglines site explained the flow with real commuter photos. This version keeps that same
              authenticity and makes the process easier to scan on phones and desktops.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {visualSteps.map((item) => {
              const Icon = item.icon

              return (
                <article key={item.title} className="text-center">
                  <div className="relative mx-auto aspect-square max-w-[18rem] overflow-hidden rounded-full border border-stone-200 bg-[#EAF2ED]">
                    <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200 bg-white text-[#2E7D46] shadow-lg">
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    </div>
                  </div>
                  <h3 className="h-display mt-5 text-lg text-[#17202A]">{item.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">{item.caption}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="mb-14 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {processSteps.map((item) => {
            const Icon = item.icon

            return (
              <article key={item.step} className="rounded-lg border border-stone-200 bg-white p-5">
                <div className="flex gap-4">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-[#EAF2ED] text-[#2E7D46]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="mb-1 font-mono text-xs font-semibold text-[#2E7D46]">{item.step}</div>
                    <h3 className="h-display mb-2 text-lg text-[#17202A]">{item.title}</h3>
                    <p className="text-sm leading-7 text-slate-600">{item.desc}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <section className="mb-14">
          <h2 className="h-display mb-6 text-2xl text-[#17202A]">Common Questions</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <article key={faq.q} className="rounded-lg border border-stone-200 bg-white p-5">
                <h3 className="mb-2 font-semibold text-[#17202A]">{faq.q}</h3>
                <p className="text-sm leading-7 text-slate-600">{faq.a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-[#FAFAF8] p-8 text-center">
          <h2 className="h-display mb-3 text-2xl text-[#17202A]">Ready to try it?</h2>
          <p className="mb-6 text-sm text-slate-600">Find your nearest pickup spot and see what the directory knows.</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/spots" className="btn-primary text-sm">View Slug Spots</Link>
            <Link href="/slugging-rules" className="btn-secondary text-sm">Read the Rules</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
