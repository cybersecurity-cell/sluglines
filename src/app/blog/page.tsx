import PostIndexPage from '@/components/PostIndexPage'

export const metadata = {
  title: 'Blog - Sluglines',
  description: 'Sluglines archive posts, commuter updates, and community announcements.',
}

export default function BlogPage() {
  return (
    <PostIndexPage
      eyebrow="Sluglines blog"
      title="Slugging updates and commuter stories"
      description="Browse the migrated Sluglines archive in a cleaner format, with updates about slug lines, commuting, Metro disruptions, parking, and HOV changes."
      topic="blog"
    />
  )
}
