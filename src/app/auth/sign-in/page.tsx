import type { Metadata } from 'next'

import { AuthForm } from '@/components/auth/AuthForm'
import { safeRedirectPath } from '@/lib/auth/validation'

import { signIn } from '../actions'

export const metadata: Metadata = { title: 'Sign in | Sluglines' }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ message?: string; next?: string }> }) {
  const params = await searchParams
  return <div className="mx-auto max-w-md px-5 py-14 sm:px-8 md:py-20"><AuthForm action={signIn} message={params.message?.slice(0, 200)} mode="sign-in" next={safeRedirectPath(params.next)} /></div>
}
