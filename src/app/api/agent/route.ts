/**
 * POST /api/agent — the AI runtime transplant (Docs/DECISIONS.md D-65).
 *
 * The `IntentEnvelope` `runAgentTurn` acts under is built entirely from the
 * server-side session: `memberId`, `locationId`, and `role` all come from the
 * authenticated Supabase session and the caller's own `members` row, never
 * from the request body. The request body carries exactly one thing the
 * client is trusted to say: the text of the message. This is the same
 * discipline `offer-transition-route.ts` documents for the M3 write path — the
 * database (here, the session + the `members` table) decides who is calling,
 * never the request.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server.ts'
import { createServiceRoleClient } from '@/lib/supabase/service-role.ts'
import { runAgentTurn } from '@/lib/ai/agent.ts'

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  channel: z.enum(['web_text', 'web_voice']).default('web_text'),
})

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_argument' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError !== null || authData.user === null) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, role, location_id')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (memberError !== null || member === null) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { role, location_id: locationId } = member as { role: string; location_id: string | null }

  if (locationId === null) {
    // The tool catalog is scoped to the member's home spot (tools.ts); with
    // none on file there is nothing for it to read. Refused before any model
    // call, the same way the kill switch and the #56 capacity caps are.
    return NextResponse.json({ error: 'no_home_spot' }, { status: 422 })
  }

  const result = await runAgentTurn({
    userMessage: parsed.data.message,
    env: {
      memberId: (member as { id: string }).id,
      locationId,
      role: role === 'moderator' ? 'moderator' : 'member',
      channel: parsed.data.channel,
    },
    supabase,
    // Traces and tool-call audit rows are written with the service role so a
    // member can never forge or suppress their own audit trail — 0011 ships
    // agent_traces and agent_tool_calls with no insert policy for any
    // authenticated role.
    audit: createServiceRoleClient(),
  })

  return NextResponse.json(result)
}
