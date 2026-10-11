/**
 * Tooltip：Radix 封装，控制条图标按钮的功能名提示
 * 深色玻璃气泡，带方向箭头
 */
import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      side="right"
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-lg border border-white/[0.09] bg-[#191920]/[0.97] px-2.5 py-1.5 text-xs text-white/85 shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = 'TooltipContent'

/** 图标钮 + tooltip 一体化：控制条统一入口 */
export function TipButton(props: {
  tip: string
  onClick?: () => void
  className?: string
  /** 可访问性标签（图标按钮无可见文字） */
  ariaLabel?: string
  children: React.ReactNode
}): JSX.Element {
  const { tip, onClick, className, ariaLabel, children } = props
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={className}
          onClick={onClick}
          aria-label={ariaLabel ?? tip}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
