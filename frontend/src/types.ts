export interface CaseSummary {
  id: string
  title: string
  crime_type: string
  difficulty: number
  summary: string
  status: string
  suspect_count: number
}

export interface Victim {
  name: string
  age: number
  occupation: string
  background: string
}

export interface CrimeScene {
  location: string
  time: string
  description: string
}

export interface TimelineEntry {
  time: string
  event: string
}

export interface Suspect {
  id: string
  name: string
  age: number
  occupation: string
  relationship: string
  background: string
  alibi: string
  personality: string
  voice_id: string | null
  state?: SuspectState
}

export interface SuspectState {
  trust: number
  patience: number
  conversation_ended: boolean
}

export interface Evidence {
  id: string
  title: string
  type: string
  description: string
  timestamp: string | null
  related_suspects: string[]
  media_url: string | null
  reviewed?: boolean
}

export interface CaseBriefing extends Omit<CaseSummary, 'suspect_count'> {
  victim: Victim
  crime_scene: CrimeScene
  public_timeline: TimelineEntry[]
  suspects: Suspect[]
  evidence: Evidence[]
}

export interface Investigation {
  id: string
  case_id: string
  status: 'in_progress' | 'solved' | 'failed'
  notes: string
  reviewed_evidence: string[]
  suspect_state: Record<string, SuspectState>
  verdict_submitted: boolean
  created_at: string
  case?: CaseBriefing
}

export interface Delivery {
  pace: string
  hesitation: boolean
  confidence: number
}

export interface Message {
  id: string
  suspect_id: string
  player_message: string
  input_type: 'text' | 'voice'
  evidence_id: string | null
  response: string
  emotion: string
  emotion_intensity: number
  delivery: Delivery
  trust_after: number
  patience_after: number
  conversation_ended: boolean
  created_at: string
}

export interface Resolution {
  correct: boolean
  accused_id: string
  analysis: string
  culprit: Suspect | null
  motive: string
  explanation: string
  canonical_timeline: TimelineEntry[]
  suspect_secrets: Record<string, string>
  key_clues: string[]
}
