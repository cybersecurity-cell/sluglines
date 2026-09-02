import type { SupabaseClient } from '@supabase/supabase-js'
import { TOOLS_BY_NAME, type ToolContext } from './tools.ts'

export type RiskTier = 'R0' | 'R1' | 'R2' | 'R3'

// The trusted half of every tool call. Built from the Supabase session on the
// server; never from anything the model emitted. Tools receive the ids from
// here, so a tool call can only ever act as the authenticated caller.
export interface IntentEnvelope {
  memberId: string
  locationId: string
  role: 'member' | 'moderator'
  channel: 'web_text' | 'web_voice'
  traceId: string
}

// Per-task ceilings from the agent runtime. Mutated across the loop, so a
// model that keeps calling tools runs out of budget rather than running forever.
export interface TaskBudget {
  toolCallsRemaining: number
  deadlineMs: number
}

export interface GateOutcome {
  decision: 'ALLOW' | 'DENY'
  // Fed back to the model as the tool result either way: a denial it can read is
  // a denial it can adapt to, whereas a thrown error ends the turn.
  payload: unknown
  denyReason?: string
}

// This slice's ceiling. Raising this is a deliberate, reviewed change — issue
// #56 (and every open decision behind it) assumes the agent cannot change ride
// state, and this constant is where that holds.
const MAX_TIER_THIS_PHASE: RiskTier = 'R1'
const TIER_ORDER: RiskTier[] = ['R0', 'R1', 'R2', 'R3']

function exceedsPhaseTier(tier: RiskTier): boolean {
  return TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(MAX_TIER_THIS_PHASE)
}

function deny(reason: string): GateOutcome {
  return { decision: 'DENY', payload: { error: reason }, denyReason: reason }
}

/**
 * issue #8 fix. The original gate discarded the result of the
 * `agent_tool_calls` insert (`await audit.from(...).insert(...)`, result never
 * read), so a failed audit write and a successful one were indistinguishable —
 * a tool call could execute and return data to the model with no record it
 * ever happened. This now checks `{ error }`, logs it, and — the part that
 * actually closes the hole — downgrades an ALLOW to a DENY when its own audit
 * row failed to write. Every tool in this catalog is read-only (R0/R1 only;
 * see tools.ts), so downgrading loses no committed state; what it stops is an
 * unaudited result reaching the model. A DENY whose audit write also fails is
 * left as a DENY: the call was already refused, so there is nothing to hide by
 * failing to log it, only a logging outage to report.
 */
async function recordToolCall(
  audit: SupabaseClient,
  row: {
    trace_id: string
    tool_name: string
    risk_tier: RiskTier
    arguments: Record<string, unknown>
    decision: 'ALLOW' | 'DENY'
    deny_reason: string | null
    result_summary: string
    latency_ms: number
  }
): Promise<GateOutcome | null> {
  const { error } = await audit.from('agent_tool_calls').insert(row)
  if (!error) return null

  console.error(
    `agent_tool_calls insert failed for trace ${row.trace_id}, tool ${row.tool_name}: ${error.message}`
  )

  if (row.decision === 'DENY') return null

  return deny('This action could not be safely recorded and is being denied rather than returned unaudited.')
}

export async function callThroughGate(
  toolName: string,
  rawArgs: unknown,
  env: IntentEnvelope,
  budget: TaskBudget,
  supabase: SupabaseClient,
  audit: SupabaseClient
): Promise<GateOutcome> {
  const startedAt = Date.now()
  const tool = TOOLS_BY_NAME.get(toolName)
  const outcome = await evaluate()

  // Log every decision, allow or deny, before returning. A gate decision that
  // isn't recorded may as well not have been made — and per the #8 fix above,
  // one that fails to record is no longer treated as the decision it was.
  const downgraded = await recordToolCall(audit, {
    trace_id: env.traceId,
    tool_name: toolName,
    risk_tier: tool?.riskTier ?? 'R3',
    arguments: sanitizeArgs(rawArgs),
    decision: outcome.decision,
    deny_reason: outcome.denyReason ?? null,
    result_summary: summarize(outcome.payload),
    latency_ms: Date.now() - startedAt,
  })

  return downgraded ?? outcome

  async function evaluate(): Promise<GateOutcome> {
    // 1. Known tool.
    if (!tool) return deny(`Unknown tool "${toolName}".`)

    // 2. Risk tier — checked before anything else about the call, so an R2/R3
    //    name is refused on tier grounds even if its arguments are well-formed.
    if (exceedsPhaseTier(tool.riskTier)) {
      return deny(
        `Tool "${toolName}" is tier ${tool.riskTier}; only ${MAX_TIER_THIS_PHASE} and below are enabled. Ride state cannot be changed by the assistant — offer the user a pre-filled form instead.`
      )
    }
    if (!tool.implemented || !tool.run) {
      return deny(`Tool "${toolName}" is not implemented.`)
    }

    // 3. Budgets. Checked before the kill switch so a runaway loop can't spend
    //    a database round trip per iteration.
    if (budget.toolCallsRemaining <= 0) return deny('Tool call budget exhausted for this task.')
    if (Date.now() > budget.deadlineMs) return deny('Time budget exhausted for this task.')

    // 4. Kill switches. The global switch and the per-tool switch are checked
    //    separately and deliberately: ai_skill_enabled() fails closed, so it
    //    returns false both for "this tool is switched off" and for "this tool
    //    has no switch row at all". Collapsing the two would make a disabled
    //    per-tool switch inert whenever the global switch is still on — issue
    //    #3's key-naming bug meant this never actually fired against a real
    //    tool name; the fixed seed in 0011 is what makes it reachable.
    const { data: globalOn, error: globalError } = await supabase.rpc('ai_skill_enabled', {
      p_skill_key: 'global',
    })
    if (globalError) return deny('Kill-switch check failed.')
    if (globalOn !== true) return deny('The assistant is currently disabled.')

    // A tool with no row of its own is governed by the global switch alone; only
    // an explicit `enabled = false` row disables one tool individually.
    const { data: toolSwitch, error: switchError } = await supabase
      .from('ai_kill_switches')
      .select('enabled')
      .eq('key', `skills.${toolName}`)
      .maybeSingle()
    if (switchError) return deny('Kill-switch check failed.')
    if (toolSwitch && (toolSwitch as { enabled: boolean }).enabled === false) {
      return deny(`Tool "${toolName}" is temporarily disabled.`)
    }

    // 5. Schema parse. Strict objects, no coercion — free text never becomes a
    //    uuid or an enum by being parsed leniently.
    const parsed = tool.schema.safeParse(rawArgs ?? {})
    if (!parsed.success) {
      return deny(`Invalid arguments for "${toolName}": ${parsed.error.issues.map((i) => i.message).join('; ')}`)
    }

    // 6. Execute with the envelope's identity, not the model's claim. RLS is the
    //    backstop: `supabase` is the caller's session client, so even a tool bug
    //    cannot read another member's rows.
    budget.toolCallsRemaining -= 1
    const ctx: ToolContext = {
      supabase,
      memberId: env.memberId,
      locationId: env.locationId,
    }

    try {
      const result = await tool.run!(parsed.data as Record<string, unknown>, ctx)
      return { decision: 'ALLOW', payload: result }
    } catch (err) {
      return deny(`Tool "${toolName}" failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }
}

function sanitizeArgs(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object') return { _raw: String(raw).slice(0, 500) }
  return JSON.parse(JSON.stringify(raw, (_k, v) => (typeof v === 'string' ? v.slice(0, 500) : v)))
}

function summarize(payload: unknown): string {
  return JSON.stringify(payload ?? null).slice(0, 1000)
}
