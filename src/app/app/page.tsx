import { notFound } from 'next/navigation'
import LegacyContentPage from '@/components/LegacyContentPage'
import { buildLegacyMetadata, getLegacyPageByPath } from '@/lib/legacy-content'

const appPage = getLegacyPageByPath('/app/')

export const metadata = appPage
  ? buildLegacyMetadata(appPage)
  : {
      title: 'App - Sluglines',
    }

export default function AppPage() {
  if (!appPage) {
    notFound()
  }

  return <LegacyContentPage page={appPage} />
}
