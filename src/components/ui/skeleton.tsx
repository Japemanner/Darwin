import { cva, type VariantProps } from "class-variance-authority"

const skeletonVariants = cva("animate-pulse rounded-md bg-muted", {
  variants: {
    variant: {
      default: "",
      circle: "rounded-full",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, variant, ...props }: SkeletonProps) {
  return <div className={skeletonVariants({ variant, className })} {...props} />
}

export { Skeleton }
