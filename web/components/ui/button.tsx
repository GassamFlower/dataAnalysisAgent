import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "touch-target inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-small font-medium transition-colors duration-fast ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-brand-hover active:brightness-95",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95",
        outline:
          "border border-border bg-card text-ink-900 hover:border-[var(--border-color-strong)] hover:bg-secondary active:bg-muted",
        secondary:
          "bg-secondary text-ink-900 hover:bg-muted active:bg-muted active:brightness-95",
        ghost: "text-ink-700 hover:bg-secondary hover:text-ink-900 active:bg-muted",
        link: "text-primary underline-offset-4 hover:underline active:text-brand-hover",
      },
      size: {
        default: "h-[var(--control-h)] px-5",
        sm: "h-[var(--control-h-sm)] rounded-md px-3.5 text-caption",
        lg: "h-[var(--control-h-lg)] rounded-md px-6 text-body",
        icon: "h-[var(--control-h-sm)] w-[var(--control-h-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
