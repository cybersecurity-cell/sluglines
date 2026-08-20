import { render } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'

import { AuthForm } from '@/components/auth/AuthForm'
import { LocationSearch } from '@/components/LocationSearch'
import Navbar from '@/components/Navbar'
import { RouteHero } from '@/components/RouteHero'
import { SiteFooter } from '@/components/SiteFooter'

describe('automated accessibility checks', () => {
  it.each([
    ['navigation', <Navbar key="navigation" />],
    ['hero', <RouteHero key="hero" />],
    ['location search', <LocationSearch key="location-search" />],
    ['registration', <AuthForm action="/auth" key="registration" mode="sign-up" />],
    ['footer', <SiteFooter key="footer" />],
  ])('%s has no axe violations', async (_name, component) => {
    const { container } = render(component)
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(result.violations).toEqual([])
  })
})
