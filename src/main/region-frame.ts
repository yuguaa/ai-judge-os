/**
 * 区域指示框：框选完成后在屏幕上常驻显示的边框（类似录屏软件的录制区域框）
 * 透明窗口 + 点击穿透，随重新框选更新，应用退出销毁
 */
import { BrowserWindow } from 'electron'
import type { Region } from '../shared/types'

const frames = new Map<string, BrowserWindow>()

const STYLES: Record<string, { color: string; label: string }> = {
  answer: { color: '#3b82f6', label: '答题区' },
  action: { color: '#f59e0b', label: '操作区' }
}

export function showRegionFrame(kind: string, region: Region): void {
  destroyFrame(kind)
  const style = STYLES[kind] ?? { color: '#3b82f6', label: kind }
  const topPad = 24
  const sidePad = 3
  const win = new BrowserWindow({
    x: region.x - sidePad,
    y: region.y - topPad,
    width: region.width + sidePad * 2,
    height: region.height + topPad + sidePad,
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
    webPreferences: { sandbox: true }
  })
  win.setIgnoreMouseEvents(true)
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:transparent;overflow:hidden}
    .frame{position:absolute;left:${sidePad}px;top:${topPad}px;width:${region.width}px;height:${region.height}px;
      border:2px solid ${style.color};border-radius:4px;box-sizing:border-box;
      box-shadow:0 0 0 1px rgba(0,0,0,.25)}
    .tag{position:absolute;left:${sidePad}px;top:2px;background:${style.color};color:#fff;
      font:11px -apple-system,'PingFang SC',sans-serif;line-height:16px;padding:1px 8px;border-radius:4px}
  </style></head><body>
    <div class="frame"></div><div class="tag">${style.label}</div>
  </body></html>`
  void win
    .loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    .then(() => {
      if (!win.isDestroyed()) win.showInactive()
    })
  frames.set(kind, win)
}

export function destroyFrame(kind: string): void {
  const win = frames.get(kind)
  if (win) {
    win.destroy()
    frames.delete(kind)
  }
}

export function destroyAllFrames(): void {
  for (const kind of [...frames.keys()]) {
    destroyFrame(kind)
  }
}
