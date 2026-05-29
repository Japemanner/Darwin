import { cn } from "@/lib/utils"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  fallback?: string
  size?: "sm" | "default" | "lg"
}

function Avatar({ className, src, fallback, size = "default", ...props }: AvatarProps) {
  const sizeClasses: Record<string, string> = {
    sm: "h-8 w-8 text-xs",
    default: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  }
  return (
    <div
      className={cn("relative flex shrink-0 overflow-hidden rounded-full bg-muted", sizeClasses[size] ?? "", className)}
      {...props}
    >
      {src ? (
        <img src={src} alt={fallback} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-medium text-muted-foreground">
          {fallback?.charAt(0).toUpperCase() ?? "?"}
        </span>
      )}
    </div>
  )
}

export { Avatar }
