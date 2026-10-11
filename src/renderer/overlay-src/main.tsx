import { useState } from 'react'
import type { Region } from '../../shared/types'

/**
 * 框选覆盖层：全屏透明窗口，拖拽绘制矩形，Esc 取消
 * 非选区暗化突出选区，四角角标辅助对齐
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
  const corner = 'absolute size-3 border-[#3fe6a2]'

  return (
    <div
      className="fixed inset-0 cursor-crosshair"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={finish}
      onKeyDown={onKeyDown}
      tabIndex={0}
      data-testid="overlay-root"
    >
      {/* 非选区暗化遮罩：凸显选区 */}
      {rect && (
        <>
          <div
            className="absolute left-0 right-0 top-0 bg-black/45"
            style={{ height: current.y }}
          />
          <div
            className="absolute bottom-0 left-0 bg-black/45"
            style={{ top: current.y + current.height }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              top: current.y,
              left: 0,
              width: current.x,
              height: current.height
            }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              top: current.y,
              left: current.x + current.width,
              right: 0,
              height: current.height
            }}
          />
        </>
      )}

      {rect && (
        <div
          className="absolute border border-white/60 bg-[#3fe6a2]/[0.07] shadow-[0_0_0_1px_rgba(0,0,0,0.35),inset_0_0_24px_rgba(63,230,162,0.06)]"
          style={{ left: current.x, top: current.y, width: current.width, height: current.height }}
        >
          {/* 四角 L 形角标 */}
          <span className={`${corner} -left-px -top-px border-l-2 border-t-2`} />
          <span className={`${corner} -right-px -top-px border-r-2 border-t-2`} />
          <span className={`${corner} -bottom-px -left-px border-b-2 border-l-2`} />
          <span className={`${corner} -bottom-px -right-px border-b-2 border-r-2`} />

          {/* 尺寸标签 */}
          <span className="tnum absolute -top-8 left-0 rounded-md bg-gradient-to-b from-[#3fe6a2] to-[#17ad74] px-2 py-0.5 text-[11px] font-medium text-white shadow-[0_4px_14px_rgba(32,196,132,0.35)]">
            {current.width} × {current.height}
          </span>
        </div>
      )}

      {!drag && !rect && (
        <div className="absolute left-1/2 top-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/[0.09] bg-black/75 px-5 py-2.5 text-[13px] text-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          拖拽框选目标区域
          <span className="h-3.5 w-px bg-white/15" />
          <span className="flex items-center gap-1 text-xs text-white/50">
            <kbd className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-px font-sans text-[10px] text-white/70">
              Esc
            </kbd>
            取消
          </span>
        </div>
      )}
    </div>
  )
}
