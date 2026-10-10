/**
 * 面板窗口：设置 / 对话 / 记录 的独立子窗口，单例复用
 */
import { BrowserWindow } from 'electron'
import { join } from 'node:path'

const PANELS: Record<string, { width: number; height: number; title: string }> = {
  settings: { width: 580, height: 780, title: '设置' },
  chat: { width: 520, height: 700, title: '对话调试' },
  records: { width: 800, height: 680, title: '判分记录' }
}

const open = new Map<string, BrowserWindow>()

export function openPanel(name: string): void {
  const spec = PANELS[name]
  if (!spec) throw new Error(`未知面板：${name}`)
  const existing = open.get(name)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }
  const win = new BrowserWindow({
    width: spec.width,
    height: spec.height,
    title: spec.title,
    backgroundColor: '#09090b',
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  win.on('closed', () => open.delete(name))
  win.once('ready-to-show', () => win.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/panel.html?panel=${name}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/panel.html'), {
      query: { panel: name }
    })
  }
  open.set(name, win)
}

export function closeAllPanels(): void {
  for (const win of open.values()) {
    if (!win.isDestroyed()) win.destroy()
  }
  open.clear()
}
