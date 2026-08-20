import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Verify your email | Sluglines' }

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  return <div className="mx-auto max-w-xl px-5 py-20 text-center"><div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">One more step</p><h1 className="mt-2 text-3xl font-black">Check your email</h1><p className="mt-4 leading-7 text-slate-600">{message?.slice(0, 200) ?? 'Use the verification link in your email to finish creating your account.'}</p><p className="mt-4 text-sm text-slate-500">You can close this page after following the link.</p></div></div>
}
