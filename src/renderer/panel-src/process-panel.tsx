/**
 * 评卷过程面板：显示在用户框选的屏幕区域，实时渲染判分进度与逐条判定
 * 点击穿透 + 透明背景，紧凑网格适配任意尺寸区域
 */
import { useEffect, useState } from 'react'
import { ipc } from '@/lib/ipc'
import type { EngineState, JudgeRecord } from '@shared/types'

const STATE_TEXT: Record<EngineState, string> = {
  idle: '待机',
  'waiting-new': '等待新卷',
  judging: '判分中',
  submitting: '提交中',
  paused: '已暂停',
  stopped: '已完成'
}

export function ProcessPanel(): JSX.Element {
  const [records, setRecords] = useState<JudgeRecord[]>([])
  const [state, setState] = useState<EngineState>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    void ipc.getRecords().then(setRecords)
    return ipc.onEngineEvent((ev) => {
      switch (ev.type) {
        case 'judged':
          setRecords((r) => [ev.record, ...r])
          break
        case 'state':
          setState(ev.state)
          break
        case 'progress':
          setProgress({ done: ev.done, total: ev.total })
          break
      }
    })
  }, [])

  const latest = records[0]
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="pointer-events-none relative h-full w-full overflow-hidden rounded-xl border border-emerald-400/30 bg-gradient-to-b from-[#0d1412]/[0.88] to-[#08080c]/[0.9] p-2.5 font-sans text-white shadow-[inset_0_1px_0_rgba(52,211,153,0.15),0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md">
      {/* 顶行：进度与状态 */}
      <div className="flex items-center gap-2 text-[10px] text-white/50">
        <span className="tnum font-medium text-emerald-400">
          {progress.done}/{progress.total || '∞'} 张
        </span>
        <span>{STATE_TEXT[state]}</span>
        {latest && (
          <span className="tnum ml-auto text-[10px] text-white/40">{latest.time}</span>
        )}
      </div>

      {/* 最新判分：得分大字 */}
      {latest ? (
        <>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="tnum text-[26px] font-bold leading-8 text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]">
              {latest.score}
            </span>
            <span className="tnum text-[10px] text-white/45">
              分 · 置信 {(latest.confidence * 100).toFixed(0)}%
            </span>
            {latest.lowConfidence && (
              <span className="rounded bg-red-500/20 px-1.5 py-px text-[10px] text-red-300">
                低置信
              </span>
            )}
          </div>

          {/* 逐条判定网格 */}
          <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
            {latest.items.map((it, i) => (
              <span key={i} className="text-[10px] leading-4">
                <span className="text-white/40">{it.label}</span>{' '}
                <span className={it.correct ? 'text-emerald-300' : 'text-red-300'}>
                  {it.correct ? '✓' : '✗'} {it.response || '—'}
                </span>
              </span>
            ))}
          </div>

          {/* 底部进度细线 */}
          {progress.total > 0 && (
            <div className="absolute inset-x-2.5 bottom-1.5 h-px overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-400/70 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 text-center text-[10px] text-white/35">
          等待评卷…开始后此处实时显示判定过程
        </div>
      )}
    </div>
  )
}
