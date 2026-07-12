import PostIndexPage from '@/components/PostIndexPage'

export const metadata = {
  title: 'News - Sluglines',
  description: 'Northern Virginia slugging, HOV, Metro, and commuter news from the Sluglines archive.',
}

export default function NewsPage() {
  return (
    <PostIndexPage
      eyebrow="Commuter news"
      title="News that affects slugging"
      description="A focused view of Sluglines archive updates about Metro work, HOV changes, commuter lots, corridor conditions, and slug line moves."
      topic="news"
    />
  )
}
