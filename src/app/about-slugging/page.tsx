import { notFound } from 'next/navigation'
import LegacyContentPage from '@/components/LegacyContentPage'
import { buildLegacyMetadata, getLegacyPageByPath } from '@/lib/legacy-content'

const aboutSluggingPage = getLegacyPageByPath('/about-slugging/')

export const metadata = aboutSluggingPage
  ? buildLegacyMetadata(aboutSluggingPage)
  : {
      title: 'About Slugging - Sluglines',
    }

export default function AboutSluggingPage() {
  if (!aboutSluggingPage) {
    notFound()
  }

  return <LegacyContentPage page={aboutSluggingPage} />
}
