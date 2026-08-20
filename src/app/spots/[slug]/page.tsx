import { redirect } from 'next/navigation'

export default async function LegacySpotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/locations/${encodeURIComponent(slug)}`)
}
