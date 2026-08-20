import type { Metadata } from 'next'

import { AuthForm } from '@/components/auth/AuthForm'

import { requestPasswordReset } from '../actions'

export const metadata: Metadata = { title: 'Reset password | Sluglines' }

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  return <div className="mx-auto max-w-md px-5 py-14 sm:px-8 md:py-20"><AuthForm action={requestPasswordReset} message={message?.slice(0, 200)} mode="forgot-password" /></div>
}
