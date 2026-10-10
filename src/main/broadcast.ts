/**
 * 事件广播：推送给所有存活窗口（控制条 + 面板窗口）
 */
import { BrowserWindow } from 'electron'

export function broadcast(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}
