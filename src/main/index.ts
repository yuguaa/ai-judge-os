/**
 * 主进程入口：控制条窗口（无框透明胶囊）、面板窗口、IPC 注册
 */
import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'node:path'
import { broadcast } from './broadcast'
import { captureRegionDataUrl, probeScreenCapture } from './capture'
import { appendChat, getChatHistory } from './chat-store'
import { GradingEngine } from './engine'
import { checkPermissions } from './injector'
import { chat, testModel } from './llm'
import { destroyOverlay, registerOverlayIpc, startRegionSelect } from './overlay'
import { openPanel } from './panel-window'
import { destroyProcessWindow, showProcessWindow } from './process-window'
import { destroyAllFrames, showRegionFrame } from './region-frame'
import { getRecords } from './record-store'
import { getConfig, saveConfig } from './store'
import type { AppConfig, ChatMessage } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let engine: GradingEngine | null = null

function createMainWindow(): void {
  // HUD 窗口：条在底部，上方空间给 toast / tooltip 弹出（OpenScreen 同款结构）
  const workArea = screen.getPrimaryDisplay().workArea
  const barWidth = 560
  const barHeight = 176
  mainWindow = new BrowserWindow({
    width: barWidth,
    height: barHeight,
    x: workArea.x + Math.round((workArea.width - barWidth) / 2),
    y: workArea.y + workArea.height - barHeight - 12,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    title: 'ai-judge-os',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    destroyOverlay()
    destroyAllFrames()
    destroyProcessWindow()
  })
  // 同桌面内悬浮于一切窗口之上（控制条跟随启动它的桌面）
  mainWindow.setAlwaysOnTop(true, 'floating')
  // 后台启动时无框透明窗口可能不上屏，显式显示并抢焦点
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('config:get', () => getConfig())

  ipcMain.handle('config:set', (_e, next: AppConfig) => saveConfig(next))

  // 框选完成后：答题区/操作区建常驻指示框，过程区建实时显示窗口；框选期间隐藏控制条
  ipcMain.handle('region:select', (_e, kind: 'answer' | 'action' | 'process') => {
    const task = startRegionSelect().finally(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show()
    })
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
    return task.then((rect) => {
      if (rect && kind === 'process') {
        showProcessWindow(rect)
      } else if (rect) {
        showRegionFrame(kind, rect)
      }
      return rect
    })
  })

  ipcMain.handle('region:capture', (_e, kind: 'answer' | 'action') => {
    const region = getConfig().regions[kind]
    if (!region) throw new Error('尚未框选该区域')
    return captureRegionDataUrl(region)
  })

  ipcMain.handle('perm:check', async () => {
    const native = checkPermissions()
    return {
      // 屏幕录制以 desktopCapturer 实测为准，系统询问接口在部分版本不可靠
      screenCapture: await probeScreenCapture(),
      accessibility: native.accessibility
    }
  })

  ipcMain.handle('engine:start', (_e, opts: { mode: 'manual' | 'auto'; count: number }) => {
    engine = engine ?? new GradingEngine()
    engine.start(opts)
  })

  ipcMain.handle('engine:stop', () => engine?.stop())

  ipcMain.handle('engine:resume', () => engine?.resume())

  ipcMain.handle('records:get', () => getRecords())

  ipcMain.handle('chat:get', () => getChatHistory())

  ipcMain.handle('chat:send', async (_e, messages: ChatMessage[]) => {
    const reply = await chat(getConfig().model, messages)
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUser) appendChat(lastUser)
    appendChat({ role: 'assistant', content: reply })
    broadcast('chat:updated', getChatHistory())
    return reply
  })

  ipcMain.handle('panel:open', (_e, name: string) => openPanel(name))

  ipcMain.handle('model:test', () => testModel(getConfig().model))

  ipcMain.handle('app:quit', () => app.quit())
}

app.whenReady().then(() => {
  registerOverlayIpc()
  registerIpc()
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  engine?.stop()
  app.quit()
})
