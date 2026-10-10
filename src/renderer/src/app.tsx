/**
 * 控制条主界面：OpenScreen 式 HUD（全屏透明覆盖层）
 * 图标 hover 出功能名（tooltip），异常与提示走 toast，状态区只留状态灯与进度
 * 拖拽把手 | 框选组 | 模式组 | 圆形主钮 | 面板组 | 关闭 | 状态灯
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import {
  ClipboardListIcon,
  CropIcon,
  MessageSquareIcon,
  PlayIcon,
  PresentationIcon,
  ScanIcon,
  SettingsIcon,
  SquareIcon,
  XIcon,
  ZapIcon
} from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { TipButton, TooltipProvider } from '@/components/ui/tooltip'
import { ipc, type EngineMode } from '@/lib/ipc'
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

const STATE_COLOR: Record<EngineState, string> = {
  idle: 'bg-white/30',
  'waiting-new': 'bg-sky-400 animate-pulse',
  judging: 'bg-emerald-400 animate-pulse',
  submitting: 'bg-emerald-400 animate-pulse',
  paused: 'bg-red-400',
  stopped: 'bg-emerald-400/60'
}

// OpenScreen LaunchWindow 的样式语言
const groupClass =
  'flex items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.045] p-0.5'

const iconBtnClass =
  'flex size-8 items-center justify-center rounded-lg text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95'

const enabledGlow =
  'text-emerald-400 drop-shadow-[0_0_4px_rgba(74,222,128,0.4)] hover:text-emerald-300'

const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

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
        case 'error':
          toast.error(ev.message, { duration: 8000 })
          break
      }
    })
  }, [loadInitial, setEngineState, setProgress, appendRecord])

  // 悬停控制条时窗口接收事件，其余区域穿透到下层应用（已改小窗口方案，穿透逻辑移除）

  const running = RUNNING_STATES.includes(engineState)
  const paused = engineState === 'paused'

  const select = async (kind: 'answer' | 'action' | 'process'): Promise<void> => {
    if (!config) return
    const rect = await ipc.selectRegion(kind)
    if (rect) {
      await saveConfig({ ...config, regions: { ...config.regions, [kind]: rect } })
      toast.success(kind === 'answer' ? '答题区已框选' : '操作区已框选')
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

  return (
    <TooltipProvider delayDuration={300}>
      <Toaster />
      <div className="fixed inset-0">
        <div
          data-hud
          className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-white/[0.10] bg-[#0a0a0e]/90 px-2"
          style={{
            height: 56,
            boxShadow: '0 20px 60px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06)'
          }}
        >
          {/* 拖拽把手 */}
          <div
            className="flex h-8 w-5 cursor-grab items-center justify-center active:cursor-grabbing"
            style={dragStyle}
            title="按住拖动"
          >
            <div className="h-4 w-1 rounded-full bg-white/20" />
          </div>

          {/* 框选组：框选完成后绿色光晕 */}
          <div className={groupClass} style={noDragStyle}>
            <TipButton
              tip="框选答题区（蓝色边框常驻屏幕）"
              className={`${iconBtnClass} ${config?.regions.answer ? enabledGlow : ''}`}
              onClick={() => void select('answer')}
            >
              <CropIcon className="size-4" />
            </TipButton>
            <TipButton
              tip="框选操作区（橙色边框常驻屏幕，自动模式必选）"
              className={`${iconBtnClass} ${config?.regions.action ? enabledGlow : ''}`}
              onClick={() => void select('action')}
            >
              <ScanIcon className="size-4" />
            </TipButton>
            <TipButton
              tip="框选过程显示区（评卷过程实时展示在该区域）"
              className={`${iconBtnClass} ${config?.regions.process ? enabledGlow : ''}`}
              onClick={() => void select('process')}
            >
              <PresentationIcon className="size-4" />
            </TipButton>
          </div>

          {/* 模式组：闪电亮起 = 自动模式 */}
          <div className={groupClass} style={noDragStyle}>
            <TipButton
              tip={
                mode === 'auto'
                  ? '自动模式：模型接管提交，点击切回手动'
                  : '手动模式：模型判分你来提交，点击切到自动'
              }
              className={`${iconBtnClass} ${mode === 'auto' ? enabledGlow : ''}`}
              onClick={() => setMode((m) => (m === 'manual' ? 'auto' : 'manual'))}
            >
              <ZapIcon className="size-4" />
            </TipButton>
            {mode === 'auto' && config && (
              <input
                className="h-6 w-9 rounded-lg bg-white/[0.06] text-center text-[11px] text-white outline-none"
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
            )}
          </div>

          {/* 圆形主钮：开始 / 停止 / 继续 */}
          {!running && !paused && (
            <TipButton
              tip={
                mode === 'manual' && engineState === 'stopped'
                  ? '评下一张（判完自动停，提交后继续）'
                  : mode === 'manual'
                    ? '评卷当前卷（判完自动停，你自己点提交）'
                    : '开始自动评卷'
              }
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#34B27B] text-white shadow-[0_0_14px_rgba(52,178,123,0.45)] transition-all duration-150 hover:brightness-110 active:scale-95"
              onClick={() => void start()}
            >
              <PlayIcon className="ml-0.5 size-4" />
            </TipButton>
          )}
          {running && (
            <TipButton
              tip="停止评卷"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,0.45)] transition-all duration-150 hover:brightness-110 active:scale-95"
              onClick={() => void ipc.engineStop()}
            >
              <SquareIcon className="size-3.5" />
            </TipButton>
          )}
          {paused && (
            <>
              <TipButton
                tip="当前卷已人工处理，继续评卷"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-[0_0_14px_rgba(245,158,11,0.45)] transition-all duration-150 hover:brightness-110 active:scale-95"
                onClick={() => void ipc.engineResume()}
              >
                <PlayIcon className="ml-0.5 size-4" />
              </TipButton>
              <TipButton
                tip="停止评卷"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95"
                onClick={() => void ipc.engineStop()}
              >
                <SquareIcon className="size-3.5" />
              </TipButton>
            </>
          )}

          {/* 右侧：面板组 + 关闭 + 状态灯 */}
          <div className="ml-auto flex items-center gap-1.5">
            <div className={groupClass} style={noDragStyle}>
              <TipButton
                tip="判分记录"
                className={iconBtnClass}
                onClick={() => void ipc.panelOpen('records')}
              >
                <ClipboardListIcon className="size-4" />
              </TipButton>
              <TipButton
                tip="对话调试"
                className={iconBtnClass}
                onClick={() => void ipc.panelOpen('chat')}
              >
                <MessageSquareIcon className="size-4" />
              </TipButton>
              <TipButton
                tip="设置：模型 / 规则 / 权限"
                className={`${iconBtnClass} ${permsMissing ? 'text-red-400 hover:text-red-300' : ''}`}
                onClick={() => void ipc.panelOpen('settings')}
              >
                <SettingsIcon className="size-4" />
              </TipButton>
            </div>

            <TipButton
              tip="退出 ai-judge-os"
              className="flex size-7 items-center justify-center rounded-lg text-white/40 transition-all duration-150 hover:bg-white/[0.08] hover:text-white active:scale-95"
              onClick={() => void ipc.appQuit()}
            >
              <XIcon className="size-4" />
            </TipButton>

            {/* 状态灯（可拖拽） */}
            <div className="flex items-center gap-1.5 pl-0.5" style={dragStyle}>
              <span className={`size-1.5 rounded-full ${STATE_COLOR[engineState]}`} />
              <span className="text-[11px] text-white/45">{statusText}</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
