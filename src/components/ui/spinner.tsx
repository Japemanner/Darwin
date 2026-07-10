import { cn } from "@/lib/utils"

type SpinnerProps = React.HTMLAttributes<HTMLDivElement>

function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <div
      className={cn("h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      role="status"
      {...props}
    />
  )
}

export { Spinner }
