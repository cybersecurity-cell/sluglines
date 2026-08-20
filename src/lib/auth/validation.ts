export interface SignUpInput {
  email?: unknown
  password?: unknown
  displayName?: unknown
}

export interface SignUpValue {
  email: string
  password: string
  displayName: string
}

export type SignUpValidation =
  | { ok: true; value: SignUpValue }
  | { ok: false; errors: Partial<Record<keyof SignUpValue, string>> }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function safeRedirectPath(value: unknown, fallback = '/account'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  if (value.includes('\\') || /[\u0000-\u001F\u007F]/.test(value)) return fallback

  try {
    const base = new URL('https://sluglines.local')
    const target = new URL(value, base)
    if (target.origin !== base.origin) return fallback
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}

export function validateSignUp(input: SignUpInput): SignUpValidation {
  const email = text(input.email).toLocaleLowerCase('en-US')
  const password = typeof input.password === 'string' ? input.password : ''
  const displayName = text(input.displayName)
  const errors: Partial<Record<keyof SignUpValue, string>> = {}

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    errors.email = 'Enter a valid email address.'
  }
  if (password.length < 12) errors.password = 'Use at least 12 characters.'
  if (displayName.length < 2 || displayName.length > 80) {
    errors.displayName = 'Use between 2 and 80 characters.'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { email, password, displayName } }
}
