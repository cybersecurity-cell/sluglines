import Link from 'next/link'
import { ArrowRight, BookOpen, Newspaper, Smartphone, Map } from 'lucide-react'
import { RESOURCE_MODULES } from '@/lib/site-content'

const ICONS = {
  'Slug Pickup': Map,
  'Rules & Etiquette': BookOpen,
  'Blog & News': Newspaper,
  'Mobile App': Smartphone,
}

export default function InfoModuleGrid() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">Community resources</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">Everything around the commute</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Sluglines is a reference site first: locations, rules, community updates, and tools for riders and drivers.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {RESOURCE_MODULES.map((module) => {
            const Icon = ICONS[module.title as keyof typeof ICONS] || BookOpen

            return (
              <Link
                key={module.title}
                href={module.href}
                className="group rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-sky-200 hover:bg-sky-50"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sky-700 ring-1 ring-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-950">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-sky-700 group-hover:text-sky-900">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
