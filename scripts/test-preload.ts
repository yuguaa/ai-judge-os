// 测试 preload：把主进程广播的 engine:event 转发回主进程收集
import { ipcRenderer } from 'electron'

ipcRenderer.on('engine:event', (_e, data) => {
  ipcRenderer.send('test:engine-event', data)
})
