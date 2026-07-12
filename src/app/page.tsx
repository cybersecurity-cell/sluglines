import LegacyContentPage from '@/components/LegacyContentPage'
import { buildLegacyMetadata, getLegacyPageByPath } from '@/lib/legacy-content'

const homePage = getLegacyPageByPath('/')

export const metadata = homePage
  ? buildLegacyMetadata(homePage)
  : {
      title: 'Sluglines - Connecting drivers and riders for better commute',
      description: 'Connecting drivers and riders for better commute',
    }

export default function HomePage() {
  return <LegacyContentPage page={homePage!} />
}
