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

  return (
    <div className="pointer-events-none h-full w-full overflow-hidden rounded-lg border border-emerald-400/40 bg-[#0a0a0e]/85 p-2 font-sans text-white backdrop-blur-sm">
      {/* 顶行：进度与状态 */}
      <div className="flex items-center gap-2 text-[10px] text-white/50">
        <span className="font-medium text-emerald-400">
          {progress.done}/{progress.total || '∞'} 张
        </span>
        <span>{STATE_TEXT[state]}</span>
        {latest && (
          <span className="ml-auto text-[10px] text-white/40">{latest.time}</span>
        )}
      </div>

      {/* 最新判分：得分大字 */}
      {latest ? (
        <>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold leading-7 text-emerald-400">
              {latest.score}
            </span>
            <span className="text-[10px] text-white/45">
              分 · 置信 {(latest.confidence * 100).toFixed(0)}%
            </span>
            {latest.lowConfidence && (
              <span className="rounded bg-red-500/25 px-1 text-[10px] text-red-300">低置信</span>
            )}
          </div>

          {/* 逐条判定网格 */}
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
            {latest.items.map((it, i) => (
              <span key={i} className="text-[10px] leading-4">
                <span className="text-white/40">{it.label}</span>{' '}
                <span className={it.correct ? 'text-emerald-300' : 'text-red-300'}>
                  {it.correct ? '✓' : '✗'} {it.response || '—'}
                </span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-3 text-center text-[10px] text-white/35">
          等待评卷…开始后此处实时显示判定过程
        </div>
      )}
    </div>
  )
}
