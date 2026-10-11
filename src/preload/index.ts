/**
 * preload：contextBridge 暴露最小 IPC 面
 * invoke 白名单 + 事件订阅 + 覆盖层回传
 */
import { contextBridge, ipcRenderer } from 'electron'

const INVOKE_CHANNELS = new Set([
  'config:get',
  'config:set',
  'region:select',
  'region:capture',
  'perm:check',
  'engine:start',
  'engine:stop',
  'engine:resume',
  'records:get',
  'chat:get',
  'chat:send',
  'panel:open',
  'window:resize',
  'model:test',
  'app:quit'
])

const PUSH_CHANNELS = new Set(['engine:event', 'chat:updated'])

const api = {
  /** 运行平台：渲染层据此适配 macOS 红绿灯避让等布局 */
  platform: process.platform,
  invoke: (channel: string, payload?: unknown): Promise<unknown> => {
    if (!INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`未授权的 IPC 通道：${channel}`))
    }
    return ipcRenderer.invoke(channel, payload)
  },
  on: (channel: string, callback: (data: unknown) => void): (() => void) => {
    if (!PUSH_CHANNELS.has(channel)) {
      throw new Error(`未授权的推送通道：${channel}`)
    }
    const listener = (_e: Electron.IpcRendererEvent, data: unknown): void => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  /** 框选覆盖层回传结果（null 表示取消） */
  overlayResult: (rect: unknown): void => {
    ipcRenderer.send('overlay:result', rect)
  },
  /** 覆盖层页面标记，供 preload 侧判断上下文 */
  isOverlay: process.argv.includes('--ai-judge-overlay')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
