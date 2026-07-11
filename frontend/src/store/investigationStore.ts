import { create } from 'zustand'
import { api } from '../lib/api'
import type { Evidence, Investigation, Suspect } from '../types'

interface InvestigationStore {
  investigation: Investigation | null
  suspects: Suspect[]
  evidence: Evidence[]
  loading: boolean
  error: string | null

  load: (id: string) => Promise<void>
  refreshSuspects: () => Promise<void>
  markEvidenceReviewed: (evidenceId: string) => Promise<void>
  saveNotes: (notes: string) => Promise<void>
  clear: () => void
}

export const useInvestigationStore = create<InvestigationStore>((set, get) => ({
  investigation: null,
  suspects: [],
  evidence: [],
  loading: false,
  error: null,

  load: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const [investigation, suspects, evidence] = await Promise.all([
        api.getInvestigation(id),
        api.listSuspects(id),
        api.listEvidence(id),
      ])
      set({ investigation, suspects, evidence, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  refreshSuspects: async () => {
    const inv = get().investigation
    if (!inv) return
    set({ suspects: await api.listSuspects(inv.id) })
  },

  markEvidenceReviewed: async (evidenceId: string) => {
    const inv = get().investigation
    if (!inv) return
    set({
      evidence: get().evidence.map((e) => (e.id === evidenceId ? { ...e, reviewed: true } : e)),
    })
    await api.reviewEvidence(inv.id, evidenceId)
  },

  saveNotes: async (notes: string) => {
    const inv = get().investigation
    if (!inv) return
    set({ investigation: { ...inv, notes } })
    await api.updateNotes(inv.id, notes)
  },

  clear: () => set({ investigation: null, suspects: [], evidence: [], error: null }),
}))
