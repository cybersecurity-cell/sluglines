export interface NavItem {
  label: string
  href: string
}

export interface ResourceModule {
  title: string
  description: string
  href: string
}

/**
 * The primary nav is still the WordPress IA plus the one zone §10 names that
 * had no entry anywhere (issue #135): the Board. `Slug Pickup` is §10's Spots
 * zone under the name the community has used for twenty years; `/slug_pickup`
 * runs the same directory search as `/spots`. Sign-in is a separate control in
 * `Navbar`, not a nav item, so it can sit apart from the content links. The
 * full §10 tab bar (Lost & Found · Me) waits on the authenticated-surface
 * migration; see D-85.
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Slug Pickup', href: '/slug_pickup' },
  { label: 'Board', href: '/board' },
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
]

export const HOMEPAGE_STATS = [
  { label: 'Corridors', value: 'I-95 / I-395 / I-66' },
  { label: 'Primary use', value: 'Morning and afternoon commuting' },
  { label: 'Cost', value: 'Free' },
]
