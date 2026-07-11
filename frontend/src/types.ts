export interface CaseSummary {
  id: string
  title: string
  crime_type: string
  difficulty: number
  summary: string
  status: string
  suspect_count: number
  evidence_count: number
  failure_count: number
  reward_rs: number
}

export interface CaseDocket {
  entries: CaseSummary[]
  pool_size: number
  generating: boolean
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

export interface CaseBriefing
  extends Omit<CaseSummary, 'suspect_count' | 'evidence_count' | 'failure_count' | 'reward_rs'> {
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

export interface Tier {
  name: string
  min_rs: number
  next_tier: string | null
  next_tier_rs: number | null
}

export interface UserProfile {
  user_id: string
  name: string
  avatar_url: string | null
  reputation: number
  cases_solved: number
  cases_failed: number
  cases_total: number
  win_rate: number
  tier: Tier
  created_at: string
}

export interface ProfileWithHistory extends UserProfile {
  history: { case_title: string; status: 'solved' | 'failed'; completed_at: string | null }[]
}

export interface LeaderboardEntry extends UserProfile {
  rank: number
}

export interface Leaderboard {
  entries: LeaderboardEntry[]
  me: LeaderboardEntry
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
  reputation_change?: number
}
