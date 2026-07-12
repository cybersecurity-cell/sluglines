import { notFound } from 'next/navigation'
import LegacyContentPage from '@/components/LegacyContentPage'
import {
  buildLegacyMetadata,
  getLegacyRouteForPath,
  getLegacyStaticParams,
} from '@/lib/legacy-content'

interface LegacyRoutePageProps {
  params: {
    legacyPath: string[]
  }
}

export function generateStaticParams() {
  return getLegacyStaticParams()
}

export function generateMetadata({ params }: LegacyRoutePageProps) {
  const page = getLegacyRouteForPath(`/${params.legacyPath.join('/')}/`)

  if (!page) {
    return { title: 'Page Not Found - Sluglines' }
  }

  return buildLegacyMetadata(page)
}

export default function LegacyRoutePage({ params }: LegacyRoutePageProps) {
  const page = getLegacyRouteForPath(`/${params.legacyPath.join('/')}/`)

  if (!page) {
    notFound()
  }

  return <LegacyContentPage page={page} />
}
