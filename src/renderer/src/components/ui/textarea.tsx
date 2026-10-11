import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-lg border border-input bg-white/[0.03] px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] transition-all duration-150 placeholder:text-muted-foreground/70 hover:border-white/[0.14] focus-visible:outline-none focus-visible:border-primary/50 focus-visible:bg-white/[0.045] focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
