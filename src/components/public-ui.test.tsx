import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthForm } from './auth/AuthForm'
import { LocationGrid } from './LocationGrid'
import { LocationSearch } from './LocationSearch'
import Navbar from './Navbar'
import { RouteHero } from './RouteHero'

describe('public interface', () => {
  it('provides semantic primary navigation and account access', () => {
    render(<Navbar />)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Locations' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Sign in' }).length).toBeGreaterThan(0)
  })

  it('labels every location filter', () => {
    render(<LocationSearch />)
    expect(screen.getByRole('searchbox', { name: 'Pickup area or destination' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Corridor' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Direction' })).toBeInTheDocument()
  })

  it('renders empty and failure states honestly', () => {
    const { rerender } = render(<LocationGrid locations={[]} />)
    expect(screen.getByText(/No locations match/)).toBeInTheDocument()
    rerender(<LocationGrid error="unavailable" locations={[]} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/temporarily unavailable/)
  })

  it('uses information-first hero and secure auth hints', () => {
    const { rerender } = render(<RouteHero />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Plan your slugging commute/)
    rerender(<AuthForm action="/auth" mode="sign-up" />)
    expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  })
})
