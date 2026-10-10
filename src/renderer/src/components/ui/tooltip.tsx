/**
 * Tooltip：Radix 封装，控制条图标按钮的功能名提示
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
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md border border-white/[0.08] bg-[#1c1c22] px-2.5 py-1 text-xs text-white/90 shadow-md animate-in fade-in-0 zoom-in-95',
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
  children: React.ReactNode
}): JSX.Element {
  const { tip, onClick, className, children } = props
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className={className} onClick={onClick} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
