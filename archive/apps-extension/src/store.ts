/**
 * Zustand stores shared across popup, sidepanel, and options pages.
 * Each surface gets its own React tree, so the store is plain in-memory —
 * persistence lives in @plasmohq/storage via the auth module.
 */

import { create } from "zustand"
import type { FunnelUser } from "./auth"

export interface AuditScore {
  overall: number
  copy: number
  design: number
  cta: number
  speed: number
  improvements: string[]
}

interface AuditState {
  url: string | null
  loading: boolean
  score: AuditScore | null
  error: string | null
  setLoading: (url: string) => void
  setScore: (score: AuditScore) => void
  setError: (error: string) => void
  reset: () => void
}

export const useAudit = create<AuditState>((set) => ({
  url: null,
  loading: false,
  score: null,
  error: null,
  setLoading: (url) => set({ url, loading: true, score: null, error: null }),
  setScore: (score) => set({ score, loading: false, error: null }),
  setError: (error) => set({ error, loading: false }),
  reset: () => set({ url: null, loading: false, score: null, error: null }),
}))

interface SessionState {
  user: FunnelUser | null
  setUser: (user: FunnelUser | null) => void
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))

export interface InboxLead {
  id: string
  name: string
  email: string
  source: string
  capturedAt: string
  funnelId: string
  funnelName: string
  unread: boolean
}

interface InboxState {
  leads: InboxLead[]
  loading: boolean
  setLeads: (leads: InboxLead[]) => void
  markRead: (id: string) => void
  setLoading: (loading: boolean) => void
}

export const useInbox = create<InboxState>((set) => ({
  leads: [],
  loading: false,
  setLeads: (leads) => set({ leads, loading: false }),
  markRead: (id) =>
    set((state) => ({
      leads: state.leads.map((l) => (l.id === id ? { ...l, unread: false } : l)),
    })),
  setLoading: (loading) => set({ loading }),
}))
