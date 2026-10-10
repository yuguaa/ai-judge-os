/**
 * 面板窗口入口：按 ?panel= 参数渲染设置 / 对话 / 记录
 */
import ReactDOM from 'react-dom/client'
import { ChatPanel } from './chat-panel'
import { ProcessPanel } from './process-panel'
import { RecordsPanel } from './records-panel'
import { SettingsPanel } from './settings-panel'
import '../src/index.css'

const panel = new URLSearchParams(window.location.search).get('panel') ?? ''

const PANELS: Record<string, () => JSX.Element> = {
  settings: SettingsPanel,
  chat: ChatPanel,
  records: RecordsPanel,
  process: ProcessPanel
}

const Panel = PANELS[panel]

ReactDOM.createRoot(document.getElementById('root')!).render(
  Panel ? (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <Panel />
    </div>
  ) : (
    <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
      未知面板：{panel}
    </div>
  )
)
