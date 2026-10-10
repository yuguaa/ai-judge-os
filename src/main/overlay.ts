/**
 * 框选覆盖层：透明全屏窗口，渲染层完成拖拽框选后回传矩形
 */
import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import type { Region } from '../shared/types'

let overlayWin: BrowserWindow | null = null
let pendingResolve: ((rect: Region | null) => void) | null = null

/** 打开覆盖层，等待用户框选；取消返回 null */
export function startRegionSelect(): Promise<Region | null> {
  if (overlayWin) {
    throw new Error('已有框选任务进行中')
  }
  const display = screen.getPrimaryDisplay()
  overlayWin = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    enableLargerThanScreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  overlayWin.loadFile(join(__dirname, '../renderer/overlay.html'))

  return new Promise((resolve) => {
    pendingResolve = resolve
    overlayWin?.once('ready-to-show', () => overlayWin?.show())
  })
}

function finish(rect: Region | null): void {
  pendingResolve?.(rect)
  pendingResolve = null
  overlayWin?.destroy()
  overlayWin = null
}

export function registerOverlayIpc(): void {
  ipcMain.on('overlay:result', (_e, rect: Region | null) => {
    finish(rect)
  })
}

/** 主窗口关闭等场景下清理覆盖层 */
export function destroyOverlay(): void {
  if (overlayWin) {
    finish(null)
  }
}
