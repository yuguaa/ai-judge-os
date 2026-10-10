import { useState } from 'react'
import type { Region } from '../../shared/types'

/**
 * 框选覆盖层：全屏透明窗口，拖拽绘制矩形，Esc 取消
 */
export default function OverlayMain(): JSX.Element {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [rect, setRect] = useState<Region | null>(null)

  const onMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    setDrag({ x: e.clientX, y: e.clientY })
    setRect(null)
  }

  const onMouseMove = (e: React.MouseEvent): void => {
    if (!drag) return
    setRect({
      x: Math.min(drag.x, e.clientX),
      y: Math.min(drag.y, e.clientY),
      width: Math.abs(e.clientX - drag.x),
      height: Math.abs(e.clientY - drag.y)
    })
  }

  const finish = (): void => {
    if (rect && rect.width > 4 && rect.height > 4) {
      window.api.overlayResult(rect)
    } else {
      window.api.overlayResult(null)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') window.api.overlayResult(null)
  }

  const current = rect ?? { x: 0, y: 0, width: 0, height: 0 }

  return (
    <div
      className="fixed inset-0 cursor-crosshair bg-blue-500/10"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={finish}
      onKeyDown={onKeyDown}
      tabIndex={0}
      data-testid="overlay-root"
    >
      {rect && (
        <div
          className="absolute border-2 border-blue-400 bg-blue-400/15"
          style={{ left: current.x, top: current.y, width: current.width, height: current.height }}
        >
          <span className="absolute -top-7 left-0 rounded bg-blue-500 px-1.5 py-0.5 text-xs text-white">
            {current.width} × {current.height}
          </span>
        </div>
      )}
      {!drag && !rect && (
        <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-sm text-white">
          拖拽框选目标区域 · 按 Esc 取消
        </div>
      )}
    </div>
  )
}
