import { describe, expect, it } from 'vitest'

import packageJson from '../../package.json'

describe('project foundation', () => {
  it('identifies the application as Sluglines', () => {
    expect(packageJson.name).toBe('sluglines')
    expect(packageJson.description).toContain('Northern Virginia')
  })
})
