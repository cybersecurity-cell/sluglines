import { notFound } from 'next/navigation'
import LegacyContentPage from '@/components/LegacyContentPage'
import {
  buildLegacyMetadata,
  getLegacyRouteForPath,
  getLegacyStaticParams,
} from '@/lib/legacy-content'

interface LegacyRoutePageProps {
  params: Promise<{
    legacyPath: string[]
  }>
}

export function generateStaticParams() {
  return getLegacyStaticParams()
}

export async function generateMetadata({ params }: LegacyRoutePageProps) {
  const { legacyPath } = await params
  const page = getLegacyRouteForPath(`/${legacyPath.join('/')}/`)

  if (!page) {
    return { title: 'Page Not Found - Sluglines' }
  }

  return buildLegacyMetadata(page)
}

export default async function LegacyRoutePage({ params }: LegacyRoutePageProps) {
  const { legacyPath } = await params
  const page = getLegacyRouteForPath(`/${legacyPath.join('/')}/`)

  if (!page) {
    notFound()
  }

  return <LegacyContentPage page={page} />
}
