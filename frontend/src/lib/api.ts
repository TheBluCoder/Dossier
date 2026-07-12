import type {
  ActiveInvestigation,
  CaseBriefing,
  CaseDocket,
  Evidence,
  Investigation,
  Leaderboard,
  Message,
  ProfileWithHistory,
  Resolution,
  Suspect,
  UserProfile,
} from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// The auth provider registers how to fetch a bearer token (Clerk JWT or dev token).
let tokenProvider: () => Promise<string | null> = async () => 'dev'
export function setTokenProvider(fn: () => Promise<string | null>) {
  tokenProvider = fn
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenProvider()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export const api = {
  getMe: () => request<UserProfile>('/api/me'),
  getProfile: () => request<ProfileWithHistory>('/api/profile'),
  getLeaderboard: () => request<Leaderboard>('/api/leaderboard'),

  listCases: () => request<CaseDocket>('/api/cases'),
  getCaseBriefing: (caseId: string) => request<CaseBriefing>(`/api/cases/${caseId}`),

  createInvestigation: (case_id: string) =>
    request<Investigation>('/api/investigations', {
      method: 'POST',
      body: JSON.stringify({ case_id }),
    }),
  getInvestigation: (id: string) => request<Investigation>(`/api/investigations/${id}`),
  listActiveInvestigations: () => request<ActiveInvestigation[]>('/api/investigations/active'),
  updateNotes: (id: string, notes: string) =>
    request<{ ok: boolean }>(`/api/investigations/${id}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),

  listSuspects: (id: string) => request<Suspect[]>(`/api/investigations/${id}/suspects`),
  listEvidence: (id: string) => request<Evidence[]>(`/api/investigations/${id}/evidence`),
  reviewEvidence: (id: string, evidenceId: string) =>
    request<{ ok: boolean }>(`/api/investigations/${id}/evidence/${evidenceId}/review`, {
      method: 'POST',
    }),

  getMessages: (id: string, suspectId: string) =>
    request<Message[]>(`/api/investigations/${id}/suspects/${suspectId}/messages`),
  getVoiceToken: (id: string, suspectId: string) =>
    request<{ token: string }>(`/api/audio/speech-engine/token/${id}/${suspectId}`, {
      method: 'POST',
    }),

  submitVerdict: (
    id: string,
    verdict: { accused_id: string; motive: string; explanation: string; evidence_ids: string[] },
  ) =>
    request<Resolution>(`/api/investigations/${id}/verdict`, {
      method: 'POST',
      body: JSON.stringify(verdict),
    }),
  getResolution: (id: string) => request<Resolution>(`/api/investigations/${id}/resolution`),
}

export interface StreamHandlers {
  onToken: (text: string) => void
  onMeta: (message: Message) => void
  onError: (detail: string) => void
}

/** POST a player message; the reply arrives as Server-Sent Events. */
export async function streamMessage(
  investigationId: string,
  suspectId: string,
  body: { content: string; input_type: 'text' | 'voice'; evidence_id?: string | null },
  handlers: StreamHandlers,
): Promise<void> {
  const token = await tokenProvider()
  const res = await fetch(
    `${API_URL}/api/investigations/${investigationId}/suspects/${suspectId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    handlers.onError(err.detail ?? 'Request failed')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const event = raw.match(/^event: (.+)$/m)?.[1]
      const data = raw.match(/^data: (.+)$/m)?.[1]
      if (!event || !data) continue
      const parsed = JSON.parse(data)
      if (event === 'token') handlers.onToken(parsed.text)
      else if (event === 'meta') handlers.onMeta(parsed)
      else if (event === 'error') handlers.onError(parsed.detail)
    }
  }
}

/** Speak a stored suspect message via ElevenLabs; returns a playable object URL.
 * The backend synthesizes from the persisted message (with its emotion/delivery),
 * so no free-form text ever reaches the TTS provider. */
export async function synthesizeSpeech(messageId: string): Promise<string> {
  const token = await tokenProvider()
  const res = await fetch(`${API_URL}/api/audio/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message_id: messageId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Speech synthesis failed')
  }
  return URL.createObjectURL(await res.blob())
}
