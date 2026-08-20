'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { validateCommutePreferences, validateProfile } from '@/lib/account/validation'
import { createClient } from '@/lib/supabase/server'

async function authenticatedClient() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/auth/sign-in?next=%2Faccount')
  return { client, user }
}

function accountMessage(message: string): never {
  redirect(`/account?message=${encodeURIComponent(message)}`)
}

export async function updateProfile(formData: FormData) {
  const validation = validateProfile({ displayName: formData.get('displayName') })
  if (!validation.ok) accountMessage(validation.errors.displayName)
  const { client, user } = await authenticatedClient()
  const { error } = await client.from('profiles').update({ display_name: validation.value.displayName }).eq('id', user.id)
  if (error) accountMessage('Unable to save your profile right now.')
  revalidatePath('/account')
  accountMessage('Profile saved.')
}

export async function updatePreferences(formData: FormData) {
  const validation = validateCommutePreferences({
    homeLocationId: formData.get('homeLocationId'),
    destinationId: formData.get('destinationId'),
    preferredDirection: formData.get('preferredDirection'),
    emailAdvisories: formData.get('emailAdvisories'),
  })
  if (!validation.ok) accountMessage('Review your commute preferences.')
  const { client, user } = await authenticatedClient()
  const value = validation.value
  const { error } = await client.from('commute_preferences').upsert({
    user_id: user.id,
    home_location_id: value.homeLocationId,
    destination_id: value.destinationId,
    preferred_direction: value.preferredDirection,
    email_advisories: value.emailAdvisories,
  })
  if (error) accountMessage('Unable to save your preferences right now.')
  revalidatePath('/account')
  accountMessage('Commute preferences saved.')
}

export async function saveLocation(formData: FormData) {
  const locationId = formData.get('locationId')
  if (typeof locationId !== 'string') accountMessage('Choose a valid location.')
  const { client, user } = await authenticatedClient()
  const { error } = await client.from('saved_locations').upsert({ user_id: user.id, location_id: locationId }, { onConflict: 'user_id,location_id' })
  if (error) accountMessage('Unable to save that location right now.')
  revalidatePath('/account')
  accountMessage('Location saved.')
}

export async function removeSavedLocation(formData: FormData) {
  const locationId = formData.get('locationId')
  if (typeof locationId !== 'string') accountMessage('Choose a valid location.')
  const { client, user } = await authenticatedClient()
  const { error } = await client.from('saved_locations').delete().eq('user_id', user.id).eq('location_id', locationId)
  if (error) accountMessage('Unable to remove that location right now.')
  revalidatePath('/account')
  accountMessage('Location removed.')
}
