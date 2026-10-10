/**
 * 过程显示窗口：定位到用户框选的屏幕区域，实时渲染评卷过程
 * 透明、置顶、点击穿透，内容随引擎事件实时更新
 */
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { Region } from '../shared/types'

let win: BrowserWindow | null = null

export function showProcessWindow(region: Region): void {
  destroyProcessWindow()
  win = new BrowserWindow({
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  win.setIgnoreMouseEvents(true)
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/panel.html?panel=process`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/panel.html'), {
      query: { panel: 'process' }
    })
  }
  const created = win
  created.once('ready-to-show', () => {
    if (!created.isDestroyed()) created.showInactive()
  })
}

export function destroyProcessWindow(): void {
  const target = win
  if (target) {
    target.destroy()
    win = null
  }
}
