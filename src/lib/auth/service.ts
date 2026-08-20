import { safeRedirectPath, validateSignUp, type SignUpInput } from './validation.ts'

export interface AuthResult {
  error: unknown | null
}

export interface RegistrationRequest {
  email: string
  password: string
  displayName: string
  emailRedirectTo: string
}

export interface AuthGateway {
  signUp(request: RegistrationRequest): Promise<AuthResult>
  signInWithPassword(request: { email: string; password: string }): Promise<AuthResult>
  resetPasswordForEmail(request: { email: string; redirectTo: string }): Promise<AuthResult>
  updatePassword(password: string): Promise<AuthResult>
  signOut(): Promise<AuthResult>
}

export type ActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; message: string; errors?: Record<string, string> }

function emailCallback(origin: string, next: string): string {
  const url = new URL('/auth/callback', origin)
  url.searchParams.set('next', safeRedirectPath(next))
  return url.toString()
}

export function createAuthService(gateway: AuthGateway) {
  return {
    async register(input: SignUpInput, origin: string): Promise<ActionResult> {
      const validation = validateSignUp(input)
      if (!validation.ok) return { ok: false, message: 'Review the highlighted fields.', errors: validation.errors }

      const { email, password, displayName } = validation.value
      const result = await gateway.signUp({
        email,
        password,
        displayName,
        emailRedirectTo: emailCallback(origin, '/account'),
      })
      if (result.error) return { ok: false, message: 'Unable to create an account right now.' }
      return { ok: true, message: 'Check your email to verify your account.' }
    },

    async signIn(emailValue: unknown, passwordValue: unknown, next: unknown): Promise<ActionResult> {
      const email = typeof emailValue === 'string' ? emailValue.trim().toLocaleLowerCase('en-US') : ''
      const password = typeof passwordValue === 'string' ? passwordValue : ''
      if (!email || !password) return { ok: false, message: 'Enter your email and password.' }

      const result = await gateway.signInWithPassword({ email, password })
      if (result.error) return { ok: false, message: 'Email or password is incorrect.' }
      return { ok: true, redirectTo: safeRedirectPath(next) }
    },

    async requestPasswordReset(emailValue: unknown, origin: string): Promise<ActionResult> {
      const email = typeof emailValue === 'string' ? emailValue.trim().toLocaleLowerCase('en-US') : ''
      if (email) {
        await gateway.resetPasswordForEmail({
          email,
          redirectTo: emailCallback(origin, '/auth/reset-password'),
        })
      }
      return { ok: true, message: 'If that address has an account, a reset link is on its way.' }
    },

    async updatePassword(passwordValue: unknown): Promise<ActionResult> {
      const password = typeof passwordValue === 'string' ? passwordValue : ''
      if (password.length < 12) return { ok: false, message: 'Use at least 12 characters.' }
      const result = await gateway.updatePassword(password)
      if (result.error) return { ok: false, message: 'Unable to update your password right now.' }
      return { ok: true, message: 'Your password has been updated.' }
    },

    async signOut(): Promise<ActionResult> {
      const result = await gateway.signOut()
      if (result.error) return { ok: false, message: 'Unable to sign out right now.' }
      return { ok: true, redirectTo: '/' }
    },
  }
}
