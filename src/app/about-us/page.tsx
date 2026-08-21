import { notFound } from 'next/navigation'
import LegacyContentPage from '@/components/LegacyContentPage'
import { buildLegacyMetadata, getLegacyPageByPath } from '@/lib/legacy-content'

const aboutUsPage = getLegacyPageByPath('/about-us/')

export const metadata = aboutUsPage
  ? buildLegacyMetadata(aboutUsPage)
  : {
      title: 'About Us - Sluglines',
    }

export default function AboutUsPage() {
  if (!aboutUsPage) {
    notFound()
  }

  return <LegacyContentPage page={aboutUsPage} />
}
