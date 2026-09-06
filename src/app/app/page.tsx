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

  return (
    <LegacyContentPage
      page={appPage}
      notice="This page is preserved from the 2018 Sluglines site. The iOS and Android apps it describes are no longer maintained or available. Checking in and finding a ride now happen on this website: open a spot page to check in, or the Board to post or reserve a seat."
    />
  )
}
