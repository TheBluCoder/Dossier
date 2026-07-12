import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useConversation } from '@elevenlabs/react'
import {
  ArrowLeft,
  MessageCircle,
  Mic,
  MicOff,
  Paperclip,
  Volume2,
  VolumeX,
} from 'lucide-react'
import Header from '../components/Header'
import Meter from '../components/Meter'
import { api, streamMessage, synthesizeSpeech } from '../lib/api'
import { conversationalTime } from '../lib/time'
import { useInvestigationStore } from '../store/investigationStore'
import type { Message } from '../types'

// Browser speech recognition (Chrome/Edge). Text input is always the fallback.
const SpeechRecognitionImpl =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

type Mode = 'select' | 'text' | 'voice'

interface TranscriptEntry {
  role: 'player' | 'suspect'
  text: string
  emotion?: string
  evidenceId?: string | null
  streaming?: boolean
  trustDelta?: number
  patienceDelta?: number
}

function stripAudioTags(text: string): string {
  return text.replace(/^(?:\s*\[[^\]]+\])+\s*/, '').trimStart()
}

export default function Interrogation() {
  const { id, suspectId } = useParams<{ id: string; suspectId: string }>()
  const { investigation, suspects, evidence, load, refreshSuspects } = useInvestigationStore()
  const suspect = suspects.find((s) => s.id === suspectId)
  const ended = suspect?.state?.conversation_ended

  const [mode, setMode] = useState<Mode>('select')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [input, setInput] = useState('')
  const [selectedEvidence, setSelectedEvidence] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const endVoiceSessionRef = useRef<() => Promise<void>>(async () => {})
  const modeRef = useRef<Mode>(mode)
  modeRef.current = mode
  const conversation = useConversation({
    onMessage: (message: any) => {
      const rawText = message.message ?? message.user_transcript ?? message.agent_response
      const source = message.source ?? message.role
      if (!rawText || !['user', 'ai', 'agent'].includes(source)) return
      const role: 'player' | 'suspect' = source === 'user' ? 'player' : 'suspect'
      const text = role === 'suspect' ? conversationalTime(stripAudioTags(rawText)) : rawText
      setTranscript((current) => {
        const last = current[current.length - 1]
        return last?.role === role && last.text === text ? current : [...current, { role, text }]
      })
      if (role === 'suspect') refreshSuspects()
    },
    onError: (problem: any) => {
      if (import.meta.env.DEV) console.error('Voice conversation error:', problem)
      setError('Voice connection was interrupted. Please try again or use text chat.')
    },
  })
  endVoiceSessionRef.current = async () => {
    if (conversation.status !== 'disconnected') await conversation.endSession()
  }

  const leaveVoiceDialog = async () => {
    try {
      await endVoiceSessionRef.current()
    } catch (problem) {
      if (import.meta.env.DEV) console.error('Could not close voice session cleanly:', problem)
    }
  }

  const startVoiceDialog = async () => {
    if (!id || !suspectId) return
    setError(null)
    setMode('voice')
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const { token } = await api.getVoiceToken(id, suspectId)
      await conversation.startSession({ conversationToken: token })
    } catch (problem) {
      if (import.meta.env.DEV) console.error('Could not start voice dialog:', problem)
      setError('Voice dialog is unavailable right now. Please try again or use text chat.')
    }
  }

  useEffect(() => {
    if (id && !investigation) load(id)
  }, [id, investigation, load])

  useEffect(() => {
    if (!id || !suspectId) return
    api.getMessages(id, suspectId).then((messages) => {
      const entries: TranscriptEntry[] = []
      for (const m of messages) {
        entries.push({ role: 'player', text: m.player_message, evidenceId: m.evidence_id })
        entries.push({ role: 'suspect', text: conversationalTime(m.response), emotion: m.emotion })
      }
      setTranscript(entries)
    })
  }, [id, suspectId])

  useEffect(() => {
    if (mode === 'text') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, mode])

  // Tear down audio + microphone whenever we leave the room.
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      recognitionRef.current?.stop()
      void endVoiceSessionRef.current()
    }
  }, [])

  useEffect(() => {
    if (ended && mode === 'voice') void leaveVoiceDialog()
  }, [ended, mode])

  const stopVoice = () => {
    audioRef.current?.pause()
    audioRef.current = null
    setSpeaking(false)
  }

  const playVoice = async (message: Message) => {
    if (!suspect) return
    // In voice mode the spoken reply is the whole point; text mode respects the toggle.
    if (modeRef.current === 'text' && !voiceEnabled) return
    try {
      const url = await synthesizeSpeech(message.id)
      stopVoice()
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onplay = () => setSpeaking(true)
      audio.onended = () => setSpeaking(false)
      audio.onpause = () => setSpeaking(false)
      await audio.play()
    } catch {
      // Voice is a garnish — never block the game on TTS errors.
      setSpeaking(false)
    }
  }

  const send = async (content: string, inputType: 'text' | 'voice') => {
    if (!id || !suspectId || !content.trim() || busy) return
    setBusy(true)
    setError(null)
    const evidenceId = selectedEvidence || null
    setInput('')
    setSelectedEvidence('')
    setTranscript((t) => [
      ...t,
      { role: 'player', text: content, evidenceId },
      { role: 'suspect', text: '', streaming: true },
    ])

    await streamMessage(
      id,
      suspectId,
      { content, input_type: inputType, evidence_id: evidenceId },
      {
        onToken: (text) =>
          setTranscript((t) => {
            const copy = [...t]
            const last = copy[copy.length - 1]
            copy[copy.length - 1] = { ...last, text: last.text + text }
            return copy
          }),
        onMeta: (message: Message) => {
          setTranscript((t) => {
            const copy = [...t]
            copy[copy.length - 1] = {
              role: 'suspect',
              text: conversationalTime(message.response),
              emotion: message.emotion,
              trustDelta: message.trust_after - message.trust_before,
              patienceDelta: message.patience_after - message.patience_before,
            }
            return copy
          })
          refreshSuspects()
          playVoice(message)
        },
        onError: (detail) => {
          setError(detail)
          setTranscript((t) => t.slice(0, -2))
        },
      },
    )
    setBusy(false)
  }

  const toggleRecording = () => {
    if (!SpeechRecognitionImpl) {
      setError('Speech recognition is not supported in this browser — type instead.')
      return
    }
    if (recording) {
      recognitionRef.current?.stop()
      return
    }
    // Interrupt the suspect if they are mid-sentence when you cut in.
    stopVoice()
    const recognition = new SpeechRecognitionImpl()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript
      send(text, 'voice')
    }
    recognition.onend = () => setRecording(false)
    recognition.onerror = () => {
      setRecording(false)
      setError('Microphone failed — type your question instead.')
    }
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  if (!investigation || !suspect)
    return <div className="p-10 text-center text-stone-500">Loading interrogation room…</div>

  const initials = suspect.name.split(' ').map((p) => p[0]).slice(0, 2).join('')
  const lastSuspectLine = [...transcript].reverse().find((e) => e.role === 'suspect')
  const lastPlayerLine = [...transcript].reverse().find((e) => e.role === 'player')

  const meterRow = (
    <div className="flex gap-4">
      <Meter label="Trust" value={suspect.state?.trust ?? 50} />
      <Meter label="Patience" value={suspect.state?.patience ?? 100} />
    </div>
  )

  // ── Mode chooser ─────────────────────────────────────────────
  if (mode === 'select') {
    return (
      <div className="archive-page flex min-h-screen flex-col">
        <Header subtitle={`Interrogation — ${suspect.name}`} />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-10">
          <p className="text-[10px] font-bold uppercase tracking-[.3em] text-stone-600">
            How will you question
          </p>
          <h2 className="mt-2 font-display text-3xl text-stone-100">{suspect.name}?</h2>
          <div className="mt-10 grid w-full gap-5 sm:grid-cols-2">
            <button
              onClick={startVoiceDialog}
              className="panel group flex flex-col items-center gap-3 py-10 transition hover:border-gold-500"
            >
              <Mic aria-hidden="true" className="h-10 w-10 text-stone-300 transition-colors group-hover:text-gold-400" strokeWidth={1.5} />
              <span className="font-display text-xl text-stone-100">Voice Dialog</span>
              <span className="max-w-[16rem] text-center text-xs text-stone-500">
                Speak face to face. They talk back aloud — watch their composure.
              </span>
            </button>
            <button
              onClick={() => setMode('text')}
              className="panel group flex flex-col items-center gap-3 py-10 transition hover:border-gold-500"
            >
              <MessageCircle aria-hidden="true" className="h-10 w-10 text-stone-300 transition-colors group-hover:text-gold-400" strokeWidth={1.5} />
              <span className="font-display text-xl text-stone-100">Text Chat</span>
              <span className="max-w-[16rem] text-center text-xs text-stone-500">
                Trade written questions. Precise, quotable, on the record.
              </span>
            </button>
          </div>
          <Link
            to={`/investigations/${investigation.id}`}
            className="btn-ghost mt-8 px-4 py-2 text-xs"
          >
            <ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />
            Back to the case
          </Link>
        </main>
      </div>
    )
  }

  // ── Voice dialog ─────────────────────────────────────────────
  if (mode === 'voice') {
    const status = ended
      ? `${suspect.name} has walked out.`
      : conversation.status === 'connecting'
        ? `${suspect.name} is thinking…`
        : conversation.isSpeaking
          ? `${suspect.name} is speaking…`
          : conversation.status === 'connected'
            ? 'Listening…'
            : 'Tap the mic to speak'
    return (
      <div className="archive-page flex min-h-screen flex-col">
        <Header subtitle={`Interrogation — ${suspect.name}`} />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 py-6">
          <div className="panel mb-6 flex w-full items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl text-stone-100">{suspect.name}</p>
              <p className="text-xs text-stone-500">
                {suspect.age} · {suspect.occupation} · {suspect.relationship}
              </p>
            </div>
            {meterRow}
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => conversation.setMuted(!conversation.isMuted)}
              disabled={ended}
              title={conversation.isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`voice-orb ${conversation.isSpeaking ? 'voice-orb-speaking' : 'voice-orb-quiet'}`}
            >
              {suspect.image_url ? (
                <img src={suspect.image_url} alt={`Portrait of ${suspect.name}`} />
              ) : (
                <span>{initials}</span>
              )}
            </button>

            <p
              className={`text-sm uppercase tracking-[.25em] ${
                conversation.isSpeaking ? 'text-green-400' : 'text-stone-500'
              }`}
            >
              {status}
            </p>

            <div className="min-h-[4.5rem] max-w-xl text-center">
              {lastSuspectLine?.text && (
                <p className="whitespace-pre-wrap font-serif text-base italic leading-7 text-stone-200">
                  “{lastSuspectLine.text}
                  {busy && <span className="animate-pulse text-green-400">▋</span>}”
                </p>
              )}
              {lastPlayerLine?.text && (
                <p className="mt-2 text-xs text-stone-600">You: {lastPlayerLine.text}</p>
              )}
            </div>
          </div>

          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

          {ended ? (
            <div className="panel mb-4 text-center text-red-400">
              {suspect.name} has ended the conversation for good.
              <Link
                to={`/investigations/${investigation.id}`}
                className="ml-2 text-gold-400 underline"
              >
                Back to the case
              </Link>
            </div>
          ) : (
            <div className="mb-4 flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                {evidence.length > 0 && (
                  <select
                    value={selectedEvidence}
                    onChange={(e) => setSelectedEvidence(e.target.value)}
                    className="input-noir w-52 text-xs"
                  >
                    <option value="">No evidence presented</option>
                    {evidence.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => conversation.setMuted(!conversation.isMuted)}
                  disabled={conversation.status !== 'connected'}
                  className="btn-gold flex h-14 w-14 items-center justify-center rounded-full text-xl"
                  title={conversation.isMuted ? 'Resume listening' : 'Mute microphone'}
                >
                  {conversation.isMuted ? <MicOff aria-hidden="true" className="h-5 w-5" /> : <Mic aria-hidden="true" className="h-5 w-5" />}
                </button>
              </div>
              {selectedEvidence && (
                <p className="text-xs text-gold-400">
                  <Paperclip aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
                  Presenting: {evidence.find((e) => e.id === selectedEvidence)?.title}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-4 border-t border-noir-700 pt-3 text-xs">
            <button onClick={() => { void leaveVoiceDialog(); setMode('text') }} className="btn-ghost px-3 py-1">
              <MessageCircle aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
              Switch to text
            </button>
            <Link
              to={`/investigations/${investigation.id}`}
              onClick={() => { void leaveVoiceDialog() }}
              className="btn-ghost px-3 py-1"
            >
              <ArrowLeft aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
              Case file
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // ── Text chat ────────────────────────────────────────────────
  return (
    <div className="archive-page flex min-h-screen flex-col">
      <Header subtitle={`Interrogation — ${suspect.name}`} />
      <main className="archive-sheet mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-4">
        <div className="panel mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-xl text-stone-100">{suspect.name}</p>
            <p className="text-xs text-stone-500">
              {suspect.age} · {suspect.occupation} · {suspect.relationship}
            </p>
          </div>
          {meterRow}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setVoiceEnabled((v) => !v)}
              className="btn-ghost px-2 py-1 text-xs"
              title="Toggle suspect voice playback"
            >
              {voiceEnabled ? <Volume2 aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" /> : <VolumeX aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />}
              {voiceEnabled ? 'Voice on' : 'Voice off'}
            </button>
            <button
              onClick={startVoiceDialog}
              className="btn-ghost px-2 py-1 text-xs"
              title="Switch to voice dialog"
            >
              <Mic aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
              Voice dialog
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pb-4">
          {transcript.length === 0 && (
            <p className="pt-8 text-center text-sm text-stone-600">
              {suspect.name} sits across the table, waiting.
            </p>
          )}
          {transcript.map((entry, i) => (
            <div key={i} className={`flex ${entry.role === 'player' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                  entry.role === 'player'
                    ? 'bg-gold-500/15 text-stone-100'
                    : 'bg-noir-800 text-stone-200'
                }`}
              >
                {entry.evidenceId && (
                  <p className="mb-1 text-xs text-gold-400">
                    <Paperclip aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
                    Presented: {evidence.find((e) => e.id === entry.evidenceId)?.title ?? 'evidence'}
                  </p>
                )}
                <p className="whitespace-pre-wrap">
                  {entry.text}
                  {entry.streaming && <span className="animate-pulse text-gold-400">▋</span>}
                </p>
                {((entry.emotion && entry.emotion !== 'neutral') ||
                  !!entry.trustDelta ||
                  !!entry.patienceDelta) && (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs italic text-stone-500">
                    {entry.emotion && entry.emotion !== 'neutral' && <span>({entry.emotion})</span>}
                    {!!entry.trustDelta && (
                      <span className={entry.trustDelta > 0 ? 'text-emerald-400/80' : 'text-red-400/80'}>
                        trust {entry.trustDelta > 0 ? '+' : ''}{entry.trustDelta}
                      </span>
                    )}
                    {!!entry.patienceDelta && (
                      <span className={entry.patienceDelta > 0 ? 'text-emerald-400/80' : 'text-red-400/80'}>
                        patience {entry.patienceDelta > 0 ? '+' : ''}{entry.patienceDelta}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

        {ended ? (
          <div className="panel text-center text-red-400">
            {suspect.name} has ended the conversation for good.
            <Link to={`/investigations/${investigation.id}`} className="ml-2 text-gold-400 underline">
              Back to the case
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input, 'text')
            }}
            className="space-y-2 border-t border-noir-700 pt-3"
          >
            <div className="flex gap-2">
              <select
                value={selectedEvidence}
                onChange={(e) => setSelectedEvidence(e.target.value)}
                className="input-noir w-52 text-xs"
              >
                <option value="">No evidence presented</option>
                {evidence.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
              <Link
                to={`/investigations/${investigation.id}`}
                className="btn-ghost ml-auto px-3 py-1 text-xs"
              >
                <ArrowLeft aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
                Case file
              </Link>
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={busy ? `${suspect.name} is thinking…` : 'Ask your question…'}
                disabled={busy}
                className="input-noir"
              />
              <button
                type="button"
                onClick={toggleRecording}
                disabled={busy}
                className={`btn-ghost px-3 ${recording ? 'animate-pulse border-red-500 text-red-400' : ''}`}
                title="Ask by voice"
              >
                {recording ? <MicOff aria-hidden="true" className="h-4 w-4" /> : <Mic aria-hidden="true" className="h-4 w-4" />}
              </button>
              <button type="submit" disabled={busy || !input.trim()} className="btn-gold">
                Ask
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
