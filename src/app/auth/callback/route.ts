import { NextResponse } from 'next/server'

import { safeRedirectPath } from '@/lib/auth/validation'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeRedirectPath(url.searchParams.get('next'))
  if (!code) return NextResponse.redirect(new URL('/auth/sign-in?message=Verification+link+is+invalid+or+expired.', url.origin))

  const client = await createClient()
  const { error } = await client.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/auth/sign-in?message=Unable+to+verify+that+link.', url.origin))
  return NextResponse.redirect(new URL(next, url.origin))
}
