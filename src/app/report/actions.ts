'use server'

import { redirect } from 'next/navigation'

import { validateCorrectionReport } from '@/lib/domain/correction-report'
import { createClient } from '@/lib/supabase/server'

function reportMessage(message: string): never {
  redirect(`/report?message=${encodeURIComponent(message)}`)
}

export async function submitCorrectionReport(formData: FormData) {
  const validation = validateCorrectionReport({
    category: formData.get('category'), details: formData.get('details'), locationId: formData.get('locationId'), sourceUrl: formData.get('sourceUrl'), summary: formData.get('summary'), website: formData.get('website'),
  })
  if (!validation.ok) reportMessage(validation.errors.form ?? 'Review the report fields.')

  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/auth/sign-in?next=%2Freport')

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await client.from('correction_reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since)
  if ((count ?? 0) >= 5) reportMessage('You have submitted several recent reports. Please try again later.')

  const value = validation.value
  const { error } = await client.from('correction_reports').insert({ user_id: user.id, location_id: value.locationId, category: value.category, summary: value.summary, details: value.details, source_url: value.sourceUrl })
  if (error) reportMessage('Unable to submit your report right now.')
  reportMessage('Thank you. Your correction was submitted for review.')
}
