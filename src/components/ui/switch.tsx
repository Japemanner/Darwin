import * as React from 'react'
import { cn } from '@/lib/utils'

// Accessible switch without a new dependency (feature 019, FR-006).
// A native <button> is reachable with Tab and activates with both Enter and
// Space; role="switch" + aria-checked expose the state (WCAG 2.1 AA).
interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'aria-checked'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  // Required accessible name; must mention the assistant and the organization.
  label: string
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, label, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  ),
)
Switch.displayName = 'Switch'

export { Switch }
export type { SwitchProps }
