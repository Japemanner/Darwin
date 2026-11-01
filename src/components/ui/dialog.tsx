import * as React from "react"
import { cn } from "@/lib/utils"

const Dialog = ({ open, onOpenChange, children, ariaLabel }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode; ariaLabel?: string }) => {
  const dialogRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const node = dialogRef.current
    const focusables = node?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    focusables?.[0]?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false)
        return
      }
      if (e.key !== "Tab" || !node) return

      const items = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getClientRects().length > 0)

      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className="relative w-full max-w-lg max-h-[85vh] overflow-auto rounded-lg border bg-background shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-6 pb-0", className)} {...props} />
)

const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
)

const DialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
)

const DialogContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6", className)} {...props} />
)

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center justify-end gap-2 p-6 pt-0", className)} {...props} />
)

export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter }
