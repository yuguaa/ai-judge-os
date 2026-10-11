/**
 * 控制条主界面：左侧垂直折叠菜单栏（Claude.ai 风格）
 * 展开态：图标 + 文字的分组菜单；折叠态：只留图标列，tooltip 向右弹出
 * 折叠 / 展开与窗口宽度同步，toast 显示在菜单右侧
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import {
  ClipboardListIcon,
  CropIcon,
  MessageSquareIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlayIcon,
  PresentationIcon,
  ScanIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
  ZapIcon
} from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { TipButton, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ipc, type EngineMode, type RegionKind } from '@/lib/ipc'
import { useAppStore } from '@/lib/store'
import type { EngineState } from '@shared/types'

const RUNNING_STATES: EngineState[] = ['waiting-new', 'judging', 'submitting']

const STATE_TEXT: Record<EngineState, string> = {
  idle: '待机',
  'waiting-new': '等待新卷',
  judging: '判分中',
  submitting: '提交中',
  paused: '已暂停',
  stopped: '已完成'
}

/** 状态灯：活跃状态呼吸，paused 常亮 */
const STATE_COLOR: Record<EngineState, string> = {
  idle: 'bg-white/30',
  'waiting-new': 'bg-sky-400 animate-pulse',
  judging: 'bg-emerald-400 animate-pulse',
  submitting: 'bg-teal-400 animate-pulse',
  paused: 'bg-amber-400',
  stopped: 'bg-emerald-400/70'
}

/** 框选类型 → 中文名（toast 反馈用） */
const REGION_NAME: Record<RegionKind, string> = {
  answer: '答题区',
  action: '操作区',
  process: '过程显示区'
}

const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties

/** 分组标题（仅展开态可见） */
function SectionTitle(props: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="mt-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white/30">
      {props.children}
    </div>
  )
}

/** 菜单项：折叠态纯图标居中，展开态图标 + 文字整行 */
function MenuButton(props: {
  tip: string
  label: string
  icon: React.ElementType
  collapsed: boolean
  active?: boolean
  danger?: boolean
  onClick: () => void
}): JSX.Element {
  const { tip, label, icon: Icon, collapsed, active, danger, onClick } = props
  return (
    <TipButton
      tip={tip}
      ariaLabel={label}
      className={cn(
        collapsed
          ? 'mx-auto flex size-9 items-center justify-center rounded-xl text-white/55 transition-all duration-150 hover:bg-white/[0.08] hover:text-white active:scale-[0.92]'
          : 'flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] text-white/65 transition-all duration-150 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]',
        active &&
          (collapsed
            ? 'bg-emerald-400/[0.12] text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.15),inset_0_0_0_1px_rgba(52,211,153,0.2)] hover:bg-emerald-400/[0.16] hover:text-emerald-200'
            : 'bg-emerald-400/[0.1] text-emerald-300 hover:bg-emerald-400/[0.14] hover:text-emerald-200'),
        danger && 'text-red-400/70 hover:bg-red-500/[0.12] hover:text-red-300'
      )}
      onClick={onClick}
    >
      <Icon className="size-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </TipButton>
  )
}

