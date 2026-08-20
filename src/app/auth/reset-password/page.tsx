import type { Metadata } from 'next'

import { AuthForm } from '@/components/auth/AuthForm'

import { updatePassword } from '../actions'

export const metadata: Metadata = { title: 'Choose a new password | Sluglines' }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  return <div className="mx-auto max-w-md px-5 py-14 sm:px-8 md:py-20"><AuthForm action={updatePassword} message={message?.slice(0, 200)} mode="reset-password" /></div>
}
