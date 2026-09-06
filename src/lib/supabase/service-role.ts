import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ServiceRoleKeyMissingError } from './service'

/**
 * The service-role client — bypasses RLS entirely. `src/lib/ai/agent.ts` and
 * `src/lib/ai/tool-gate.ts` use it as the *only* writer for `agent_traces` and
 * `agent_tool_calls` (0011's migration ships neither table an insert policy for
 * any authenticated role), so a member can never forge or suppress their own
 * audit trail. Nothing else in this repo should reach for this client: every
 * other write goes through a SECURITY DEFINER function and the caller's own
 * session, which is the whole point of the default-deny posture.
 *
 * No cookie binding, unlike `./server.ts` — the service key carries its own
 * authority and is never tied to a member's session.
 *
 * A missing key is the same typed error `./service.ts` throws (issue #144):
 * two factories exist because the AI writer wants `autoRefreshToken: false`
 * and nothing else does, but "the key is not set" is one condition and it
 * should read the same wherever it is caught.
 */
export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new ServiceRoleKeyMissingError()
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