export default function App(): JSX.Element {
  const config = useAppStore((s) => s.config)
  const saveConfig = useAppStore((s) => s.saveConfig)
  const perms = useAppStore((s) => s.perms)
  const engineState = useAppStore((s) => s.engineState)
  const progress = useAppStore((s) => s.progress)
  const loadInitial = useAppStore((s) => s.loadInitial)
  const setEngineState = useAppStore((s) => s.setEngineState)
  const setProgress = useAppStore((s) => s.setProgress)
  const appendRecord = useAppStore((s) => s.appendRecord)

  const [mode, setMode] = useState<EngineMode>('manual')
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('hud-collapsed') === '1'
  )

  useEffect(() => {
    void loadInitial()
    return ipc.onEngineEvent((ev) => {
      switch (ev.type) {
        case 'state':
          setEngineState(ev.state, ev.message)
          if (ev.state === 'paused' && ev.message) toast.warning(ev.message, { duration: 8000 })
          if (ev.state === 'stopped' && ev.message) toast.success(ev.message)
          break
        case 'progress':
          setProgress(ev.done, ev.total)
          break
        case 'judged':
          appendRecord(ev.record)
          toast.success(
            `得分 ${ev.record.score} · 置信 ${(ev.record.confidence * 100).toFixed(0)}%`
          )
          break
      }
    })
  }, [loadInitial, setEngineState, setProgress, appendRecord])

  // 菜单宽度与窗口宽度同步：折叠先播收窄动画再缩窗；展开先扩窗再播动画
  // 首次挂载也会执行一次，保证初始折叠态窗口对齐；连续点击时旧的定时器会被清理
  useEffect(() => {
    if (collapsed) {
      const timer = window.setTimeout(() => void ipc.windowResize(true), 230)
      return () => window.clearTimeout(timer)
    }
    void ipc.windowResize(false)
  }, [collapsed])

  const running = RUNNING_STATES.includes(engineState)
  const paused = engineState === 'paused'

  const toggleCollapsed = (): void => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('hud-collapsed', next ? '1' : '0')
  }

  const select = async (kind: RegionKind): Promise<void> => {
    if (!config) return
    if (running || paused) {
      toast.warning('评卷进行中，请先停止再调整框选')
      return
    }
    const rect = await ipc.selectRegion(kind)
    if (rect) {
      await saveConfig({ ...config, regions: { ...config.regions, [kind]: rect } })
      toast.success(`${REGION_NAME[kind]}已框选`)
    }
  }

  const start = async (): Promise<void> => {
    if (!config) return
    if (!config.regions.answer) {
      toast.error('请先框选答题区')
      return
    }
    if (!config.model.apiKey) {
      toast.error('请先在设置中配置 API Key')
      return
    }
    if (mode === 'auto' && !config.regions.action) {
      toast.error('自动模式需要先框选操作区')
      return
    }
    try {
      await ipc.engineStart(mode, config.autoCount)
      if (mode === 'auto') {
        toast.success(`自动评卷开始，共 ${config.autoCount} 张`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const permsMissing = perms !== null && (!perms.screenCapture || !perms.accessibility)
  const statusText =
    progress.total > 0 ? `${progress.done}/${progress.total} 张` : STATE_TEXT[engineState]

  /** 主按钮：开始 / 停止 / 继续，折叠态圆形渐变，展开态全宽渐变 */
  const primary = (() => {
    if (running) {
      return {
        icon: SquareIcon,
        label: '停止评卷',
        cls: 'from-[#ff6b6b] to-[#d92d2d] shadow-[0_4px_18px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_6px_26px_rgba(239,68,68,0.55),inset_0_1px_0_rgba(255,255,255,0.3)]',
        tip: '停止评卷'
      }
    }
    if (paused) {
      return {
        icon: PlayIcon,
        label: '继续评卷',
        cls: 'from-[#ffc53d] to-[#e8950a] shadow-[0_4px_18px_rgba(245,158,11,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_6px_26px_rgba(245,158,11,0.55),inset_0_1px_0_rgba(255,255,255,0.3)]',
        tip: '当前卷已人工处理，继续评卷'
      }
    }
    return {
      icon: PlayIcon,
      label: '开始评卷',
      cls: 'from-[#3fe6a2] to-[#17ad74] shadow-[0_4px_18px_rgba(32,196,132,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] hover:shadow-[0_6px_26px_rgba(32,196,132,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]',
      tip:
        mode === 'manual' && engineState === 'stopped'
          ? '评下一张（判完自动停，提交后继续）'
          : mode === 'manual'
            ? '评当前卷（判完自动停，你自己点提交）'
            : `开始自动评卷（${config?.autoCount ?? 1} 张）`
    }
  })()
  const PrimaryIcon = primary.icon

  return (
    <TooltipProvider delayDuration={300}>
      <Toaster position="bottom-right" offset={14} />
      <div className="fixed inset-0">
        <div
          data-hud
          className="animate-hud-in absolute left-3 top-1/2 flex -translate-y-1/2 flex-col rounded-2xl border border-white/[0.09] bg-gradient-to-b from-[#20202b]/[0.97] to-[#0d0d13]/[0.98] p-2.5 backdrop-blur-2xl transition-[width] duration-200 ease-out"
          style={{
            width: collapsed ? 62 : 236,
            boxShadow:
              '0 10px 28px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
          }}
        >
          {/* 头部：logo + 标题 + 折叠钮（可拖拽） */}
          <div
            className={cn(
              'flex items-center gap-2',
              collapsed ? 'flex-col pb-1' : 'px-1.5 pb-0.5'
            )}
            style={dragStyle}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-[#3fe6a2] to-[#17ad74] text-white shadow-[0_2px_10px_rgba(32,196,132,0.4),inset_0_1px_0_rgba(255,255,255,0.3)]">
              <SparklesIcon className="size-3.5" />
            </div>
            {!collapsed && (
              <span className="text-[13px] font-semibold tracking-wide text-white/90">
                AI Judge OS
              </span>
            )}
            <TipButton
              tip={collapsed ? '展开菜单' : '折叠菜单'}
              ariaLabel={collapsed ? '展开菜单' : '折叠菜单'}
              className={cn(
                'flex size-7 items-center justify-center rounded-lg text-white/40 transition-all duration-150 hover:bg-white/[0.08] hover:text-white active:scale-[0.92]',
                collapsed ? 'mt-1' : 'ml-auto'
              )}
              onClick={toggleCollapsed}
            >
              {collapsed ? (
                <PanelLeftOpenIcon className="size-4" />
              ) : (
                <PanelLeftCloseIcon className="size-4" />
              )}
            </TipButton>
          </div>

          {/* 框选组 */}
          {!collapsed && <SectionTitle>区域框选</SectionTitle>}
          <div className="flex flex-col gap-1 pt-1">
            <MenuButton
              tip="框选答题区（蓝色边框常驻屏幕）"
              label="框选答题区"
              icon={CropIcon}
              collapsed={collapsed}
              active={Boolean(config?.regions.answer)}
              onClick={() => void select('answer')}
            />
            <MenuButton
              tip="框选操作区（橙色边框常驻屏幕，自动模式必选）"
              label="框选操作区"
              icon={ScanIcon}
              collapsed={collapsed}
              active={Boolean(config?.regions.action)}
              onClick={() => void select('action')}
            />
            <MenuButton
              tip="框选过程显示区（评卷过程实时展示在该区域）"
              label="框选过程显示区"
              icon={PresentationIcon}
              collapsed={collapsed}
              active={Boolean(config?.regions.process)}
              onClick={() => void select('process')}
            />
          </div>

          {/* 模式组 */}
          {!collapsed && <SectionTitle>评卷模式</SectionTitle>}
          <div className="flex flex-col gap-1 pt-1">
            <MenuButton
              tip={
                mode === 'auto'
                  ? '自动模式：模型接管提交，点击切回手动'
                  : '手动模式：模型判分你来提交，点击切到自动'
              }
              label={mode === 'auto' ? '自动模式' : '手动模式'}
              icon={ZapIcon}
              collapsed={collapsed}
              active={mode === 'auto'}
              onClick={() => setMode((m) => (m === 'manual' ? 'auto' : 'manual'))}
            />
            {!collapsed && mode === 'auto' && config && (
              <div className="flex animate-in items-center gap-2 px-2.5 pb-0.5 fade-in zoom-in-95">
                <span className="text-[11px] text-white/40">评卷数量</span>
                <input
                  className="tnum ml-auto h-6 w-14 rounded-md border border-white/[0.08] bg-white/[0.05] text-center text-[11px] font-medium text-white/90 outline-none transition-all duration-150 hover:border-white/[0.16] focus:border-emerald-400/60 focus:bg-white/[0.08]"
                  type="number"
                  min={1}
                  value={config.autoCount}
                  onChange={(e) =>
                    void saveConfig({
                      ...config,
                      autoCount: Math.max(1, Number(e.target.value) || 1)
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* 主按钮：开始 / 停止 / 继续 */}
          <div className="pt-1.5">
            <TipButton
              tip={primary.tip}
              ariaLabel={primary.label}
              className={cn(
                'bg-gradient-to-b text-white transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.96]',
                primary.cls,
                collapsed
                  ? 'mx-auto flex size-10 items-center justify-center rounded-full'
                  : 'flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-medium'
              )}
              onClick={() => {
                if (running) void ipc.engineStop()
                else if (paused) void ipc.engineResume()
                else void start()
              }}
            >
              <PrimaryIcon className={cn('shrink-0', running || paused ? 'size-3.5' : 'size-4')} />
              {!collapsed && <span>{primary.label}</span>}
            </TipButton>
          </div>

          {/* 工具组 */}
          {!collapsed && <SectionTitle>工具</SectionTitle>}
          <div className="flex flex-col gap-1 pt-1">
            <MenuButton
              tip="判分记录"
              label="判分记录"
              icon={ClipboardListIcon}
              collapsed={collapsed}
              onClick={() => void ipc.panelOpen('records')}
            />
            <MenuButton
              tip="对话调试"
              label="对话调试"
              icon={MessageSquareIcon}
              collapsed={collapsed}
              onClick={() => void ipc.panelOpen('chat')}
            />
            <MenuButton
              tip="设置：模型 / 规则 / 权限"
              label="设置"
              icon={SettingsIcon}
              collapsed={collapsed}
              danger={permsMissing}
              onClick={() => void ipc.panelOpen('settings')}
            />
          </div>

          {/* 底部：状态灯 + 退出（可拖拽） */}
          <div
            className={cn(
              'mt-auto flex items-center pt-2',
              collapsed ? 'flex-col gap-2' : 'gap-2 px-1.5'
            )}
            style={dragStyle}
          >
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span
                  className={`absolute inset-0 rounded-full opacity-50 blur-[3px] ${STATE_COLOR[engineState]}`}
                />
                <span className={`relative size-2 rounded-full ${STATE_COLOR[engineState]}`} />
              </span>
              {!collapsed && (
                <span className="tnum text-[11px] font-medium tracking-wide text-white/55">
                  {statusText}
                </span>
              )}
            </div>
            <TipButton
              tip="退出 ai-judge-os"
              ariaLabel="退出应用"
              className={cn(
                'flex size-7 items-center justify-center rounded-lg text-red-400/60 transition-all duration-150 hover:bg-red-500/[0.12] hover:text-red-300 active:scale-[0.92]',
                collapsed ? '' : 'ml-auto'
              )}
              onClick={() => void ipc.appQuit()}
            >
              <XIcon className="size-4" />
            </TipButton>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
