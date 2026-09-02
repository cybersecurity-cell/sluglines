/**
 * Provider-neutral model router. Feature code and tool contracts name a model
 * *class*, never a provider or a concrete model id — swapping a model, or a
 * provider, is a change to this file only.
 *
 * Copied as-is from the Sluglines-AI reference (Docs/DECISIONS.md D-65): this
 * file has no dependency on sluglines' schema, so there is nothing in it to
 * adapt.
 */

export type ModelClass = 'filter' | 'standard' | 'reasoning' | 'vision' | 'stt' | 'tts'

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface ModelRoute {
  model: string
  effort: Effort
  maxTokens: number
}

// Opus 5 across the board: the pilot's volume is a handful of calls per ride, so
// the cost delta over a cheaper class is negligible next to a wrong parse.
// `filter` runs at low effort because classification doesn't reward deliberation.
const ROUTES: Record<Exclude<ModelClass, 'stt' | 'tts'>, ModelRoute> = {
  filter: { model: 'claude-opus-5', effort: 'low', maxTokens: 1024 },
  standard: { model: 'claude-opus-5', effort: 'medium', maxTokens: 4096 },
  reasoning: { model: 'claude-opus-5', effort: 'high', maxTokens: 8192 },
  vision: { model: 'claude-opus-5', effort: 'medium', maxTokens: 4096 },
}

export function resolveModel(modelClass: Exclude<ModelClass, 'stt' | 'tts'>): ModelRoute {
  return ROUTES[modelClass]
}

// Speech classes deliberately resolve to a non-API provider: the browser's
// SpeechRecognition/SpeechSynthesis need no credentials and no per-call spend.
// sluglines has no voice UI yet (Docs/DECISIONS.md D-65, Option A); this is kept
// for parity with the reference contract so a future voice slice has a router
// to extend rather than invent.
export type SpeechProvider = 'browser'

export function resolveSpeech(modelClass: 'stt' | 'tts'): SpeechProvider {
  void modelClass
  return 'browser'
}
