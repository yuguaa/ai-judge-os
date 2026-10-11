/**
 * 面板窗口入口：按 ?panel= 参数渲染设置 / 对话 / 记录 / 过程
 * PanelShell 提供统一头部（macOS 红绿灯避让）与全局 Toast
 */
import ReactDOM from 'react-dom/client'
import { Toaster } from '../src/components/ui/toaster'
import { ChatPanel } from './chat-panel'
import { ProcessPanel } from './process-panel'
import { RecordsPanel } from './records-panel'
import { SettingsPanel } from './settings-panel'
import '../src/index.css'

const panel = new URLSearchParams(window.location.search).get('panel') ?? ''

const PANELS: Record<
  string,
  { title: string; subtitle: string; bare?: boolean; render: () => JSX.Element }
> = {
  settings: {
    title: '设置',
    subtitle: '模型接入 · 评分规则 · 系统权限',
    render: () => <SettingsPanel />
  },
  chat: {
    title: '对话调试',
    subtitle: '带截图与模型确认判分口径，结论可存入规则',
    render: () => <ChatPanel />
  },
  records: {
    title: '判分记录',
    subtitle: '每张卷的得分与逐条判定留档',
    render: () => <RecordsPanel />
  },
  process: {
    title: '评卷过程',
    subtitle: '实时渲染判分进度',
    bare: true,
    render: () => <ProcessPanel />
  }
}

const current = PANELS[panel]
if (current) document.title = current.title

/** 面板统一外壳：氛围底 + 头部 + 内容区 */
function PanelShell(props: { children: React.ReactNode; actions?: React.ReactNode }): JSX.Element {
  const isMac = window.api.platform === 'darwin'
  return (
    <div className="panel-aura flex h-screen w-screen flex-col overflow-hidden border border-white/[0.07] text-foreground">
      <header
        className={`flex h-14 shrink-0 items-center border-b border-white/[0.05] bg-gradient-to-b from-white/[0.04] to-transparent ${
          isMac ? 'pl-20' : 'pl-5'
        } pr-5`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex flex-col justify-center gap-0.5">
          <h1 className="text-[13px] font-semibold tracking-wide text-white/90">
            {current.title}
          </h1>
          <p className="text-[11px] text-muted-foreground/90">{current.subtitle}</p>
        </div>
        {props.actions && <div className="ml-auto">{props.actions}</div>}
      </header>
      <div className="animate-panel-in min-h-0 flex-1">{props.children}</div>
      <Toaster />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  current ? (
    current.bare ? (
      current.render()
    ) : (
      <PanelShell>{current.render()}</PanelShell>
    )
  ) : (
    <div className="panel-aura flex h-screen items-center justify-center text-sm text-muted-foreground">
      未知面板：{panel}
    </div>
  )
)
