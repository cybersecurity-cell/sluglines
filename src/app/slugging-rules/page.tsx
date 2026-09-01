import { AlertTriangle, Car, CheckCircle, ShieldCheck, Users } from 'lucide-react'

export const metadata = {
  title: 'Slugging Rules & Etiquette | Sluglines',
  description:
    "The official slugging rules and etiquette for Northern Virginia slug lines. Learn the do's and don'ts for a smooth, respectful ride.",
}

const RIDER_RULES = [
  'Confirm your destination with the driver',
  'Say hello and thank you',
  'No money exchanged, ever',
  'First come, first served in the line',
  'Feel free to pass on a ride if you are not comfortable',
  'Buckle up',
  'Keep phone conversations short',
  'Do not eat, drink, smoke, or groom in the car',
  'Keep the ride quiet unless the driver starts conversation',
]

const DRIVER_RULES = [
  'Confirm destination before riders board',
  'Drive safely and responsibly',
  'Maintain a comfortable temperature',
  'Keep audio at a reasonable volume',
  'Drop riders at the agreed location',
  'Feel free to pass on a rider if you have concerns',
  'Keep the car clean and presentable',
  'No smoking in the vehicle',
]

const GOLDEN_RULES = [
  { title: 'No Money', desc: 'No fares, tips, or payments of any kind' },
  { title: 'Be Respectful', desc: 'Treat every rider and driver with courtesy' },
  { title: 'Stay Safe', desc: 'If something feels wrong, feel free to pass' },
]

export default function SluggingRulesPage() {
  return (
    <div className="bg-white text-[#17202A]">
      <section className="border-b border-stone-200 bg-[#FAFAF8]">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#2E7D46]">Rules and etiquette</p>
          <h1 className="h-display max-w-4xl text-4xl text-[#17202A] md:text-5xl">
            The customs that keep slugging fast, safe, and respectful.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Slug lines are self-governed by their participants. These rules have been established over decades so drivers
            and riders can coordinate quickly and commute with confidence.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {GOLDEN_RULES.map((item) => (
            <article key={item.title} className="rounded-lg border border-stone-200 bg-[#FAFAF8] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#EAF2ED] text-[#2E7D46]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="h-display text-lg text-[#17202A]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.desc}</p>
            </article>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RuleList title="For riders" icon="rider" rules={RIDER_RULES} />
          <RuleList title="For drivers" icon="driver" rules={DRIVER_RULES} />
        </div>

        <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <p className="text-sm leading-7 text-amber-950">
              Slugging is informal and self-governed. Drivers and riders participate at their own discretion. When in
              doubt, trust your judgment and pass on a ride.
            </p>
          </div>
        </section>
      </section>
    </div>
  )
}

function RuleList({ title, icon, rules }: { title: string; icon: 'rider' | 'driver'; rules: string[] }) {
  const Icon = icon === 'rider' ? Users : Car
  // §10's semantic pair: `--rider` amber, `--driver` blue. These two lists were
  // emerald and sky — sky being the retired brand chrome, and emerald being the
  // colour §10 gives the accent rather than a role, so the driver list read as
  // "brand" and the rider list read as "accent". Neither carries meaning alone:
  // the heading beside each icon says which list it is (WCAG 1.4.1).
  const color = icon === 'rider' ? 'text-amber-800 bg-amber-50' : 'text-blue-800 bg-blue-50'

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="h-display text-xl text-[#17202A]">{title}</h2>
      </div>
      <ul className="space-y-3">
        {rules.map((rule) => (
          <li key={rule} className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#2E7D46]" />
            <span className="text-sm leading-6 text-slate-700">{rule}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
