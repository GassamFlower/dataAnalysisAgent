import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[var(--control-h)] w-full rounded-md border border-input bg-card px-3 py-0 text-body text-ink-900 transition-[border-color,background-color] duration-fast ease-out file:border-0 file:bg-transparent file:text-small file:font-medium placeholder:text-ink-400 hover:border-[var(--border-color-strong)] focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
