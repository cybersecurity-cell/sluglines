import type { SupabaseClient } from '@supabase/supabase-js'

import type { AuthGateway, RegistrationRequest } from './service.ts'

export function createSupabaseAuthGateway(client: SupabaseClient): AuthGateway {
  return {
    async signUp(request: RegistrationRequest) {
      const { error } = await client.auth.signUp({
        email: request.email,
        password: request.password,
        options: {
          emailRedirectTo: request.emailRedirectTo,
          data: { display_name: request.displayName },
        },
      })
      return { error }
    },

    async signInWithPassword(request) {
      const { error } = await client.auth.signInWithPassword(request)
      return { error }
    },

    async resetPasswordForEmail(request) {
      const { error } = await client.auth.resetPasswordForEmail(request.email, {
        redirectTo: request.redirectTo,
      })
      return { error }
    },

    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password })
      return { error }
    },

    async signOut() {
      const { error } = await client.auth.signOut()
      return { error }
    },
  }
}
