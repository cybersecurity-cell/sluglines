export interface NavItem {
  label: string
  href: string
}

export interface ResourceModule {
  title: string
  description: string
  href: string
}

export const PRIMARY_NAV: NavItem[] = [
  { label: 'Slug Pickup', href: '/slug_pickup' },
  { label: 'App', href: '/app' },
  { label: 'Blog', href: '/blog' },
  { label: 'News', href: '/news' },
  { label: 'Rules', href: '/slugging-rules-and-etiquette' },
]

export const ABOUT_NAV: NavItem[] = [
  { label: 'About Slugging', href: '/about-slugging' },
  { label: 'About Us', href: '/about-us' },
]

export const RESOURCE_MODULES: ResourceModule[] = [
  {
    title: 'Slug Pickup',
    description: 'Find morning and afternoon pickup lines by corridor, county, and destination.',
    href: '/slug_pickup',
  },
  {
    title: 'Rules & Etiquette',
    description: 'Learn the customs that keep slugging fast, safe, and respectful.',
    href: '/slugging-rules-and-etiquette',
  },
  {
    title: 'Blog & News',
    description: 'Slugging updates, commuter news, and site announcements.',
    href: '/blog',
  },
  {
    title: 'Mobile App',
    description: 'Live counts and check-ins for commuters who are already on the move.',
    href: '/app',
  },
]

export const HOMEPAGE_STATS = [
  { label: 'Corridors', value: 'I-95 / I-395 / I-66' },
  { label: 'Primary use', value: 'Morning and afternoon commuting' },
  { label: 'Cost', value: 'Free' },
]
