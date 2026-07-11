import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Meter from '../components/Meter'
import { api, streamMessage, synthesizeSpeech } from '../lib/api'
import { useInvestigationStore } from '../store/investigationStore'
import type { Message } from '../types'

// Browser speech recognition (Chrome/Edge). Text input is always the fallback.
const SpeechRecognitionImpl =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

interface TranscriptEntry {
  role: 'player' | 'suspect'
  text: string
  emotion?: string
  evidenceId?: string | null
  streaming?: boolean
}

export default function Interrogation() {
  const { id, suspectId } = useParams<{ id: string; suspectId: string }>()
  const { investigation, suspects, evidence, load, refreshSuspects } = useInvestigationStore()
  const suspect = suspects.find((s) => s.id === suspectId)

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [input, setInput] = useState('')
  const [selectedEvidence, setSelectedEvidence] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (id && !investigation) load(id)
  }, [id, investigation, load])

  useEffect(() => {
    if (!id || !suspectId) return
    api.getMessages(id, suspectId).then((messages) => {
      const entries: TranscriptEntry[] = []
      for (const m of messages) {
        entries.push({ role: 'player', text: m.player_message, evidenceId: m.evidence_id })
        entries.push({ role: 'suspect', text: m.response, emotion: m.emotion })
      }
      setTranscript(entries)
    })
  }, [id, suspectId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const playVoice = async (text: string) => {
    if (!voiceEnabled || !suspect) return
    try {
      const url = await synthesizeSpeech(text, suspect.voice_id)
      audioRef.current?.pause()
      audioRef.current = new Audio(url)
      await audioRef.current.play()
    } catch {
      // Voice is a garnish — never block the game on TTS errors.
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
              text: message.response,
              emotion: message.emotion,
            }
            return copy
          })
          refreshSuspects()
          playVoice(message.response)
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

  const ended = suspect.state?.conversation_ended

  return (
    <div className="flex min-h-screen flex-col">
      <Header subtitle={`Interrogation — ${suspect.name}`} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-4">
        <div className="panel mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-xl text-stone-100">{suspect.name}</p>
            <p className="text-xs text-stone-500">
              {suspect.age} · {suspect.occupation} · {suspect.relationship}
            </p>
          </div>
          <div className="flex gap-4">
            <Meter label="Trust" value={suspect.state?.trust ?? 50} />
            <Meter label="Patience" value={suspect.state?.patience ?? 100} />
          </div>
          <button
            onClick={() => setVoiceEnabled((v) => !v)}
            className="btn-ghost px-2 py-1 text-xs"
            title="Toggle suspect voice playback"
          >
            {voiceEnabled ? '🔊 Voice on' : '🔇 Voice off'}
          </button>
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
                    📎 Presented: {evidence.find((e) => e.id === entry.evidenceId)?.title ?? 'evidence'}
                  </p>
                )}
                <p className="whitespace-pre-wrap">
                  {entry.text}
                  {entry.streaming && <span className="animate-pulse text-gold-400">▋</span>}
                </p>
                {entry.emotion && entry.emotion !== 'neutral' && (
                  <p className="mt-1 text-xs italic text-stone-500">({entry.emotion})</p>
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
                    📎 {ev.title}
                  </option>
                ))}
              </select>
              <Link
                to={`/investigations/${investigation.id}`}
                className="btn-ghost ml-auto px-3 py-1 text-xs"
              >
                ← Case file
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
                {recording ? '⏺' : '🎙'}
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
