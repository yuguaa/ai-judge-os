/**
 * 全局状态：配置、引擎状态、判分记录、调试对话
 */
import { create } from 'zustand'
import type {
  AppConfig,
  ChatMessage,
  EngineState,
  JudgeRecord,
  PermissionStatus
} from '@shared/types'
import { ipc } from './ipc'

interface AppState {
  config: AppConfig | null
  perms: PermissionStatus | null
  engineState: EngineState
  stateMessage: string
  progress: { done: number; total: number }
  records: JudgeRecord[]
  chat: ChatMessage[]
  chatBusy: boolean

  loadInitial: () => Promise<void>
  saveConfig: (next: AppConfig) => Promise<void>
  setEngineState: (state: EngineState, message?: string) => void
  setProgress: (done: number, total: number) => void
  appendRecord: (record: JudgeRecord) => void
  pushChat: (message: ChatMessage) => void
  setChatBusy: (busy: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  config: null,
  perms: null,
  engineState: 'idle',
  stateMessage: '',
  progress: { done: 0, total: 0 },
  records: [],
  chat: [],
  chatBusy: false,

  loadInitial: async () => {
    const [config, perms] = await Promise.all([ipc.getConfig(), ipc.checkPerms()])
    set({ config, perms })
  },

  saveConfig: async (next) => {
    set({ config: next })
    await ipc.setConfig(next)
  },

  setEngineState: (state, message) => set({ engineState: state, stateMessage: message ?? '' }),

  setProgress: (done, total) => set({ progress: { done, total } }),

  appendRecord: (record) => set((s) => ({ records: [record, ...s.records] })),

  pushChat: (message) => set((s) => ({ chat: [...s.chat, message] })),

  setChatBusy: (busy) => set({ chatBusy: busy })
}))
