import Link from 'next/link'

export default function NotFoundPage() {
  return <div className="mx-auto max-w-2xl px-5 py-24 text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">404</p><h1 className="mt-2 text-4xl font-black">We could not find that page.</h1><p className="mt-4 text-slate-600">The link may be outdated, or the location may not be published.</p><Link className="mt-7 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-bold text-white" href="/locations">Browse locations</Link></div>
}
