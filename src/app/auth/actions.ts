'use server'

import { redirect } from 'next/navigation'

import { createAuthService } from '@/lib/auth/service'
import { createSupabaseAuthGateway } from '@/lib/auth/supabase-gateway'
import { createClient } from '@/lib/supabase/server'

function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://sluglines.com'
}

function withMessage(path: string, message: string): string {
  const query = new URLSearchParams({ message })
  return `${path}?${query}`
}

async function service() {
  const client = await createClient()
  return createAuthService(createSupabaseAuthGateway(client))
}

export async function signUp(formData: FormData) {
  const result = await (await service()).register({
    displayName: formData.get('displayName'),
    email: formData.get('email'),
    password: formData.get('password'),
  }, siteOrigin())
  redirect(withMessage(result.ok ? '/auth/verify' : '/auth/sign-up', result.message ?? 'Review the form.'))
}

export async function signIn(formData: FormData) {
  const result = await (await service()).signIn(formData.get('email'), formData.get('password'), formData.get('next'))
  redirect(result.ok ? result.redirectTo ?? '/account' : withMessage('/auth/sign-in', result.message))
}

export async function requestPasswordReset(formData: FormData) {
  const result = await (await service()).requestPasswordReset(formData.get('email'), siteOrigin())
  redirect(withMessage('/auth/forgot-password', result.message ?? 'Check your email.'))
}

export async function updatePassword(formData: FormData) {
  const result = await (await service()).updatePassword(formData.get('password'))
  redirect(withMessage(result.ok ? '/auth/sign-in' : '/auth/reset-password', result.message ?? 'Unable to update your password.'))
}

export async function signOut() {
  const result = await (await service()).signOut()
  redirect(result.ok ? '/' : withMessage('/account', result.message))
}
