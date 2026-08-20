import type { Metadata } from 'next'

import { AuthForm } from '@/components/auth/AuthForm'

import { signUp } from '../actions'

export const metadata: Metadata = { title: 'Create an account | Sluglines' }

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  return <div className="mx-auto max-w-md px-5 py-14 sm:px-8 md:py-20"><AuthForm action={signUp} message={message?.slice(0, 200)} mode="sign-up" /></div>
}
