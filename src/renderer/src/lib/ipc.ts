/**
 * IPC 类型化封装：渲染层唯一的主进程调用入口
 */
import type {
  AppConfig,
  ChatMessage,
  EngineEvent,
  JudgeRecord,
  PermissionStatus,
  Region
} from '@shared/types'

export type RegionKind = 'answer' | 'action' | 'process'
export type EngineMode = 'manual' | 'auto'
export type PanelName = 'settings' | 'chat' | 'records'

export const ipc = {
  getConfig: (): Promise<AppConfig> =>
    window.api.invoke('config:get') as Promise<AppConfig>,

  setConfig: (next: AppConfig): Promise<AppConfig> =>
    window.api.invoke('config:set', next) as Promise<AppConfig>,

  selectRegion: (kind: RegionKind): Promise<Region | null> =>
    window.api.invoke('region:select', kind) as Promise<Region | null>,

  captureRegion: (kind: RegionKind): Promise<string> =>
    window.api.invoke('region:capture', kind) as Promise<string>,

  checkPerms: (): Promise<PermissionStatus> =>
    window.api.invoke('perm:check') as Promise<PermissionStatus>,

  engineStart: (mode: EngineMode, count: number): Promise<void> =>
    window.api.invoke('engine:start', { mode, count }) as Promise<void>,

  engineStop: (): Promise<void> => window.api.invoke('engine:stop') as Promise<void>,

  engineResume: (): Promise<void> => window.api.invoke('engine:resume') as Promise<void>,

  getRecords: (): Promise<JudgeRecord[]> =>
    window.api.invoke('records:get') as Promise<JudgeRecord[]>,

  getChat: (): Promise<ChatMessage[]> =>
    window.api.invoke('chat:get') as Promise<ChatMessage[]>,

  chatSend: (messages: ChatMessage[]): Promise<string> =>
    window.api.invoke('chat:send', messages) as Promise<string>,

  panelOpen: (name: PanelName): Promise<void> =>
    window.api.invoke('panel:open', name) as Promise<void>,

  modelTest: (): Promise<void> => window.api.invoke('model:test') as Promise<void>,

  appQuit: (): Promise<void> => window.api.invoke('app:quit') as Promise<void>,

  onEngineEvent: (cb: (ev: EngineEvent) => void): (() => void) =>
    window.api.on('engine:event', cb as (data: unknown) => void),

  onChatUpdated: (cb: (messages: ChatMessage[]) => void): (() => void) =>
    window.api.on('chat:updated', cb as (data: unknown) => void)
}
